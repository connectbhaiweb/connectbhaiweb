import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';
import { leadScope } from '../common/utils/scope';

class TopQuery { @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20; }

@ApiTags('reports') @ApiBearerAuth() @Controller('reports')
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  /** Dashboard numbers for whoever is logged in (scoped by role). */
  @Get('me') async me(@CurrentUser() u: AuthUser) {
    const byStatus = await this.prisma.lead.groupBy({ by: ['status'], where: leadScope(u), _count: { _all: true } });
    const leads = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
    const out: Record<string, any> = { leads, leads_total: byStatus.reduce((a, s) => a + s._count._all, 0) };
    if (u.role === 'dsa') {
      const c = await this.prisma.commission.groupBy({ by: ['status'], where: { dsa_user_id: u.id }, _sum: { amount: true } });
      out.commission = Object.fromEntries(c.map((x) => [x.status, Number(x._sum.amount ?? 0)]));
    }
    if (u.role === 'tip') {
      const c = await this.prisma.charge.groupBy({ by: ['status'], where: { payer_user_id: u.id }, _sum: { total_amount: true } });
      out.charges = Object.fromEntries(c.map((x) => [x.status, Number(x._sum.total_amount ?? 0)]));
      out.care_plan_devices = await this.prisma.carePlanDevice.count({ where: { tip_user_id: u.id, is_active: true } });
    }
    out.open_tickets = await this.prisma.ticket.count({ where: { raised_by: u.id, status: { in: ['open', 'in_progress'] } } });
    return out;
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
    const [users, leads, charges, commissions, tickets, devices] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.charge.groupBy({ by: ['kind', 'status'], _sum: { total_amount: true, base_amount: true }, _count: { _all: true } }),
      this.prisma.commission.groupBy({ by: ['status'], _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.carePlanDevice.count({ where: { is_active: true } }),
    ]);
    const pendingPartners = await this.prisma.user.count({ where: { partner_status: 'pending' } });
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

  @Roles('admin') @Get('partners') async partners() {
    const [tips, dsas] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['tip_user_id', 'status'], where: { tip_user_id: { not: null } }, _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['brought_by_user_id', 'status'], where: { brought_by_user_id: { not: null } }, _count: { _all: true } }),
    ]);
    const fold = (rows: any[], key: string) => {
      const m = new Map<number, Record<string, number>>();
      for (const r of rows) { const id = Number(r[key]); m.set(id, { ...(m.get(id) ?? {}), [r.status]: r._count._all }); }
      return [...m.entries()].map(([user_id, statuses]) => ({ user_id, ...statuses, total: Object.values(statuses).reduce((a, b) => a + b, 0) }));
    };
    return { tips: fold(tips, 'tip_user_id'), dsas: fold(dsas, 'brought_by_user_id') };
  }
}
