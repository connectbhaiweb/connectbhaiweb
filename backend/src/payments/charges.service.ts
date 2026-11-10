import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChargeKind, Prisma, User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { calcGst } from '../common/utils/money';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';

type Tx = Prisma.TransactionClient;
export interface CreateChargeInput { kind: ChargeKind; payer: Pick<User, 'id' | 'gst_state_code'>; base: number; lead_id?: number | bigint; description?: string }

@Injectable()
export class ChargesService {
  constructor(private prisma: PrismaService, private settings: SettingsService, private cfg: ConfigService, private notify: NotificationsService) {}

  /** Creates a charge with GST split (CGST+SGST for the home state, IGST otherwise). */
  async create(tx: Tx, i: CreateChargeInput) {
    const pct = await this.settings.getNumber('gst_percent');
    const g = calcGst(i.base, pct, i.payer.gst_state_code, this.cfg.get('GST_HOME_STATE_CODE'));
    return tx.charge.create({
      data: {
        kind: i.kind, payer_user_id: i.payer.id, lead_id: i.lead_id, description: i.description,
        ...g, status: 'pending',
        install_fee_key: i.kind === 'tip_install_fee' && i.lead_id ? i.lead_id : null,
      },
    });
  }

  /**
   * Marks a charge paid (or waived) and applies its side effects in ONE transaction. Idempotent:
   * a repeated webhook/verify call is a no-op.
   */
  async settle(id: number | bigint, how: { status: 'paid' | 'waived'; pay_mode?: 'razorpay' | 'offline'; razorpay_payment_id?: string; razorpay_signature?: string; offline_reference?: string; recorded_by?: number }) {
    const result = await this.prisma.$transaction(async (tx) => {
      const ch = await tx.charge.findUnique({ where: { id }, include: { charge_leads: true } });
      if (!ch) throw new NotFoundException('Charge not found');
      if (ch.status === 'paid' || ch.status === 'waived') return { charge: ch, applied: false };
      if (ch.status === 'cancelled' || ch.status === 'refunded') throw new BadRequestException(`Charge is ${ch.status}`);
      const now = new Date();
      const charge = await tx.charge.update({
        where: { id },
        data: {
          status: how.status, pay_mode: how.pay_mode, razorpay_payment_id: how.razorpay_payment_id, razorpay_signature: how.razorpay_signature,
          offline_reference: how.offline_reference, recorded_by: how.recorded_by, paid_at: now,
          invoice_no: how.status === 'paid' ? `CB-INV-${String(id).padStart(6, '0')}` : null,
        },
        include: { charge_leads: true },
      });
      if (charge.kind === 'tip_care_plan_fee') {
        const ids = charge.charge_leads.map((c) => c.lead_id);
        await tx.lead.updateMany({ where: { id: { in: ids } }, data: { care_plan: true, care_plan_at: now } });
        const installed = await tx.lead.findMany({ where: { id: { in: ids }, status: 'installed' } });
        for (const l of installed) {
          await tx.carePlanDevice.upsert({ where: { lead_id: l.id }, update: { is_active: true }, create: { lead_id: l.id, tip_user_id: charge.payer_user_id } });
        }
      }
      return { charge, applied: true };
    });
    if (result.applied) {
      const payer = await this.prisma.user.findUnique({ where: { id: result.charge.payer_user_id } });
      if (payer && result.charge.kind === 'tip_onboarding') {   // a TIP is welcomed only once the onboarding fee is paid (or waived)
        await this.notify.send({ user_id: payer.id, phone: payer.phone, template: 'partner_registered', payload: { name: payer.name, role: payer.role, partner_code: payer.partner_code } });
      }
      await this.notify.send({ user_id: payer?.id, phone: payer?.phone, template: 'payment_received', payload: { kind: result.charge.kind, amount: Number(result.charge.total_amount), invoice_no: result.charge.invoice_no } });
    }
    return result.charge;
  }

  async cancel(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const ch = await tx.charge.findUnique({ where: { id } });
      if (!ch) throw new NotFoundException('Charge not found');
      if (ch.status === 'paid') throw new BadRequestException('A paid charge cannot be cancelled; refund it instead');
      await tx.chargeLead.deleteMany({ where: { charge_id: id } });
      return tx.charge.update({ where: { id }, data: { status: 'cancelled', install_fee_key: null } });
    });
  }

  /** TIP buys Care Plan for a set of leads with one payment. */
  async createCarePlanCharge(tip: User, leadIds: number[]) {
    const ids = [...new Set(leadIds)];
    const fee = await this.settings.getNumber('care_plan_fee_per_lead');
    if (fee <= 0) throw new BadRequestException('Care Plan fee is not configured');
    return this.prisma.$transaction(async (tx) => {
      const leads = await tx.lead.findMany({ where: { id: { in: ids }, tip_user_id: tip.id } });
      if (leads.length !== ids.length) throw new BadRequestException('Some leads were not found or are not assigned to you');
      if (leads.some((l) => l.care_plan)) throw new ConflictException('Care Plan is already active on some of these leads');
      if (leads.some((l) => l.status === 'lost' || l.status === 'cancelled')) throw new BadRequestException('Lost or cancelled leads cannot get Care Plan');
      // free leads whose earlier attempt failed/was cancelled; block ones that still have a live charge
      await tx.chargeLead.deleteMany({ where: { lead_id: { in: ids }, charge: { status: { in: ['failed', 'cancelled'] } } } });
      if (await tx.chargeLead.count({ where: { lead_id: { in: ids } } })) throw new ConflictException('A Care Plan payment is already pending for some of these leads');
      const charge = await this.create(tx, { kind: 'tip_care_plan_fee', payer: tip, base: fee * ids.length, description: `Care Plan for ${ids.length} lead(s)` });
      await tx.chargeLead.createMany({ data: ids.map((lead_id) => ({ charge_id: charge.id, lead_id, base_amount: fee })) });
      return tx.charge.findUniqueOrThrow({ where: { id: charge.id }, include: { charge_leads: true } });
    });
  }
}
