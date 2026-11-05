import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/decorators';
import { pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { leadScope } from '../common/utils/scope';
import { LeadsService } from '../leads/leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChargesService } from '../payments/charges.service';
import { SettingsService } from '../settings/settings.service';
import { BookingQuery, CompleteBookingDto, CreateBookingDto, UpdateBookingDto } from './bookings.dto';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService, private leads: LeadsService, private charges: ChargesService,
    private settings: SettingsService, private notify: NotificationsService,
  ) {}

  private async getForUser(id: number, u: AuthUser) {
    const b = await this.prisma.booking.findFirst({ where: { id, lead: leadScope(u) }, include: { lead: true } });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }
  private assertCanManage(b: { tip_user_id: bigint }, u: AuthUser) {
    if (u.role !== 'admin' && !(u.role === 'tip' && Number(b.tip_user_id) === u.id)) throw new ForbiddenException('Only the assigned TIP or admin can manage this booking');
  }

  async create(d: CreateBookingDto, u: AuthUser) {
    const when = new Date(d.scheduled_at);
    if (when.getTime() < Date.now() - 60_000) throw new BadRequestException('scheduled_at must be in the future');
    const lead = await this.leads.getScoped(d.lead_id, u);
    if (!lead.tip_user_id) throw new BadRequestException('Assign a TIP to this lead first');
    if (u.role === 'tip' && Number(lead.tip_user_id) !== u.id) throw new ForbiddenException('This lead is not assigned to you');
    if (!['new', 'contacted', 'followup'].includes(lead.status)) throw new BadRequestException(`A ${lead.status} lead cannot be booked`);
    return this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({ data: { lead_id: lead.id, tip_user_id: lead.tip_user_id!, scheduled_at: when, notes: d.notes } });
      await tx.lead.update({ where: { id: lead.id }, data: { status: 'scheduled', followup_at: null } });
      await this.leads.log(tx, lead.id, u.id, 'status_changed', { from: lead.status, to: 'scheduled', note: `installation on ${when.toISOString()}` });
      return b;
    });
  }

  async list(q: BookingQuery, u: AuthUser) {
    const where: Prisma.BookingWhereInput = { status: q.status as any, lead_id: q.lead_id, lead: leadScope(u) };
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({ where, orderBy: { scheduled_at: 'desc' }, include: { lead: { select: { id: true, ref_code: true, customer_name: true, customer_phone: true, customer_user_id: true, brought_by_user_id: true, address: true, pincode: true, status: true, care_plan: true, plan: { select: { id: true, plan_code: true, name: true, price: true, speed_mbps: true, install_charge: true, category: { select: { id: true, name: true, type: true, logo_url: true } } } } } }, tip: { select: { id: true, name: true, partner_code: true, phone: true } } }, ...pageArgs(q) }),
      this.prisma.booking.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async update(id: number, d: UpdateBookingDto, u: AuthUser) {
    const b = await this.getForUser(id, u);
    this.assertCanManage(b, u);
    if (b.status !== 'scheduled') throw new BadRequestException(`Booking is ${b.status}`);
    if (d.status === 'cancelled') {
      return this.prisma.$transaction(async (tx) => {
        const x = await tx.booking.update({ where: { id }, data: { status: 'cancelled', notes: d.notes ?? b.notes } });
        await tx.lead.update({ where: { id: b.lead_id }, data: { status: 'followup', followup_at: new Date(Date.now() + 86_400_000) } });
        await this.leads.log(tx, b.lead_id, u.id, 'status_changed', { from: 'scheduled', to: 'followup', note: 'booking cancelled' });
        return x;
      });
    }
    if (!d.scheduled_at) throw new BadRequestException('Provide scheduled_at or status=cancelled');
    const when = new Date(d.scheduled_at);
    if (when.getTime() < Date.now() - 60_000) throw new BadRequestException('scheduled_at must be in the future');
    const x = await this.prisma.booking.update({ where: { id }, data: { scheduled_at: when, notes: d.notes ?? b.notes } });
    await this.leads.log(this.prisma, b.lead_id, u.id, 'rescheduled', { note: when.toISOString() });
    return x;
  }

  /**
   * Installation done. ONE transaction: booking completed, lead installed, DSA payout created (if a DSA brought it),
   * TIP install fee (+GST) charged (internal TIP is exempt), Care Plan device created if already bought.
   */
  async complete(id: number, d: CompleteBookingDto, u: AuthUser) {
    const b = await this.getForUser(id, u);
    this.assertCanManage(b, u);
    if (b.status !== 'scheduled') throw new ConflictException(`Booking is already ${b.status}`);
    const lead = b.lead;
    const payout = await this.settings.getNumber('dsa_payout_per_lead');
    const installFee = await this.settings.getNumber('tip_install_fee');
    const tip = await this.prisma.user.findUniqueOrThrow({ where: { id: b.tip_user_id } });

    const out = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const booking = await tx.booking.update({ where: { id }, data: { status: 'completed', completed_at: now, connection_id: d.connection_id, router_serial: d.router_serial, router_mac: d.router_mac, notes: d.notes ?? b.notes } });
      await tx.lead.update({ where: { id: lead.id }, data: { status: 'installed', installed_at: now, followup_at: null } });
      await this.leads.log(tx, lead.id, u.id, 'installed', { from: 'scheduled', to: 'installed' });

      let commission = null;
      if (lead.brought_by_user_id && payout > 0) {
        commission = await tx.commission.create({ data: { dsa_user_id: lead.brought_by_user_id, lead_id: lead.id, booking_id: id, amount: payout } });
      }
      let charge = null;
      if (!tip.is_internal && installFee > 0) {
        charge = await this.charges.create(tx, { kind: 'tip_install_fee', payer: tip, base: installFee, lead_id: lead.id, description: `Install fee for ${lead.ref_code}` });
      }
      if (lead.care_plan) {
        await tx.carePlanDevice.upsert({
          where: { lead_id: lead.id }, update: { is_active: true },
          create: { lead_id: lead.id, tip_user_id: tip.id, serial_number: d.router_serial || null, mac_address: d.router_mac },
        });
      }
      return { booking, commission, charge };
    });

    await this.notify.send({ user_id: lead.customer_user_id, phone: lead.customer_phone, template: 'installed', payload: { ref_code: lead.ref_code } });
    if (out.commission) {
      const dsa = await this.prisma.user.findUnique({ where: { id: out.commission.dsa_user_id } });
      await this.notify.send({ user_id: dsa?.id, phone: dsa?.phone, template: 'dsa_payout_eligible', payload: { ref_code: lead.ref_code, amount: Number(out.commission.amount) } });
    }
    if (out.charge) await this.notify.send({ user_id: tip.id, phone: tip.phone, template: 'install_fee_due', payload: { ref_code: lead.ref_code, amount: Number(out.charge.total_amount) } });
    return out;
  }
}
