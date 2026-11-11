import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { GenieAcsProvider } from './genieacs.provider';

type Linkable = { id: bigint; genieacs_device_id: string | null; serial_number: string | null };

/**
 * Keeps the Care Plan screens current: every CARE_PLAN_SYNC_MINUTES (default 10; 0 turns it off) each active, linked modem is read
 * from GenieACS and its status saved (online, last seen, signal, Wi-Fi name, connected devices). Read-only towards the modem.
 * Skipped while GenieACS is not configured (mock mode), so invented numbers are never written to the database by the timer.
 */
@Injectable()
export class CarePlanSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CarePlanSyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private prisma: PrismaService, private acs: GenieAcsProvider, private cfg: ConfigService) {}

  onModuleInit() {
    if (this.cfg.get('APP_ENV') === 'test') return;   // tests call run() directly
    const minutes = Number(this.cfg.get('CARE_PLAN_SYNC_MINUTES') ?? 10);
    if (!(minutes > 0)) return;
    this.timer = setInterval(() => this.run().catch((e) => this.logger.error(e?.message)), minutes * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** Reads one modem and saves its status. Throws if GenieACS cannot be reached or does not know the device. */
  async pollOne(d: Linkable) {
    const s = await this.acs.fetchStatus(d.genieacs_device_id ?? d.serial_number ?? `dev-${d.id}`);
    return this.prisma.carePlanDevice.update({
      where: { id: d.id },
      data: { ...(!d.genieacs_device_id && s.device_id ? { genieacs_device_id: s.device_id } : {}), online: s.online, last_seen_at: s.last_seen_at, rx_power_dbm: s.rx_power_dbm, wifi_ssid: s.wifi_ssid, connected_clients: s.connected_clients },
    });
  }

  /** Every active Care Plan modem, 10 at a time. Used by the timer and by POST /care-plan/poll. */
  async pollAll() {
    const devices = await this.prisma.carePlanDevice.findMany({ where: { is_active: true, lead: { care_plan: true } }, take: 500 });
    let ok = 0, failed = 0;
    for (let i = 0; i < devices.length; i += 10) {
      const res = await Promise.allSettled(devices.slice(i, i + 10).map((d) => this.pollOne(d)));
      res.forEach((r) => (r.status === 'fulfilled' ? ok++ : failed++));
    }
    return { polled: devices.length, ok, failed };
  }

  /** The timer's run: never overlaps itself, does nothing in mock mode. */
  async run() {
    if (this.acs.isMock || this.running) return null;
    this.running = true;
    try {
      const r = await this.pollAll();
      if (r.polled) this.logger.log(`care plan sync: ${r.ok}/${r.polled} modems updated${r.failed ? `, ${r.failed} failed` : ''}`);
      return r;
    } finally { this.running = false; }
  }
}
