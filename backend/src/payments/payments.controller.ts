import { fulltextIds, leadTextWhere } from '../common/utils/fulltext';
import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Charge, Prisma } from '@prisma/client';
import { AuthUser, CurrentUser, Public, Roles } from '../common/decorators';
import { pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { ChargesService } from './charges.service';
import { SettingsService } from '../settings/settings.service';
import { CarePlanPurchaseDto, ChargeQuery, CreateChargeDto, CustomerChargeDto, LeadOfflinePaidDto, OfflinePaidDto, PayDto, VerifyPaymentDto } from './payments.dto';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dateIST } from '../notifications/whatsapp-campaigns';
import { RazorpayService } from './razorpay.service';

@ApiTags('payments') @Controller()
export class PaymentsController {
  constructor(private prisma: PrismaService, private charges: ChargesService, private rzp: RazorpayService, private jwt: JwtService, private cfg: ConfigService, private settings: SettingsService, private notify: NotificationsService, private auth: AuthService) {}

  /** Payer or admin; or anyone holding the payment_token issued at TIP registration (they cannot log in before approval). */
  private async authorize(charge: Charge, user: AuthUser | undefined, token?: string) {
    if (user && (user.role === 'admin' || Number(charge.payer_user_id) === user.id)) return;
    if (token) {
      try {
        const p = await this.jwt.verifyAsync(token, { secret: this.cfg.getOrThrow('JWT_SECRET') });
        if (p.typ === 'pay' && Number(p.charge_id) === Number(charge.id)) return;
      } catch { /* fall through */ }
    }
    throw new ForbiddenException('You cannot access this charge');
  }
  private async load(id: number) {
    const c = await this.prisma.charge.findUnique({ where: { id }, include: { charge_leads: true } });
    if (!c) throw new NotFoundException('Charge not found');
    return c;
  }

  @ApiBearerAuth() @Roles('admin', 'tip', 'customer') @Get('charges')
  async list(@Query() q: ChargeQuery, @CurrentUser() u: AuthUser) {
    const s = q.q?.trim();
    const where: Prisma.ChargeWhereInput = { kind: q.kind as any, status: q.status as any, payer_user_id: u.role === 'admin' ? q.payer_user_id : u.id };
    if (s) {
      const uids = await fulltextIds(this.prisma, 'users', s);
      where.OR = [{ invoice_no: { contains: s } }, { description: { contains: s } }, uids ? { payer_user_id: { in: uids } } : { payer: { OR: [{ name: { contains: s } }, { phone: { contains: s } }] } }, { lead: await leadTextWhere(this.prisma, s) }];
    }
    const [items, total] = await Promise.all([
      this.prisma.charge.findMany({ where, orderBy: { id: 'desc' }, include: { charge_leads: true, payer: { select: { id: true, name: true, phone: true, role: true, partner_code: true } } }, ...pageArgs(q) }),
      this.prisma.charge.count({ where }),
    ]);
    const due = await this.prisma.charge.aggregate({ where: { ...where, status: 'pending' }, _sum: { total_amount: true } });
    return { ...paged(items, total, q), pending_total: Number(due._sum.total_amount ?? 0) };
  }

  @ApiBearerAuth() @Roles('admin', 'tip', 'customer') @Get('charges/:id')
  async one(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    const c = await this.load(id);
    await this.authorize(c, u);
    return c;
  }

  /** Step 1 of online payment: creates (or reuses) the gateway order. */
  @Public() @Post('charges/:id/pay') @HttpCode(200)
  async pay(@Param('id', ParseIntPipe) id: number, @Body() d: PayDto, @CurrentUser() u?: AuthUser) {
    const c = await this.load(id);
    await this.authorize(c, u, d.payment_token);
    if (c.status !== 'pending') throw new BadRequestException(`Charge is already ${c.status}`);
    const total = Number(c.total_amount);
    if (total <= 0) throw new BadRequestException('Nothing to pay');
    if (c.razorpay_order_id) return { charge_id: Number(c.id), order_id: c.razorpay_order_id, amount: Math.round(total * 100), currency: 'INR', key_id: this.cfg.get('RAZORPAY_KEY_ID') || 'mock', mock: this.rzp.isMock };
    const o = await this.rzp.createOrder(total, `charge_${id}`);
    await this.prisma.charge.update({ where: { id }, data: { razorpay_order_id: o.id, pay_mode: 'razorpay' } });
    return { charge_id: Number(c.id), order_id: o.id, amount: o.amount, currency: o.currency, key_id: o.key_id, mock: o.mock };
  }

  /** DEV ONLY: with no Razorpay keys (mock gateway, non-production) the browser cannot sign a payment, so this settles the charge directly. */
  @Public() @Post('charges/:id/mock-pay') @HttpCode(200)
  async mockPay(@Param('id', ParseIntPipe) id: number, @Body() d: PayDto, @CurrentUser() u?: AuthUser) {
    if (!this.rzp.isMock || this.cfg.get('APP_ENV') === 'production') throw new ForbiddenException('Mock payments are disabled');
    const c = await this.load(id);
    await this.authorize(c, u, d.payment_token);
    if (c.status !== 'pending') throw new BadRequestException(`Charge is already ${c.status}`);
    return this.withSession(await this.charges.settle(id, { status: 'paid', pay_mode: 'razorpay', razorpay_payment_id: `pay_mock_${Date.now().toString(36)}`, razorpay_signature: 'mock' }), u);
  }

  /** Step 2: browser returns payment id + signature after checkout. */
  @Public() @Post('charges/:id/verify') @HttpCode(200)
  async verify(@Param('id', ParseIntPipe) id: number, @Body() d: VerifyPaymentDto, @CurrentUser() u?: AuthUser) {
    const c = await this.load(id);
    await this.authorize(c, u, d.payment_token);
    if (!c.razorpay_order_id) throw new BadRequestException('No payment started for this charge');
    if (!this.rzp.verifyPayment(c.razorpay_order_id, d.razorpay_payment_id, d.razorpay_signature)) throw new BadRequestException('Payment signature is invalid');
    return this.withSession(await this.charges.settle(id, { status: 'paid', pay_mode: 'razorpay', razorpay_payment_id: d.razorpay_payment_id, razorpay_signature: d.razorpay_signature }), u);
  }

  /** A new TIP who just paid the registration fee (no login yet) is logged in straight away. */
  private async withSession<T extends { kind: string; payer_user_id: bigint | number }>(charge: T, u?: AuthUser) {
    if (u || charge.kind !== 'tip_onboarding') return charge;
    return { ...charge, session: await this.auth.sessionAfterPayment(charge.payer_user_id) };
  }

  /** Razorpay -> server. Uses the RAW body for signature verification. This is the source of truth for payment. */
  @Public() @SkipThrottle() @Post('payments/razorpay/webhook') @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<any>, @Headers('x-razorpay-signature') sig: string) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    if (!this.rzp.verifyWebhook(raw, sig)) throw new ForbiddenException('Invalid webhook signature');
    const ev = req.body;
    if (ev?.event === 'payment.captured' || ev?.event === 'order.paid') {
      const pay = ev.payload?.payment?.entity;
      const orderId = pay?.order_id ?? ev.payload?.order?.entity?.id;
      const ch = orderId ? await this.prisma.charge.findUnique({ where: { razorpay_order_id: orderId } }) : null;
      if (ch) await this.charges.settle(ch.id, { status: 'paid', pay_mode: 'razorpay', razorpay_payment_id: pay?.id });
    } else if (ev?.event === 'payment.failed') {
      const orderId = ev.payload?.payment?.entity?.order_id;
      if (orderId) await this.prisma.charge.updateMany({ where: { razorpay_order_id: orderId, status: 'pending' }, data: { status: 'failed' } });
    }
    return { received: true };
  }

  @ApiBearerAuth() @Roles('admin') @Post('charges/:id/offline') @HttpCode(200)
  offline(@Param('id', ParseIntPipe) id: number, @Body() d: OfflinePaidDto, @CurrentUser() u: AuthUser) {
    return this.charges.settle(id, { status: 'paid', pay_mode: 'offline', offline_reference: d.reference, recorded_by: u.id });
  }
  @ApiBearerAuth() @Roles('admin') @Post('charges/:id/waive') @HttpCode(200)
  waive(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) { return this.charges.settle(id, { status: 'waived', recorded_by: u.id }); }
  @ApiBearerAuth() @Roles('admin') @Post('charges/:id/cancel') @HttpCode(200)
  cancel(@Param('id', ParseIntPipe) id: number) { return this.charges.cancel(id); }

  /** TIP picks leads, pays once; webhook flips leads.care_plan. */
  /** Admin raises a charge on any user (GST added on top of base_amount). */
  @ApiBearerAuth() @Roles('admin') @Post('charges')
  async createCharge(@Body() d: CreateChargeDto) {
    const payer = await this.prisma.user.findUnique({ where: { id: d.payer_user_id } });
    if (!payer) throw new BadRequestException('Payer not found');
    const charge = await this.prisma.$transaction((tx) => this.charges.create(tx, { kind: d.kind ?? 'other', payer, base: d.base_amount, description: d.description, lead_id: d.lead_id }));
    // tell the payer right away (TIP or customer); the 30-minute reminder then skips this charge
    await this.notify.send({ user_id: payer.id, phone: payer.phone, template: 'payment_due', payload: { charge_id: Number(charge.id), name: payer.name, what: charge.description || 'ConnectBhai payment', amount: Number(charge.total_amount), due: dateIST(new Date(Date.now() + 7 * 86_400_000)) } });
    return charge;
  }

  /** The customer's plan payment for one of their leads. The amount is always the plan price (GST-inclusive, read from the plan), never taken from the request. */
  private async planCharge(lead: { id: bigint; ref_code: string | null; plan: { name: string; price: Prisma.Decimal } | null }, payer: { id: bigint; gst_state_code: string | null }) {
    const price = Number(lead.plan?.price ?? 0);
    if (!lead.plan || !(price > 0)) throw new BadRequestException('This plan has no price to pay');
    const open = await this.prisma.charge.findFirst({ where: { kind: 'customer_payment', status: 'pending', lead_id: lead.id, payer_user_id: payer.id }, orderBy: { id: 'desc' } });
    if (open) return open;   // one open payment per connection: a second click reuses it
    const pct = await this.settings.getNumber('gst_percent');
    const base = Math.round((price * 100) / (100 + pct) * 100) / 100;
    return this.prisma.$transaction((tx) => this.charges.create(tx, { kind: 'customer_payment', payer, base, description: `Plan payment · ${lead.plan!.name} (${lead.ref_code})`, lead_id: lead.id }));
  }

  /** Customer pays the plan price of their own lead, any day. */
  @ApiBearerAuth() @Roles('customer') @Post('charges/customer')
  async customerCharge(@Body() d: CustomerChargeDto, @CurrentUser() u: AuthUser) {
    const payer = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    const lead = await this.prisma.lead.findFirst({ where: { id: d.lead_id, OR: [{ customer_user_id: u.id }, { customer_phone: payer.phone }] }, include: { plan: { select: { name: true, price: true } } } });
    if (!lead) throw new BadRequestException('Connection not found');
    if (lead.status === 'lost' || lead.status === 'cancelled') throw new BadRequestException('This request is closed');
    return this.planCharge(lead, payer);
  }

  /** Admin, or the TIP assigned to the lead, marks the plan price as received outside the app. Creates the charge if the customer has not started one. */
  @ApiBearerAuth() @Roles('admin', 'tip') @Post('leads/:id/payment/offline') @HttpCode(200)
  async leadOffline(@Param('id', ParseIntPipe) id: number, @Body() d: LeadOfflinePaidDto, @CurrentUser() u: AuthUser) {
    const lead = await this.prisma.lead.findUnique({ where: { id }, include: { plan: { select: { name: true, price: true } } } });
    if (!lead || (u.role === 'tip' && Number(lead.tip_user_id) !== u.id)) throw new NotFoundException('Lead not found');
    const payer = lead.customer_user_id ? await this.prisma.user.findUnique({ where: { id: lead.customer_user_id } }) : await this.prisma.user.findFirst({ where: { phone: lead.customer_phone, role: 'customer' } });
    if (!payer) throw new BadRequestException('The customer has no account yet');
    const charge = await this.planCharge(lead, payer);
    return this.charges.settle(charge.id, { status: 'paid', pay_mode: 'offline', offline_reference: d.reference?.trim() || (u.role === 'tip' ? 'Received by TIP' : 'Received by admin'), recorded_by: u.id });
  }

  /** TIP buys Care Plan for their own leads; admin does the same for the TIP the leads are assigned to (the charge is that TIP's). */
  @ApiBearerAuth() @Roles('tip', 'admin') @Post('charges/care-plan')
  async carePlan(@Body() d: CarePlanPurchaseDto, @CurrentUser() u: AuthUser) {
    let payerId = u.id;
    if (u.role === 'admin') {
      const leads = await this.prisma.lead.findMany({ where: { id: { in: d.lead_ids } }, select: { tip_user_id: true } });
      const tips = new Set(leads.map((l) => (l.tip_user_id == null ? null : Number(l.tip_user_id))));
      if (leads.length !== new Set(d.lead_ids).size) throw new BadRequestException('Some leads were not found');
      if (tips.size !== 1 || tips.has(null)) throw new BadRequestException('Care Plan needs the leads to be assigned to one TIP');
      payerId = [...tips][0] as number;
    }
    const tip = await this.prisma.user.findUniqueOrThrow({ where: { id: payerId } });
    return this.charges.createCarePlanCharge(tip, d.lead_ids);
  }
}
