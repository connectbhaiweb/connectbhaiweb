import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsService } from '../common/jobs/jobs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { GenieAcsProvider } from './genieacs.provider';

export const DEVICE_ACTION_JOB = 'deviceaction';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Follows a modem command (restart, Wi-Fi change, factory reset) after the request has already answered.
 * The command is a GenieACS task the modem collects at its next check-in (about once a minute), so this job watches until it really happened:
 *   collected (the task left GenieACS' queue) -> for a restart, the modem boots again -> row status "done";
 *   refused (GenieACS recorded a fault) or never collected in time -> the task is taken back and the row says "failed" with the reason.
 * The Wi-Fi password is not in the job or the database: it only exists inside the GenieACS task.
 */
@Injectable()
export class DeviceActionRunner {
  private readonly logger = new Logger(DeviceActionRunner.name);
  constructor(private prisma: PrismaService, private acs: GenieAcsProvider, private jobs: JobsService, private cfg: ConfigService) {
    this.jobs.register(DEVICE_ACTION_JOB, (payload) => this.run(payload));
  }

  async run(payload: { action_id?: string | number; task_id?: string | null }) {
    if (payload?.action_id == null) return;
    const id = BigInt(payload.action_id);
    const row = await this.prisma.deviceAction.findUnique({ where: { id }, include: { device: { select: { id: true, genieacs_device_id: true, serial_number: true } } } });
    if (!row || row.status === 'done' || row.status === 'failed') return;   // finished already (a job handed back after a restart must not run twice)
    const deviceId = row.device.genieacs_device_id ?? row.device.serial_number ?? `dev-${row.device.id}`;
    const gap = Number(this.cfg.get('DEVICE_ACTION_POLL_MS') ?? 5000);
    try {
      if (payload.task_id) await this.waitCollected(deviceId, payload.task_id, row.created_at, gap);
      if (row.action === 'reboot') await this.waitReboot(deviceId, row.created_at, gap);
      await this.prisma.deviceAction.update({ where: { id }, data: { status: 'done', error: null, completed_at: new Date() } });
    } catch (e: any) {
      const msg = String(e?.message ?? 'The modem did not answer').slice(0, 250);
      this.logger.warn(`modem action #${id} (${row.action}) failed: ${msg}`);
      await this.prisma.deviceAction.update({ where: { id }, data: { status: 'failed', error: msg, completed_at: new Date() } }).catch(() => undefined);
    }
  }

  private async waitCollected(deviceId: string, taskId: string, since: Date, gap: number) {
    const maxMs = Number(this.cfg.get('DEVICE_ACTION_MAX_MS') ?? 15 * 60_000), end = Date.now() + maxMs;
    for (;;) {
      if (!(await this.acs.isTaskQueued(taskId))) return;   // the modem took it
      const fault = await this.acs.deviceFault(deviceId).catch(() => null);
      if (fault && fault.at.getTime() >= since.getTime() - 1000) { await this.acs.cancelTask(taskId); throw new Error(`The modem refused the command: ${fault.message}`); }
      if (Date.now() >= end) { await this.acs.cancelTask(taskId); throw new Error(`The modem did not check in within ${Math.round(maxMs / 60000)} minutes, so the command was cancelled`); }
      await sleep(gap);
    }
  }

  private async waitReboot(deviceId: string, since: Date, gap: number) {
    const end = Date.now() + Number(this.cfg.get('DEVICE_ACTION_BOOT_MS') ?? 5 * 60_000);
    for (;;) {
      const boot = await this.acs.lastBoot(deviceId).catch(() => null);
      if (boot && boot.getTime() >= since.getTime()) return;
      if (Date.now() >= end) throw new Error('The modem accepted the restart but has not come back yet');
      await sleep(gap);
    }
  }
}
