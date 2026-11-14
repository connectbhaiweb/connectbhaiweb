import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Lead, LeadStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuthUser } from '../common/decorators';
import { pageArgs, paged } from '../common/pagination';
import { JobsService } from '../common/jobs/jobs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { fulltextIds } from '../common/utils/fulltext';
import { normalizePhone } from '../common/utils/phone';
import { leadScope } from '../common/utils/scope';
import { NotificationsService } from '../notifications/notifications.service';
import { productName } from '../notifications/whatsapp-campaigns';
import { SettingsService } from '../settings/settings.service';
import { AssignDto, CreateLeadDto, LeadQuery, LeadStatusDto, UpdateLeadDto } from './leads.dto';

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
  plan: { select: { id: true, plan_code: true, name: true, price: true, speed_mbps: true, category: { select: { name: true, type: true, logo_url: true } } } },
  tip: { select: { id: true, name: true, partner_code: true, phone: true, business_name: true } },
  dsa: { select: { id: true, name: true, partner_code: true, phone: true, business_name: true } },
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
    // independent look-ups: one round trip instead of four
    const [planOk, dup, existingCustomer, autoAssign] = await Promise.all([
      d.plan_id ? this.prisma.pincodePlanMapping.findFirst({ where: { pincode: d.pincode, plan_id: d.plan_id, is_available: true, plan: { is_active: true } } }) : null,
      this.prisma.lead.findFirst({ where: { customer_phone: phone, pincode: d.pincode, status: { in: OPEN } } }),
      actor?.role === 'customer' ? null : this.prisma.user.findUnique({ where: { role_phone: { role: 'customer', phone } } }),
      this.settings.getBool('auto_assign'),
    ]);
    if (d.plan_id && !planOk) throw new BadRequestException('This plan is not available in your PIN code');
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
    if (!customer_user_id) customer_user_id = existingCustomer ? Number(existingCustomer.id) : null;
    const tip = autoAssign ? await this.pickTip(d.pincode) : null;

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
    if (q.due) { const t = new Date(); and.push({ status: 'followup', followup_at: { lt: new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1)) } }); }
    if (q.statuses) { const ok = ['new', 'contacted', 'followup', 'scheduled', 'installed', 'lost', 'cancelled']; and.push({ status: { in: q.statuses.split(',').filter((x) => ok.includes(x)) as LeadStatus[] } }); }
    if (q.open) and.push({ status: { in: ['new', 'contacted', 'followup', 'scheduled'] } });
    if (u.role === 'admin') {
      if (q.tip_user_id) and.push({ tip_user_id: q.tip_user_id });
      if (q.brought_by_user_id) and.push({ brought_by_user_id: q.brought_by_user_id });
    }
    // "New" vs "Assigned" in every portal (the role scope above still limits which leads are visible)
    if (q.unassigned) and.push({ brought_by_user_id: null, tip_user_id: null });
    if (q.assigned) and.push({ OR: [{ brought_by_user_id: { not: null } }, { tip_user_id: { not: null } }] });
    if (q.q) {
      const s = q.q.trim();
      // a full reference code ("CB-000142") is matched on the unique ref_code index; other text goes through the full-text index
      // (any fragment of 2+ characters, e.g. the middle digits of a phone); a 1-character search keeps the slow "contains" filter
      const ids = /^CB-\d{6,}$/i.test(s) ? null : await fulltextIds(this.prisma, 'leads', s);
      if (/^CB-\d{6,}$/i.test(s)) and.push({ ref_code: s.toUpperCase() });
      else if (ids) and.push({ id: { in: ids } });
      else and.push({ OR: [{ customer_name: { contains: s } }, { customer_phone: { contains: s } }, { ref_code: { contains: s } }] });
    }
    const where: Prisma.LeadWhereInput = { AND: and };
    if (q.sort === 'followup') {
      // MySQL has no NULLS LAST: leads with a follow-up date (earliest first), then the rest by last update
      const take = Math.min(q.limit ?? 25, 50);
      const [dated, total] = await Promise.all([
        this.prisma.lead.findMany({ where: { AND: [where, { followup_at: { not: null } }] }, orderBy: [{ followup_at: 'asc' }, { updated_at: 'desc' }], include: leadInclude, relationLoadStrategy: 'join', take }),
        this.prisma.lead.count({ where }),
      ]);
      const rest = dated.length < take ? await this.prisma.lead.findMany({ where: { AND: [where, { followup_at: null }] }, orderBy: { updated_at: 'desc' }, include: leadInclude, relationLoadStrategy: 'join', take: take - dated.length }) : [];
      return paged([...dated, ...rest], total, q);
    }
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({ where, orderBy: { id: 'desc' }, include: leadInclude, relationLoadStrategy: 'join', ...pageArgs(q) }),
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

  /**
   * Admin sets the DSA and/or the TIP. The DSA is stored in brought_by_user_id, which drives the DSA's
   * dashboard, reports and the install payout, so the payout goes to the DSA assigned at install time.
   * The lead keeps its original `source`. The DSA can't change once a booking is scheduled.
   */
  async assign(id: number, d: AssignDto, u: AuthUser) {
    const setDsa = d.dsa_user_id !== undefined, setTip = d.tip_user_id != null;
    if (!setDsa && !setTip) throw new BadRequestException('Choose a DSA or a TIP partner');
    const lead = await this.getScoped(id, u);
    if (lead.status === 'installed') throw new BadRequestException('Installed leads cannot be reassigned');

    const curDsa = lead.brought_by_user_id != null ? Number(lead.brought_by_user_id) : null;
    const newDsa = setDsa ? (d.dsa_user_id ?? null) : curDsa;
    const dsaChanged = newDsa !== curDsa;
    let dsa: { id: bigint; name: string; phone: string } | null = null;
    if (dsaChanged) {
      if (newDsa !== null) {
        dsa = await this.prisma.user.findFirst({ where: { id: newDsa, role: 'dsa', partner_status: 'approved', is_active: true }, select: { id: true, name: true, phone: true } });
        if (!dsa) throw new BadRequestException('dsa_user_id is not an approved, active DSA');
      }
      const booked = lead.status === 'scheduled' || await this.prisma.booking.findFirst({ where: { lead_id: id, status: { in: ['scheduled', 'rescheduled', 'completed'] } }, select: { id: true } });
      if (booked) throw new BadRequestException('The DSA cannot be changed after a booking is scheduled');
    }
    let tip: { id: bigint } | null = null;
    if (setTip && d.tip_user_id !== (lead.tip_user_id != null ? Number(lead.tip_user_id) : null)) {
      tip = await this.prisma.user.findFirst({ where: { id: d.tip_user_id, role: 'tip', partner_status: 'approved', is_active: true }, select: { id: true } });
      if (!tip) throw new BadRequestException('tip_user_id is not an approved TIP');
      // the booking keeps its installer, so the lead's TIP may not drift away from it
      const booked = await this.prisma.booking.findFirst({ where: { lead_id: id, status: { in: ['scheduled', 'rescheduled'] } }, select: { id: true } });
      if (booked) throw new BadRequestException('Cancel or reschedule the booking before changing the TIP');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.LeadUncheckedUpdateInput = {};
      if (dsaChanged) data.brought_by_user_id = newDsa;
      if (tip) data.tip_user_id = tip.id;
      const l = Object.keys(data).length ? await tx.lead.update({ where: { id }, data, include: leadInclude }) : lead;
      if (dsaChanged) await this.log(tx, id, u.id, 'assigned', { note: newDsa ? `dsa_user_id=${newDsa}${curDsa ? ` (was ${curDsa})` : ''}` : `dsa removed (was ${curDsa})` });
      if (tip) await this.log(tx, id, u.id, 'assigned', { note: `tip_user_id=${tip.id}` });
      return l;
    });

    if (dsa) {
      await this.notify.send({ user_id: Number(dsa.id), phone: dsa.phone, template: 'dsa_lead_assigned', payload: {
        name: dsa.name, customer: updated.customer_name, customer_phone: updated.customer_phone, product: productName(updated.plan),
        area: updated.area?.name ?? updated.pincode, ref_code: updated.ref_code } });
    }
    return updated;
  }

  /**
   * Admin edit of a lead's details, in any status (installed, lost and cancelled included). The status itself, the DSA and the TIP
   * keep their own rules: installed / scheduled only come from bookings, and assignment has its own locks.
   */
  async adminUpdate(id: number, d: UpdateLeadDto, u: AuthUser) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    const data: Prisma.LeadUncheckedUpdateInput = {};
    const changed: string[] = [];
    if (d.customer_name !== undefined && d.customer_name.trim() !== lead.customer_name) { data.customer_name = d.customer_name.trim(); changed.push('name'); }
    if (d.customer_phone !== undefined) {
      const phone = normalizePhone(d.customer_phone);
      if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');
      if (phone !== lead.customer_phone) { data.customer_phone = phone; changed.push('mobile'); }
    }
    if (d.customer_email !== undefined) {
      const email = d.customer_email.trim() || null;
      if (email !== lead.customer_email) { data.customer_email = email; changed.push('email'); }
    }
    if (d.address !== undefined) {
      const address = d.address.trim() || null;
      if (address !== lead.address) { data.address = address; changed.push('address'); }
    }
    if (d.notes !== undefined && d.notes !== lead.notes) { data.notes = d.notes; changed.push('notes'); }
    if (d.plan_id !== undefined && (d.plan_id ?? null) !== (lead.plan_id != null ? Number(lead.plan_id) : null)) {
      if (d.plan_id !== null && !(await this.prisma.plan.findUnique({ where: { id: d.plan_id }, select: { id: true } }))) throw new BadRequestException('plan_id does not exist');
      data.plan_id = d.plan_id; changed.push('plan');
    }
    // PIN code and area: an area must belong to the lead's PIN code; changing the PIN drops an area that no longer fits
    const pincode = d.pincode ?? lead.pincode;
    let areaId: number | null = d.area_id !== undefined ? d.area_id : (lead.area_id != null ? Number(lead.area_id) : null);
    if (areaId !== null) {
      const area = await this.prisma.area.findUnique({ where: { id: areaId }, select: { pincode: true } });
      if (!area) throw new BadRequestException('area_id does not exist');
      if (area.pincode !== pincode) {
        if (d.area_id !== undefined && d.area_id !== null) throw new BadRequestException('area_id does not belong to this PIN code');
        areaId = null;   // the PIN code changed and the old area no longer fits
      }
    }
    if (pincode !== lead.pincode) { data.pincode = pincode; changed.push('PIN code'); }
    if (areaId !== (lead.area_id != null ? Number(lead.area_id) : null)) { data.area_id = areaId; changed.push('area'); }
    if (!changed.length) return this.prisma.lead.findUnique({ where: { id }, include: leadInclude });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({ where: { id }, data, include: leadInclude });
      await this.log(tx, id, u.id, 'edited', { note: `Admin edited: ${changed.join(', ')}` });
      return updated;
    });
  }

  /**
   * Admin: permanently delete a lead in any status. Its bookings, payout, care-plan modem and chat go with it; invoices and payments
   * are kept as money records but unlinked from the lead; support tickets are kept and unlinked. One transaction, so it is all or nothing.
   */
  async adminDelete(id: number) {
    const lead = await this.prisma.lead.findUnique({ where: { id }, select: { id: true, ref_code: true } });
    if (!lead) throw new NotFoundException('Lead not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.chatMessage.deleteMany({ where: { thread_type: 'lead', thread_id: id } });
      await tx.chatRead.deleteMany({ where: { thread_type: 'lead', thread_id: id } });
      await tx.ticket.updateMany({ where: { lead_id: id }, data: { lead_id: null } });
      await tx.chargeLead.deleteMany({ where: { lead_id: id } });
      await tx.charge.updateMany({ where: { lead_id: id }, data: { lead_id: null, install_fee_key: null } });
      await tx.commission.deleteMany({ where: { lead_id: id } });   // before bookings: a payout points at its booking
      await tx.booking.deleteMany({ where: { lead_id: id } });
      await tx.carePlanDevice.deleteMany({ where: { lead_id: id } });   // its modem actions and speed tests go with it
      await tx.lead.delete({ where: { id } });   // lead events go with it
    });
    return { deleted: true, id, ref_code: lead.ref_code };
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
