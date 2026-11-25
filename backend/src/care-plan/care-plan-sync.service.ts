import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { GenieAcsProvider } from './genieacs.provider';
import { ZabbixProvider } from './zabbix.provider';

type Linkable = { id: bigint; genieacs_device_id: string | null; serial_number: string | null; last_status?: Prisma.JsonValue | null; is_active?: boolean };

/**
 * True for an ONU whose status comes from Zabbix: it only reports Online / Offline and takes no commands.
 * Recorded in `last_status` together with the serial it was found by, so changing the serial starts the check again.
 */
export function isZabbixOnu(d: { genieacs_device_id?: string | null; serial_number?: string | null; last_status?: Prisma.JsonValue | null }) {
  const s = d.last_status as { source?: string; serial?: string } | null | undefined;
  return !d.genieacs_device_id && s?.source === 'zabbix' && s.serial === d.serial_number;
}

/**
 * Keeps the Care Plan screens current: every CARE_PLAN_SYNC_MINUTES (default 10; 0 turns it off) each active, linked modem is read
 * and its status saved (online, last seen, signal, Wi-Fi name, connected devices). Read-only towards the modem.
 * A modem is read from GenieACS; a serial GenieACS does not know is looked up in Zabbix (status only).
 * While GenieACS is not configured (mock mode) the timer writes nothing but real Zabbix statuses, so invented numbers are never saved.
 */
@Injectable()
export class CarePlanSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CarePlanSyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private prisma: PrismaService, private acs: GenieAcsProvider, private cfg: ConfigService, private zbx?: ZabbixProvider) {}

  onModuleInit() {
    if (this.cfg.get('APP_ENV') === 'test') return;   // tests call run() directly
    const minutes = Number(this.cfg.get('CARE_PLAN_SYNC_MINUTES') ?? 10);
    if (!(minutes > 0)) return;
    this.timer = setInterval(() => this.run().catch((e) => this.logger.error(e?.message)), minutes * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private get useZabbix() { return !!this.zbx?.isConfigured; }

  /** Reads one modem and saves its status. Throws if its system cannot be reached or does not know it (the saved status stays). */
  async pollOne(d: Linkable) {
    if (d.genieacs_device_id || !d.serial_number || !this.useZabbix) return this.pollAcs(d);
    // a serial known to both is a GenieACS modem, so GenieACS is asked first
    let acsError: unknown;
    if (!this.acs.isMock) {
      try { return await this.pollAcs(d); } catch (e) { acsError = e; }
    }
    const saved = await this.pollZabbix(d);
    if (saved) return saved;
    if (acsError) throw acsError;
    return this.pollAcs(d);   // mock mode (dev / test)
  }

  private async pollAcs(d: Linkable) {
    const s = await this.acs.fetchStatus(d.genieacs_device_id ?? d.serial_number ?? `dev-${d.id}`);
    const wasZabbix = (d.last_status as { source?: string } | null)?.source === 'zabbix';
    return this.prisma.carePlanDevice.update({
      where: { id: d.id },
      data: { ...(!d.genieacs_device_id && s.device_id ? { genieacs_device_id: s.device_id } : {}), ...(wasZabbix ? { last_status: Prisma.DbNull } : {}), online: s.online, last_seen_at: s.last_seen_at, rx_power_dbm: s.rx_power_dbm, wifi_ssid: s.wifi_ssid, connected_clients: s.connected_clients },
    });
  }

  /** Saves the Zabbix status. null when Zabbix does not know the serial and never did. */
  private async pollZabbix(d: Linkable) {
    const onu = await this.zbx!.find(d.serial_number!);
    if (!onu && !isZabbixOnu(d)) return null;
    const online = onu?.online ?? null;
    return this.prisma.carePlanDevice.update({
      where: { id: d.id },
      data: { online, ...(online ? { last_seen_at: onu!.checked_at } : {}), rx_power_dbm: null, wifi_ssid: null, connected_clients: null, last_status: { source: 'zabbix', serial: d.serial_number } },
    });
  }

  /**
   * A just-installed ONU has not been synced yet. If Zabbix knows its serial, read it now, so no screen offers it router buttons.
   * Never fails: when Zabbix or GenieACS cannot be reached the devices are returned as they are.
   */
  async adoptZabbix<T extends Linkable>(devices: T[]): Promise<T[]> {
    if (!this.useZabbix) return devices;
    const unsorted = devices.filter((d) => d.is_active !== false && !d.genieacs_device_id && d.serial_number && !isZabbixOnu(d));
    if (!unsorted.length) return devices;
    let onus: Awaited<ReturnType<ZabbixProvider['onus']>>;
    try { onus = await this.zbx!.onus(); } catch { return devices; }
    const read = await Promise.allSettled(unsorted.filter((d) => onus.has(ZabbixProvider.key(d.serial_number!))).map(async (d) => ({ id: d.id, row: await this.pollOne(d) })));
    const rows = new Map(read.flatMap((r) => (r.status === 'fulfilled' ? [[r.value.id, r.value.row] as const] : [])));
    return devices.map((d) => (rows.has(d.id) ? { ...d, ...rows.get(d.id) } : d));
  }

  private activeDevices() { return this.prisma.carePlanDevice.findMany({ where: { is_active: true, lead: { care_plan: true } }, take: 500 }); }

  private async inBatches(devices: Linkable[], read: (d: Linkable) => Promise<unknown>) {
    let ok = 0, failed = 0;
    for (let i = 0; i < devices.length; i += 10) {
      const res = await Promise.allSettled(devices.slice(i, i + 10).map(read));
      res.forEach((r) => (r.status === 'fulfilled' ? ok++ : failed++));
    }
    return { polled: devices.length, ok, failed };
  }

  /** Every active Care Plan modem, 10 at a time. Used by the timer and by POST /care-plan/poll. */
  async pollAll() { return this.inBatches(await this.activeDevices(), (d) => this.pollOne(d)); }

  /** Only the modems Zabbix knows (or knew). The timer's run while GenieACS is not configured. */
  private async pollZabbixOnly() {
    const onus = await this.zbx!.onus();
    const devices = (await this.activeDevices()).filter((d) => !d.genieacs_device_id && d.serial_number && (isZabbixOnu(d) || onus.has(ZabbixProvider.key(d.serial_number))));
    return this.inBatches(devices, (d) => this.pollZabbix(d));
  }

  /** The timer's run: never overlaps itself, and does nothing when neither GenieACS nor Zabbix is configured. */
  async run() {
    if ((this.acs.isMock && !this.useZabbix) || this.running) return null;
    this.running = true;
    try {
      const r = this.acs.isMock ? await this.pollZabbixOnly() : await this.pollAll();
      if (r.polled) this.logger.log(`care plan sync: ${r.ok}/${r.polled} modems updated${r.failed ? `, ${r.failed} failed` : ''}`);
      return r;
    } finally { this.running = false; }
  }
}
