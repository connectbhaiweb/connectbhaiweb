import { BadRequestException, Body, Controller, ForbiddenException, Get, ServiceUnavailableException, HttpCode, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { PageQuery, pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { leadScope } from '../common/utils/scope';
import { CarePlanSyncService } from './care-plan-sync.service';
import { GenieAcsProvider } from './genieacs.provider';

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
  constructor(private prisma: PrismaService, private acs: GenieAcsProvider, private sync: CarePlanSyncService) {}

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
    return { ...d, actions, speed_tests };
  }

  /** TIP / admin attach the modem identity after installation. */
  @Roles('tip', 'admin') @Patch('devices/:id') async update(@Param('id', ParseIntPipe) id: number, @Body() d: UpdateDeviceDto, @CurrentUser() u: AuthUser) {
    await this.device(id, u);
    return this.prisma.carePlanDevice.update({ where: { id }, data: d });
  }

  @Post('devices/:id/refresh') @HttpCode(200)
  async refresh(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    const d = await this.device(id, u);
    return this.sync.pollOne(d);
  }

  /** Customer, TIP or admin. Wi-Fi password is sent to the modem but never stored. */
  @Post('devices/:id/actions')
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
    const stored = d.params ? { ssid: d.params.ssid } : undefined;
    const row = await this.prisma.deviceAction.create({ data: { care_plan_device_id: id, requested_by: u.id, action: d.action, params: stored as Prisma.InputJsonValue | undefined } });
    const res = await this.acs.runAction(dev.genieacs_device_id ?? dev.serial_number ?? `dev-${id}`, d.action, d.params);
    return this.prisma.deviceAction.update({ where: { id: row.id }, data: { status: res.ok ? 'done' : 'failed', error: res.error, completed_at: new Date() } });
  }

  @Post('devices/:id/speed-test')
  async speed(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    const dev = await this.device(id, u);
    if (!dev.is_active) throw new BadRequestException('Care Plan is not active for this device');
    const r = await this.acs.speedTest(dev.genieacs_device_id ?? dev.serial_number ?? `dev-${id}`);
    return this.prisma.speedTest.create({ data: { care_plan_device_id: id, ...r } });
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
