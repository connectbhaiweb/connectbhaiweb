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
import { CarePlanPurchaseDto, ChargeQuery, CreateChargeDto, CustomerChargeDto, OfflinePaidDto, PayDto, VerifyPaymentDto } from './payments.dto';
import { RazorpayService } from './razorpay.service';

@ApiTags('payments') @Controller()
export class PaymentsController {
  constructor(private prisma: PrismaService, private charges: ChargesService, private rzp: RazorpayService, private jwt: JwtService, private cfg: ConfigService, private settings: SettingsService) {}

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
    const where: Prisma.ChargeWhereInput = { kind: q.kind as any, status: q.status as any, payer_user_id: u.role === 'admin' ? q.payer_user_id : u.id };
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
    return this.charges.settle(id, { status: 'paid', pay_mode: 'razorpay', razorpay_payment_id: `pay_mock_${Date.now().toString(36)}`, razorpay_signature: 'mock' });
  }

  /** Step 2: browser returns payment id + signature after checkout. */
  @Public() @Post('charges/:id/verify') @HttpCode(200)
  async verify(@Param('id', ParseIntPipe) id: number, @Body() d: VerifyPaymentDto, @CurrentUser() u?: AuthUser) {
    const c = await this.load(id);
    await this.authorize(c, u, d.payment_token);
    if (!c.razorpay_order_id) throw new BadRequestException('No payment started for this charge');
    if (!this.rzp.verifyPayment(c.razorpay_order_id, d.razorpay_payment_id, d.razorpay_signature)) throw new BadRequestException('Payment signature is invalid');
    return this.charges.settle(id, { status: 'paid', pay_mode: 'razorpay', razorpay_payment_id: d.razorpay_payment_id, razorpay_signature: d.razorpay_signature });
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
    return this.prisma.$transaction((tx) => this.charges.create(tx, { kind: d.kind ?? 'other', payer, base: d.base_amount, description: d.description, lead_id: d.lead_id }));
  }

  /** Customer starts a payment for themselves (rental, installation, bill). `amount` is the GST-inclusive total they will pay. */
  @ApiBearerAuth() @Roles('customer') @Post('charges/customer')
  async customerCharge(@Body() d: CustomerChargeDto, @CurrentUser() u: AuthUser) {
    const payer = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    if (d.lead_id && !(await this.prisma.lead.findFirst({ where: { id: d.lead_id, OR: [{ customer_user_id: u.id }, { customer_phone: payer.phone }] } }))) throw new BadRequestException('Connection not found');
    const pct = await this.settings.getNumber('gst_percent');
    const base = Math.round((d.amount * 100) / (100 + pct) * 100) / 100;
    return this.prisma.$transaction((tx) => this.charges.create(tx, { kind: 'customer_payment', payer, base, description: d.description, lead_id: d.lead_id }));
  }

  @ApiBearerAuth() @Roles('tip') @Post('charges/care-plan')
  async carePlan(@Body() d: CarePlanPurchaseDto, @CurrentUser() u: AuthUser) {
    const tip = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    return this.charges.createCarePlanCharge(tip, d.lead_ids);
  }
}
