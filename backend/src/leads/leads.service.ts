import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Lead, LeadStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuthUser } from '../common/decorators';
import { pageArgs, paged } from '../common/pagination';
import { JobsService } from '../common/jobs/jobs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { normalizePhone } from '../common/utils/phone';
import { leadScope } from '../common/utils/scope';
import { NotificationsService } from '../notifications/notifications.service';
import { productName } from '../notifications/whatsapp-campaigns';
import { SettingsService } from '../settings/settings.service';
import { AssignDto, CreateLeadDto, LeadQuery, LeadStatusDto } from './leads.dto';

/** installed/scheduled are only reachable through bookings. */
export const TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ['contacted', 'followup', 'lost', 'cancelled'],
  contacted: ['followup', 'lost', 'cancelled'],
  followup: ['contacted', 'lost', 'cancelled'],
  scheduled: ['followup', 'lost', 'cancelled'],
  lost: ['followup'],
  cancelled: [],
  installed: [],
};
const OPEN: LeadStatus[] = ['new', 'contacted', 'followup', 'scheduled'];
const leadInclude = {
  plan: { select: { id: true, plan_code: true, name: true, price: true, category: { select: { name: true, type: true, logo_url: true } } } },
  tip: { select: { id: true, name: true, partner_code: true, phone: true } },
  dsa: { select: { id: true, name: true, partner_code: true } },
  area: { select: { id: true, name: true } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService, private settings: SettingsService, private notify: NotificationsService, private jobs: JobsService) {
    // background job: tell the assigned TIP about a new lead (looks the TIP up after the form has been saved)
    this.jobs.register('new_lead', async (p: { tip_user_id: number; ref_code: string; pincode: string }) => {
      const t = await this.prisma.user.findUnique({ where: { id: p.tip_user_id } });
      await this.notify.send({ user_id: p.tip_user_id, phone: t?.phone, template: 'new_lead', payload: { ref_code: p.ref_code, pincode: p.pincode } });
    });
  }

  /** Picks the approved, active TIP serving this PIN with the fewest open leads; falls back to the internal TIP. */
  async pickTip(pincode: string): Promise<number | null> {
    const maps = await this.prisma.tipPincodeMapping.findMany({
      where: { pincode, is_active: true, tip: { is_active: true, partner_status: 'approved' } }, select: { tip_user_id: true },
    });
    if (maps.length === 1) return Number(maps[0].tip_user_id);
    if (maps.length > 1) {
      const counts = await Promise.all(maps.map(async (m) => ({ id: Number(m.tip_user_id), n: await this.prisma.lead.count({ where: { tip_user_id: m.tip_user_id, status: { in: OPEN } } }) })));
      return counts.sort((a, b) => a.n - b.n || a.id - b.id)[0].id;
    }
    const internal = await this.prisma.user.findFirst({ where: { role: 'tip', is_internal: true, is_active: true, partner_status: 'approved' } });
    return internal ? Number(internal.id) : null;
  }

  async log(tx: Prisma.TransactionClient | PrismaService, lead_id: number | bigint, actor: number | null, event_type: string, extra: { from?: string; to?: string; note?: string } = {}) {
    return tx.leadEvent.create({ data: { lead_id, actor_user_id: actor, event_type, from_status: extra.from, to_status: extra.to, note: extra.note } });
  }

  async create(d: CreateLeadDto, actor?: AuthUser) {
    const phone = normalizePhone(d.customer_phone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');
    const areas = await this.prisma.area.findMany({ where: { pincode: d.pincode }, include: { city: true } });
    if (!areas.length) throw new BadRequestException('We do not serve this PIN code yet. Join the waitlist.');
    if (d.area_id && !areas.some((a) => Number(a.id) === d.area_id)) throw new BadRequestException('area_id does not belong to this PIN code');
    if (d.plan_id) {
      const ok = await this.prisma.pincodePlanMapping.findFirst({ where: { pincode: d.pincode, plan_id: d.plan_id, is_available: true, plan: { is_active: true } } });
      if (!ok) throw new BadRequestException('This plan is not available in your PIN code');
    }
    const dup = await this.prisma.lead.findFirst({ where: { customer_phone: phone, pincode: d.pincode, status: { in: OPEN } } });
    if (dup) throw new ConflictException(`You already have an open request (${dup.ref_code}) for this PIN code`);

    let source: Lead['source'] = d.source ?? 'website';
    let brought_by: number | null = null;
    let customer_user_id: number | null = null;
    if (actor?.role === 'dsa') { source = 'dsa'; brought_by = actor.id; }
    else if (actor?.role === 'admin') { source = 'admin'; brought_by = d.brought_by_user_id ?? null; }
    else if (actor?.role === 'customer') customer_user_id = actor.id;
    if (brought_by) {
      const dsa = await this.prisma.user.findFirst({ where: { id: brought_by, role: 'dsa', partner_status: 'approved', is_active: true } });
      if (!dsa) throw new BadRequestException('brought_by_user_id is not an active DSA');
    }
    if (!customer_user_id) {
      const existing = await this.prisma.user.findUnique({ where: { role_phone: { role: 'customer', phone } } });
      customer_user_id = existing ? Number(existing.id) : null;
    }
    const tip = (await this.settings.getBool('auto_assign')) ? await this.pickTip(d.pincode) : null;

    const lead = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          ref_code: `TMP-${randomBytes(8).toString('hex')}`, source, customer_user_id, customer_name: d.customer_name.trim(), customer_phone: phone,
          customer_email: d.customer_email, address: d.address, area_id: d.area_id ?? (areas.length === 1 ? areas[0].id : null), pincode: d.pincode,
          plan_id: d.plan_id, brought_by_user_id: brought_by, tip_user_id: tip, notes: d.notes,
        },
      });
      const l = await tx.lead.update({ where: { id: created.id }, data: { ref_code: `CB-${String(created.id).padStart(6, '0')}` }, include: leadInclude });
      await this.log(tx, l.id, actor?.id ?? null, 'created', { to: 'new', note: `source=${source}` });
      if (tip) await this.log(tx, l.id, null, 'assigned', { note: `tip_user_id=${tip}` });
      return l;
    });

    await this.notify.send({ user_id: customer_user_id, phone, template: 'lead_received', payload: { ref_code: lead.ref_code, name: lead.customer_name, product: productName(lead.plan), executive: lead.tip?.name ?? lead.dsa?.name ?? 'Connect Bhai' } });
    if (tip) {
      await this.jobs.enqueue('new_lead', { tip_user_id: Number(tip), ref_code: lead.ref_code, pincode: lead.pincode });
    }
    return lead;
  }

  async list(q: LeadQuery, u: AuthUser) {
    const and: Prisma.LeadWhereInput[] = [leadScope(u)];
    if (q.status) and.push({ status: q.status as LeadStatus });
    if (q.pincode) and.push({ pincode: q.pincode });
    if (q.source) and.push({ source: q.source as any });
    if (u.role === 'admin') {
      if (q.tip_user_id) and.push({ tip_user_id: q.tip_user_id });
      if (q.brought_by_user_id) and.push({ brought_by_user_id: q.brought_by_user_id });
    }
    if (q.q) and.push({ OR: [{ customer_name: { contains: q.q } }, { customer_phone: { contains: q.q } }, { ref_code: { contains: q.q } }] });
    const where: Prisma.LeadWhereInput = { AND: and };
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({ where, orderBy: { id: 'desc' }, include: leadInclude, ...pageArgs(q) }),
      this.prisma.lead.count({ where }),
    ]);
    return paged(items, total, q);
  }

  /** Throws 404 (not 403) when the lead is outside the caller's scope, so IDs cannot be probed. */
  async getScoped(id: number, u: AuthUser) {
    const lead = await this.prisma.lead.findFirst({ where: { AND: [{ id }, leadScope(u)] }, include: leadInclude });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async changeStatus(id: number, d: LeadStatusDto, u: AuthUser) {
    const lead = await this.getScoped(id, u);
    if (u.role === 'dsa') throw new ForbiddenException('DSAs can view lead status but not change it');
    if (u.role === 'customer' && d.status !== 'cancelled') throw new ForbiddenException('You can only cancel your own request');
    if (!TRANSITIONS[lead.status].includes(d.status)) throw new BadRequestException(`Cannot move a lead from ${lead.status} to ${d.status}`);
    if (d.status === 'lost' && !d.lost_reason) throw new BadRequestException('lost_reason is required');
    if (d.status === 'followup' && !d.followup_at) throw new BadRequestException('followup_at is required for a follow-up');

    return this.prisma.$transaction(async (tx) => {
      if (lead.status === 'scheduled') await tx.booking.updateMany({ where: { lead_id: id, status: 'scheduled' }, data: { status: 'cancelled' } });
      const updated = await tx.lead.update({
        where: { id },
        data: { status: d.status, followup_at: d.status === 'followup' ? new Date(d.followup_at!) : null, lost_reason: d.status === 'lost' ? d.lost_reason : null },
        include: leadInclude,
      });
      await this.log(tx, id, u.id, 'status_changed', { from: lead.status, to: d.status, note: d.note });
      return updated;
    }).then(async (updated) => {
      if (d.status === 'followup') await this.notify.send({ user_id: updated.customer_user_id, phone: updated.customer_phone, template: 'lead_followup', payload: { name: updated.customer_name, product: productName(updated.plan), ref_code: updated.ref_code } });
      return updated;
    });
  }

  async assign(id: number, d: AssignDto, u: AuthUser) {
    const lead = await this.getScoped(id, u);
    if (lead.status === 'installed') throw new BadRequestException('Installed leads cannot be reassigned');
    const tip = await this.prisma.user.findFirst({ where: { id: d.tip_user_id, role: 'tip', partner_status: 'approved', is_active: true } });
    if (!tip) throw new BadRequestException('tip_user_id is not an approved TIP');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({ where: { id }, data: { tip_user_id: tip.id }, include: leadInclude });
      await this.log(tx, id, u.id, 'assigned', { note: `tip_user_id=${tip.id}` });
      return updated;
    });
  }

  async events(id: number, u: AuthUser) {
    await this.getScoped(id, u);
    return this.prisma.leadEvent.findMany({ where: { lead_id: id }, orderBy: { id: 'asc' }, include: { actor: { select: { id: true, name: true, role: true } } } });
  }

  async addNote(id: number, note: string, u: AuthUser) {
    await this.getScoped(id, u);
    return this.log(this.prisma, id, u.id, 'note', { note });
  }

  /** Public status check: needs both the reference code and the phone used on the request. */
  async track(ref_code: string, rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    const lead = phone ? await this.prisma.lead.findFirst({ where: { ref_code, customer_phone: phone }, include: leadInclude }) : null;
    if (!lead) throw new NotFoundException('No request found for these details');
    return { ref_code: lead.ref_code, status: lead.status, plan: lead.plan, pincode: lead.pincode, created_at: lead.created_at, installed_at: lead.installed_at };
  }
}
