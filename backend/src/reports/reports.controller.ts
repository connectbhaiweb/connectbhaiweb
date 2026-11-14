import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ticketScope } from '../tickets/tickets.controller';
import { leadScope } from '../common/utils/scope';

/* Reports group by IST calendar month (Connect Bhai runs in India). Times are stored in UTC, so a lead made at
   00:30 IST on the 1st must count in the new month, not the old one. */
const IST_MS = 330 * 60_000;
/** the current IST wall clock, read it with getUTC* */
const istNow = () => new Date(Date.now() + IST_MS);
/** the UTC instant of IST midnight on the 1st of month key 'YYYY-MM' */
const istMonthStart = (key: string) => new Date(Date.parse(key + '-01T00:00:00.000Z') - IST_MS);
/** 'YYYY-MM' of an IST date shifted `back` months from now */
const istKey = (back: number) => { const n = istNow(); const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - back, 1)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
/** SQL: the IST 'YYYY-MM' of a UTC datetime column (fixed column names only, never user input) */
const istMonth = (col: string) => Prisma.sql`DATE_FORMAT(CONVERT_TZ(${Prisma.raw(col)}, '+00:00', '+05:30'), '%Y-%m')`;

class DashQuery { @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) months?: number = 6; @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pins?: number = 4; }
class IdsQuery { @IsString() ids: string; }
class TopQuery { @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20; }

@ApiTags('reports') @ApiBearerAuth() @Controller('reports')
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  /** Dashboard numbers for whoever is logged in (scoped by role). */
  @Get('me') async me(@CurrentUser() u: AuthUser) {
    const [byStatus, extra, open_tickets] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['status'], where: leadScope(u), _count: { _all: true } }),
      this.roleExtras(u),
      this.prisma.ticket.count({ where: { raised_by: u.id, status: { in: ['open', 'in_progress'] } } }),
    ]);
    const leads = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
    const out: Record<string, any> = { leads, leads_total: byStatus.reduce((a, s) => a + s._count._all, 0) };
    Object.assign(out, extra, { open_tickets });
    return out;
  }


  /**
   * Everything the dashboards used to compute in the browser from full lists, scoped to the caller by role:
   * lead / booking / ticket counts by status, leads and installs per month, leads and installs per PIN,
   * commission and charge totals. One round trip, a handful of GROUP BY queries.
   */
  @Get('dashboard') async dashboard(@CurrentUser() u: AuthUser, @Query() q: DashQuery) {
    const months = q.months ?? 6, topPins = q.pins ?? 4;
    const keys: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) keys.push(istKey(i));
    const from = istMonthStart(keys[0]);
    const scope = leadScope(u);
    const bookingWhere: Prisma.BookingWhereInput = u.role === 'admin' ? {} : { lead: scope };
    const monthStart = istMonthStart(keys[keys.length - 1]);

    // raw GROUP BY helpers (MySQL). Scope is applied through lead ids / partner columns, never string-built from input.
    const leadCond = u.role === 'admin' ? Prisma.sql`1=1` : u.role === 'tip' ? Prisma.sql`l.tip_user_id = ${u.id}` : u.role === 'dsa' ? Prisma.sql`l.brought_by_user_id = ${u.id}`
      : Prisma.sql`(l.customer_user_id = ${u.id}${u.phone ? Prisma.sql` OR l.customer_phone = ${u.phone}` : Prisma.empty})`;
    const [leadMonths, installMonths, pinLeads, pinInstalls, leadStatus, bookingStatus, ticketStatus, extra, partnersTotals] = await Promise.all([
      this.prisma.$queryRaw<{ m: string; n: bigint }[]>`SELECT ${istMonth('l.created_at')} m, COUNT(*) n FROM leads l WHERE ${leadCond} AND l.created_at >= ${from} GROUP BY m`,
      this.prisma.$queryRaw<{ m: string; n: bigint }[]>`SELECT ${istMonth('b.completed_at')} m, COUNT(*) n FROM bookings b JOIN leads l ON l.id = b.lead_id WHERE ${leadCond} AND b.status = 'completed' AND b.completed_at >= ${from} GROUP BY m`,
      this.prisma.$queryRaw<{ pincode: string; n: bigint }[]>`SELECT l.pincode, COUNT(*) n FROM leads l WHERE ${leadCond} GROUP BY l.pincode ORDER BY n DESC, l.pincode LIMIT ${topPins}`,
      this.prisma.$queryRaw<{ pincode: string; n: bigint }[]>`SELECT l.pincode, COUNT(*) n FROM bookings b JOIN leads l ON l.id = b.lead_id WHERE ${leadCond} AND b.status = 'completed' GROUP BY l.pincode`,
      this.prisma.lead.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
      this.prisma.booking.groupBy({ by: ['status'], where: bookingWhere, _count: { _all: true } }),
      this.prisma.ticket.groupBy({ by: ['status'], where: ticketScope(u), _count: { _all: true } }),
      this.roleExtras(u),
      u.role === 'admin' ? this.prisma.user.groupBy({ by: ['role', 'partner_status'], where: { role: { in: ['dsa', 'tip'] } }, _count: { _all: true } }) : Promise.resolve([]),
    ]);
    const areaRows = pinLeads.length ? await this.prisma.area.findMany({ where: { pincode: { in: pinLeads.map((r) => r.pincode) } }, select: { pincode: true, name: true }, orderBy: { id: 'asc' } }) : [];
    const nOf = (rows: { m: string; n: bigint }[]) => new Map(rows.map((r) => [r.m, Number(r.n)]));
    const lm = nOf(leadMonths), im = nOf(installMonths);
    const instByPin = new Map(pinInstalls.map((r) => [r.pincode, Number(r.n)]));
    // installs this month (always included, even if the chart window is shorter than one month: it is not)
    const installs_month = im.get(keys[keys.length - 1]) ?? 0;
    const bookings = Object.fromEntries(bookingStatus.map((s) => [s.status, s._count._all]));
    const leads = Object.fromEntries(leadStatus.map((s) => [s.status, s._count._all]));
    const tickets = Object.fromEntries(ticketStatus.map((s) => [s.status, s._count._all]));
    const [unassigned, leads_month] = await Promise.all([
      u.role === 'admin' ? this.prisma.lead.count({ where: { status: 'new', tip_user_id: null } }) : Promise.resolve(0),
      this.prisma.lead.count({ where: { AND: [scope, { created_at: { gte: monthStart } }] } }),
    ]);
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const [given, givenMonth, billing, followups_due] = await Promise.all([
      this.prisma.lead.count({ where: { AND: [scope, { source: { not: 'dsa' } }] } }),
      this.prisma.lead.count({ where: { AND: [scope, { source: { not: 'dsa' } }, { created_at: { gte: monthStart } }] } }),
      this.prisma.$queryRaw<{ s: unknown }[]>`SELECT COALESCE(SUM(p.price), 0) s FROM bookings b JOIN leads l ON l.id = b.lead_id JOIN plans p ON p.id = l.plan_id WHERE ${leadCond} AND b.status = 'completed'`,
      this.prisma.lead.count({ where: { AND: [scope, { status: 'followup', followup_at: { lt: tomorrow } }] } }),
    ]);
    return {
      leads, leads_total: leadStatus.reduce((a, s) => a + s._count._all, 0), leads_month, followups_due, leads_given: given, leads_given_month: givenMonth, installs_billing: Number(billing[0]?.s ?? 0), unassigned,
      bookings, installs_total: bookings.completed ?? 0, installs_month, installs_pending: (bookings.scheduled ?? 0) + (bookings.rescheduled ?? 0),
      tickets, open_tickets: (tickets.open ?? 0) + (tickets.in_progress ?? 0),
      by_month: keys.map((k) => ({ month: k, leads: lm.get(k) ?? 0, installs: im.get(k) ?? 0 })),
      top_pins: pinLeads.map((r) => ({ pincode: r.pincode, leads: Number(r.n), installs: instByPin.get(r.pincode) ?? 0, areas: areaRows.filter((a) => a.pincode === r.pincode).map((a) => a.name) })),
      partners: partnersTotals.map((p: any) => ({ role: p.role, partner_status: p.partner_status, count: p._count._all })),
      ...extra,
    };
  }

  private async roleExtras(u: AuthUser): Promise<Record<string, any>> {
    if (u.role === 'dsa') {
      const c = await this.prisma.commission.groupBy({ by: ['status'], where: { dsa_user_id: u.id }, _sum: { amount: true }, _count: { _all: true } });
      return { commission: Object.fromEntries(c.map((x) => [x.status, Number(x._sum.amount ?? 0)])), commission_count: c.reduce((a, x) => a + x._count._all, 0) };
    }
    if (u.role === 'tip') {
      const [c, devices] = await Promise.all([
        this.prisma.charge.groupBy({ by: ['status'], where: { payer_user_id: u.id }, _sum: { total_amount: true }, _count: { _all: true }, _max: { paid_at: true } }),
        this.prisma.carePlanDevice.count({ where: { tip_user_id: u.id, is_active: true } }),
      ]);
      return { charges: Object.fromEntries(c.map((x) => [x.status, Number(x._sum.total_amount ?? 0)])), charges_count: Object.fromEntries(c.map((x) => [x.status, x._count._all])), last_paid_at: c.find((x) => x.status === 'paid')?._max.paid_at ?? null, care_plan_devices: devices };
    }
    if (u.role === 'admin') {
      const [c, tipFees] = await Promise.all([
        this.prisma.commission.groupBy({ by: ['status'], _sum: { amount: true }, _count: { _all: true } }),
        this.prisma.charge.aggregate({ where: { payer: { role: { not: 'customer' } }, status: { notIn: ['waived', 'cancelled'] } }, _sum: { base_amount: true } }),
      ]);
      return { commission: Object.fromEntries(c.map((x) => [x.status, Number(x._sum.amount ?? 0)])), commission_count: c.reduce((a, x) => a + x._count._all, 0), tip_fee_base: Number(tipFees._sum.base_amount ?? 0) };
    }
    return {};
  }

  /** Just the numbers shown on the admin tabs (three COUNT queries), so the dashboard does not have to load whole lists. */
  @Roles('admin') @Get('badges') async badges() {
    const [new_leads, pending_partners, waiting] = await Promise.all([
      this.prisma.lead.count({ where: { status: 'new' } }),
      this.prisma.user.count({ where: { partner_status: 'pending' } }),
      this.prisma.waitlist.count({ where: { notified_at: null } }),
    ]);
    return { new_leads, pending_partners, waiting };
  }

  @Roles('admin') @Get('overview') async overview() {
    const [users, leads, charges, commissions, tickets, devices, pendingPartners] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.charge.groupBy({ by: ['kind', 'status'], _sum: { total_amount: true, base_amount: true }, _count: { _all: true } }),
      this.prisma.commission.groupBy({ by: ['status'], _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.carePlanDevice.count({ where: { is_active: true } }),
      this.prisma.user.count({ where: { partner_status: 'pending' } }),
    ]);
    return {
      users: Object.fromEntries(users.map((x) => [x.role, x._count._all])),
      pending_partner_approvals: pendingPartners,
      leads: Object.fromEntries(leads.map((x) => [x.status, x._count._all])),
      charges: charges.map((x) => ({ kind: x.kind, status: x.status, count: x._count._all, total: Number(x._sum.total_amount ?? 0), base: Number(x._sum.base_amount ?? 0) })),
      commissions: commissions.map((x) => ({ status: x.status, count: x._count._all, total: Number(x._sum.amount ?? 0) })),
      tickets: Object.fromEntries(tickets.map((x) => [x.status, x._count._all])),
      care_plan_devices_active: devices,
    };
  }

  @Roles('admin') @Get('leads-by-pincode') async byPincode(@Query() q: TopQuery) {
    const rows = await this.prisma.lead.groupBy({ by: ['pincode'], _count: { _all: true }, orderBy: { _count: { pincode: 'desc' } }, take: q.limit });
    return rows.map((r) => ({ pincode: r.pincode, leads: r._count._all }));
  }

  /** Admin → Customers list: for the customers on the current page, how many requests each made and the latest one. */
  @Roles('admin') @Get('customers') async customers(@Query() q: IdsQuery) {
    const ids = [...new Set(q.ids.split(',').map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200);
    if (!ids.length) return [];
    const counts = await this.prisma.lead.groupBy({ by: ['customer_user_id'], where: { customer_user_id: { in: ids } }, _count: { _all: true }, _max: { id: true } });
    // newest lead per customer = the max id of each group: one row per customer
    const latest = await this.prisma.lead.findMany({ where: { id: { in: counts.map((x) => x._max.id!).filter(Boolean) } }, include: { area: { select: { name: true } }, plan: { include: { category: true } } } });
    const by = new Map(latest.map((l) => [Number(l.customer_user_id), l]));
    return counts.map((c) => ({ customer_user_id: Number(c.customer_user_id), requests: c._count._all, latest: by.get(Number(c.customer_user_id)) ?? null }));
  }

  /** Per-partner lead statuses plus installs, fees paid (TIP) and commission (DSA), so the admin people lists need no full tables. */
  @Roles('admin') @Get('partners') async partners() {
    const mStart = istMonthStart(istKey(0));
    const [tips, dsas, tipInst, dsaInst, tipPaid, dsaComm, tipMonth, dsaMonth] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['tip_user_id', 'status'], where: { tip_user_id: { not: null } }, _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['brought_by_user_id', 'status'], where: { brought_by_user_id: { not: null } }, _count: { _all: true } }),
      this.prisma.booking.groupBy({ by: ['tip_user_id'], where: { status: 'completed' }, _count: { _all: true } }),
      this.prisma.$queryRaw<{ id: bigint; n: bigint }[]>`SELECT l.brought_by_user_id id, COUNT(*) n FROM bookings b JOIN leads l ON l.id = b.lead_id WHERE b.status = 'completed' AND l.brought_by_user_id IS NOT NULL GROUP BY l.brought_by_user_id`,
      this.prisma.charge.groupBy({ by: ['payer_user_id'], where: { status: 'paid' }, _sum: { total_amount: true }, _count: { _all: true } }),
      this.prisma.commission.groupBy({ by: ['dsa_user_id', 'status'], where: { status: { not: 'cancelled' } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['tip_user_id'], where: { tip_user_id: { not: null }, created_at: { gte: mStart } }, _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['brought_by_user_id'], where: { brought_by_user_id: { not: null }, created_at: { gte: mStart } }, _count: { _all: true } }),
    ]);
    const tm = new Map(tipMonth.map((r) => [Number(r.tip_user_id), r._count._all])), dm = new Map(dsaMonth.map((r) => [Number(r.brought_by_user_id), r._count._all]));
    const fold = (rows: any[], key: string) => {
      const m = new Map<number, Record<string, number>>();
      for (const r of rows) { const id = Number(r[key]); m.set(id, { ...(m.get(id) ?? {}), [r.status]: r._count._all }); }
      return m;
    };
    const out = (m: Map<number, Record<string, number>>, extra: (id: number) => Record<string, number>) =>
      [...m.entries()].map(([user_id, statuses]) => ({ user_id, ...statuses, total: Object.values(statuses).reduce((a, b) => a + b, 0), ...extra(user_id) }));
    const ti = new Map(tipInst.map((r) => [Number(r.tip_user_id), r._count._all])), di = new Map(dsaInst.map((r) => [Number(r.id), Number(r.n)]));
    const tp = new Map(tipPaid.map((r) => [Number(r.payer_user_id), r]));
    const dc = new Map<number, { paid: number; count: number }>();
    for (const r of dsaComm) { const id = Number(r.dsa_user_id), c = dc.get(id) ?? { paid: 0, count: 0 }; c.count += r._count._all; if (r.status === 'paid') c.paid += Number(r._sum.amount ?? 0); dc.set(id, c); }
    return {
      tips: out(fold(tips, 'tip_user_id'), (id) => ({ leads_month: tm.get(id) ?? 0, installs: ti.get(id) ?? 0, paid_amount: Number(tp.get(id)?._sum.total_amount ?? 0), paid_count: tp.get(id)?._count._all ?? 0 })),
      dsas: out(fold(dsas, 'brought_by_user_id'), (id) => ({ leads_month: dm.get(id) ?? 0, installs: di.get(id) ?? 0, comm_paid: dc.get(id)?.paid ?? 0, comm_count: dc.get(id)?.count ?? 0 })),
    };
  }

  /** Admin → DSA payouts: approved commissions grouped per DSA (what is ready to pay), one row per DSA. */
  @Roles('admin') @Get('payables') async payables() {
    const g = await this.prisma.commission.groupBy({ by: ['dsa_user_id'], where: { status: 'approved' }, _sum: { amount: true }, _count: { _all: true } });
    if (!g.length) return [];
    const us = await this.prisma.user.findMany({ where: { id: { in: g.map((x) => x.dsa_user_id) } }, select: { id: true, name: true, phone: true } });
    const by = new Map(us.map((u) => [Number(u.id), u]));
    const ids = g.map((x) => x.dsa_user_id);
    const rows = await this.prisma.commission.findMany({ where: { status: 'approved', dsa_user_id: { in: ids } }, select: { id: true, dsa_user_id: true } });
    const idsBy = new Map<number, number[]>();
    for (const r of rows) { const k = Number(r.dsa_user_id); idsBy.set(k, [...(idsBy.get(k) ?? []), Number(r.id)]); }
    return g.map((x) => ({ dsa_user_id: Number(x.dsa_user_id), name: by.get(Number(x.dsa_user_id))?.name ?? '', count: x._count._all, total: Number(x._sum.amount ?? 0), ids: idsBy.get(Number(x.dsa_user_id)) ?? [] }));
  }

  /** Admin → Reports: money in (paid charges) and DSA commission paid out, by month and by kind, plus leads delivered to a partner by month. */
  @Roles('admin') @Get('money') async money(@Query() q: DashQuery) {
    const months = q.months ?? 6;
    const since = istMonthStart(istKey(months - 1));
    const [coll, out, kinds, delivered, due] = await Promise.all([
      this.prisma.$queryRaw<{ m: string; t: any }[]>`SELECT ${istMonth('paid_at')} m, SUM(total_amount) t FROM charges WHERE status = 'paid' AND paid_at >= ${since} GROUP BY m`,
      this.prisma.$queryRaw<{ m: string; t: any }[]>`SELECT ${istMonth('paid_at')} m, SUM(amount) t FROM commissions WHERE status = 'paid' AND paid_at >= ${since} GROUP BY m`,
      this.prisma.charge.groupBy({ by: ['kind'], where: { status: 'paid' }, _sum: { total_amount: true } }),
      this.prisma.$queryRaw<{ m: string; n: bigint }[]>`SELECT ${istMonth('created_at')} m, COUNT(*) n FROM leads WHERE (brought_by_user_id IS NOT NULL OR tip_user_id IS NOT NULL) AND created_at >= ${since} GROUP BY m`,
      this.prisma.charge.aggregate({ where: { status: { in: ['pending', 'failed'] } }, _sum: { total_amount: true } }),
    ]);
    return {
      collected: Object.fromEntries(coll.map((r) => [r.m, Number(r.t ?? 0)])), paid_out: Object.fromEntries(out.map((r) => [r.m, Number(r.t ?? 0)])),
      by_kind: Object.fromEntries(kinds.map((k) => [k.kind, Number(k._sum.total_amount ?? 0)])), delivered: Object.fromEntries(delivered.map((r) => [r.m, Number(r.n)])), due: Number(due._sum.total_amount ?? 0),
    };
  }
}
