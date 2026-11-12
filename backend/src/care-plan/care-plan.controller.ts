import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, ServiceUnavailableException, HttpCode, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { PageQuery, pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { leadScope } from '../common/utils/scope';
import { CarePlanSyncService } from './care-plan-sync.service';
import { JobsService } from '../common/jobs/jobs.service';
import { GenieAcsProvider } from './genieacs.provider';
import { DEVICE_ACTION_JOB } from './device-action.runner';
import { SPEED_TEST_JOB } from './speed-test.runner';

class ActionDto {
  @IsIn(['reboot', 'change_wifi', 'factory_reset', 'refresh']) action: 'reboot' | 'change_wifi' | 'factory_reset' | 'refresh';
  @IsOptional() @IsObject() params?: { ssid?: string; password?: string };
}
class UpdateDeviceDto {
  @IsOptional() @IsString() @MaxLength(60) serial_number?: string;
  @IsOptional() @IsString() @MaxLength(20) mac_address?: string;
  @IsOptional() @IsString() @MaxLength(80) model?: string;
  @IsOptional() @IsString() @MaxLength(120) genieacs_device_id?: string;
}

class DeviceQuery extends PageQuery { @IsOptional() @IsString() lead_ids?: string; }

@ApiTags('care-plan') @ApiBearerAuth() @Controller('care-plan')
export class CarePlanController {
  constructor(private prisma: PrismaService, private acs: GenieAcsProvider, private sync: CarePlanSyncService, private jobs: JobsService) {}

  private scope(u: AuthUser): Prisma.CarePlanDeviceWhereInput { return u.role === 'admin' ? {} : { lead: leadScope(u) , ...(u.role === 'dsa' ? { id: -1 } : {}) }; }
  private async device(id: number, u: AuthUser) {
    const d = await this.prisma.carePlanDevice.findFirst({ where: { AND: [{ id }, this.scope(u)] }, include: { lead: { select: { ref_code: true, customer_name: true, pincode: true } } } });
    if (!d) throw new NotFoundException('Device not found');
    return d;
  }

  @Get('devices') async list(@Query() q: DeviceQuery, @CurrentUser() u: AuthUser) {
    const ids = q.lead_ids ? q.lead_ids.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200) : null;
    const where: Prisma.CarePlanDeviceWhereInput = ids ? { AND: [this.scope(u), { lead_id: { in: ids } }] } : this.scope(u);
    const [items, total] = await Promise.all([
      this.prisma.carePlanDevice.findMany({ where, orderBy: { id: 'desc' }, include: { lead: { select: { ref_code: true, customer_name: true } } }, ...pageArgs(q) }),
      this.prisma.carePlanDevice.count({ where }),
    ]);
    return paged(items, total, q);
  }

  /** Care plan page numbers (installed / online / offline / weak / not linked, by PIN code, and linked modems per TIP) without sending any device rows. */
  @Roles('admin', 'tip', 'customer') @Get('summary') async summary(@CurrentUser() u: AuthUser) {
    const who = u.role === 'admin' ? Prisma.sql`1=1` : u.role === 'tip' ? Prisma.sql`l.tip_user_id = ${u.id}` : Prisma.sql`(l.customer_user_id = ${u.id} OR l.customer_phone = ${u.phone ?? ''})`;
    const rows = await this.prisma.$queryRaw<{ pincode: string | null; n: bigint; linked: any; on_: any; off_: any; weak: any }[]>`
      SELECT l.pincode pincode, COUNT(*) n,
        SUM(b.router_serial IS NOT NULL AND d.id IS NOT NULL) linked, SUM(d.online = 1) on_, SUM(d.online = 0) off_, SUM(d.rx_power_dbm < -25) weak
      FROM bookings b JOIN leads l ON l.id = b.lead_id LEFT JOIN care_plan_devices d ON d.lead_id = l.id
      WHERE b.status = 'completed' AND ${who} GROUP BY l.pincode`;
    const num = (v: any) => Number(v ?? 0);
    const tot = rows.reduce((a, r) => ({ installed: a.installed + num(r.n), linked: a.linked + num(r.linked), online: a.online + num(r.on_), offline: a.offline + num(r.off_), weak: a.weak + num(r.weak) }), { installed: 0, linked: 0, online: 0, offline: 0, weak: 0 });
    const tips = u.role === 'admin' ? await this.prisma.carePlanDevice.groupBy({ by: ['tip_user_id'], _count: { _all: true } }) : [];
    return { ...tot, unlinked: tot.installed - tot.linked, zones: rows.filter((r) => r.pincode).map((r) => ({ pincode: r.pincode, n: num(r.n), on: num(r.on_), off: num(r.off_), weak: num(r.weak) })), tips: Object.fromEntries(tips.map((t) => [String(t.tip_user_id), t._count._all])) };
  }

  @Get('devices/:id') async one(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    const d = await this.device(id, u);
    const [actions, speed_tests] = await Promise.all([
      this.prisma.deviceAction.findMany({ where: { care_plan_device_id: id }, orderBy: { id: 'desc' }, take: 20 }),
      this.prisma.speedTest.findMany({ where: { care_plan_device_id: id }, orderBy: { id: 'desc' }, take: 10 }),
    ]);
    return { ...d, actions, speed_tests, simulated: this.acs.isMock };
  }

  /** TIP / admin attach the modem identity after installation. */
  @Roles('tip', 'admin') @Patch('devices/:id') async update(@Param('id', ParseIntPipe) id: number, @Body() d: UpdateDeviceDto, @CurrentUser() u: AuthUser) {
    await this.device(id, u);
    // one physical modem belongs to one customer: refuse a GenieACS id or serial that another record already has
    for (const [field, value] of [['genieacs_device_id', d.genieacs_device_id], ['serial_number', d.serial_number]] as const) {
      if (!value) continue;
      const taken = await this.prisma.carePlanDevice.findFirst({ where: { [field]: value, NOT: { id } }, select: { lead: { select: { ref_code: true } } } });
      if (taken) throw new ConflictException(`This modem is already linked to ${taken.lead.ref_code}. Unlink it there first.`);
    }
    return this.prisma.carePlanDevice.update({ where: { id }, data: d });
  }

  /** Admin: customers whose installation has a Care Plan record but no modem linked yet (candidates for the "Link" action). */
  @Roles('admin') @Get('link-candidates')
  async linkCandidates() {
    const rows = await this.prisma.carePlanDevice.findMany({
      where: { genieacs_device_id: null, is_active: true },
      select: { id: true, serial_number: true, lead: { select: { ref_code: true, customer_name: true, customer_phone: true } } },
      orderBy: { id: 'desc' }, take: 200,
    });
    return { items: rows };
  }

  @Post('devices/:id/refresh') @HttpCode(200)
  async refresh(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    const d = await this.device(id, u);
    return this.sync.pollOne(d);
  }

  /** Customer, TIP or admin. Answers 202 at once with a row (queued / sent); the modem runs it at its next check-in and a background job sets the row to done or failed. The Wi-Fi password is sent to GenieACS only, never stored. */
  @Post('devices/:id/actions') @HttpCode(202)
  async action(@Param('id', ParseIntPipe) id: number, @Body() d: ActionDto, @CurrentUser() u: AuthUser) {
    const dev = await this.device(id, u);
    if (u.role === 'dsa') throw new ForbiddenException();
    if (!dev.is_active) throw new BadRequestException('Care Plan is not active for this device');
    if (d.action === 'change_wifi' && !d.params?.ssid) throw new BadRequestException('params.ssid is required');
    // commands that reach the modem need it to be known to GenieACS (its device id or the ONT serial scanned at install)
    // and not reported offline; 'refresh' stays allowed so the status can recover
    if (d.action !== 'refresh') {
      if (!dev.genieacs_device_id && !dev.serial_number) throw new BadRequestException('The router is not linked yet. Your installer links it at installation.');
      if (dev.online === false) throw new BadRequestException('The router is offline. Restart and Wi-Fi change need it online.');
    }
    // one command of a kind at a time: a second click while the first still waits for the modem would restart it twice
    const open = await this.prisma.deviceAction.findFirst({ where: { care_plan_device_id: id, action: d.action, status: { in: ['queued', 'sent'] }, created_at: { gt: new Date(Date.now() - 20 * 60_000) } }, select: { id: true } });
    if (open) throw new ConflictException('This command is already waiting for the modem. It runs when the modem next checks in.');
    const stored = d.params ? { ssid: d.params.ssid } : undefined;   // the password is never stored
    const row = await this.prisma.deviceAction.create({ data: { care_plan_device_id: id, requested_by: u.id, action: d.action, params: stored as Prisma.InputJsonValue | undefined, status: 'queued' } });
    // Hand it to GenieACS now (a few seconds at most) and answer. The modem collects it at its next check-in (about a minute); a background job
    // follows it and sets the row to done / failed, so nobody waits on this request.
    let q: { executed: boolean; taskId: string | null };
    try { q = await this.acs.queueAction(dev.genieacs_device_id ?? dev.serial_number ?? `dev-${id}`, d.action, d.params); }
    catch (e: any) { return this.prisma.deviceAction.update({ where: { id: row.id }, data: { status: 'failed', error: 'GenieACS could not be reached', completed_at: new Date() } }); }
    if (q.executed && d.action !== 'reboot') return this.prisma.deviceAction.update({ where: { id: row.id }, data: { status: 'done', completed_at: new Date() } });   // the modem answered at once
    await this.prisma.deviceAction.update({ where: { id: row.id }, data: { status: 'sent' } });
    await this.jobs.enqueue(DEVICE_ACTION_JOB, { action_id: String(row.id), task_id: q.taskId }, { maxAttempts: 1 });
    return this.prisma.deviceAction.findUnique({ where: { id: row.id } });
  }

  /**
   * Starts the modem's own line test and answers AT ONCE (202) with a row whose status is "running". The test itself runs in the
   * background job queue (1-3 minutes: the modem only checks in about once a minute) and the job writes the numbers to the same row
   * (status "done", or "failed" with the reason). Screens read GET /care-plan/devices/:id -> speed_tests. Mock mode finishes immediately, flagged simulated.
   */
  @Post('devices/:id/speed-test') @HttpCode(202)
  async speed(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    const dev = await this.device(id, u);
    if (!dev.is_active) throw new BadRequestException('Care Plan is not active for this device');
    if (!this.acs.isMock && !dev.genieacs_device_id) throw new BadRequestException('The router is not linked yet. Your installer links it at installation.');
    // a test whose job died never finishes: after 10 minutes it is closed as failed so the next one can start
    await this.prisma.speedTest.updateMany({ where: { care_plan_device_id: id, status: 'running', tested_at: { lt: new Date(Date.now() - 10 * 60_000) } }, data: { status: 'failed', error: 'The test did not finish in time' } });
    if (await this.prisma.speedTest.findFirst({ where: { care_plan_device_id: id, status: 'running' }, select: { id: true } })) throw new ConflictException('A speed test is already running on this modem.');
    const row = await this.prisma.speedTest.create({ data: { care_plan_device_id: id, status: 'running' } });
    await this.jobs.enqueue(SPEED_TEST_JOB, { speed_test_id: String(row.id) }, { maxAttempts: 1 });
    return { ...(await this.prisma.speedTest.findUnique({ where: { id: row.id } })), simulated: this.acs.isMock };   // in tests the job has already run, so this is the finished row
  }

  /** Admin: every modem GenieACS knows, with the customer it is linked to (or none). Read-only; for the "Fetch from GenieACS" button. */
  @Roles('admin') @Get('acs-devices')
  async acsDevices() {
    let items;
    try { items = await this.acs.listDevices(); } catch { throw new ServiceUnavailableException('GenieACS could not be reached. Check /api/v1/health/acs.'); }
    const linked = await this.prisma.carePlanDevice.findMany({ select: { genieacs_device_id: true, serial_number: true, lead: { select: { ref_code: true, customer_name: true } } } });
    const byId = new Map(), bySerial = new Map();
    linked.forEach((l) => { if (l.genieacs_device_id) byId.set(l.genieacs_device_id, l.lead); if (l.serial_number) bySerial.set(l.serial_number, l.lead); });
    return { mock: this.acs.isMock, total: items.length, items: items.map((d) => ({ ...d, linked_to: byId.get(d.id) ?? (d.serial ? bySerial.get(d.serial) : undefined) ?? null })) };
  }

  /** Admin / scheduler: refresh every ACTIVE device (Care Plan only). The server also does this by itself every CARE_PLAN_SYNC_MINUTES (default 10). */
  @Roles('admin') @Post('poll') @HttpCode(200)
  poll() { return this.sync.pollAll(); }
}
