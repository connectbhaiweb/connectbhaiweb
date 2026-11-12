import { Injectable, Logger } from '@nestjs/common';
import { JobsService } from '../common/jobs/jobs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { GenieAcsProvider } from './genieacs.provider';

export const SPEED_TEST_JOB = 'speedtest';

/**
 * Runs the modem speed test in the background (the durable job queue), so the admin's click returns at once.
 * The modem only checks in about once a minute, so one test takes 1-3 minutes: the job asks the modem, waits for its answer
 * and writes the result to `speed_tests` (status done / failed). The screens read that row; nobody has to wait on a request.
 */
@Injectable()
export class SpeedTestRunner {
  private readonly logger = new Logger(SpeedTestRunner.name);
  constructor(private prisma: PrismaService, private acs: GenieAcsProvider, private jobs: JobsService) {
    this.jobs.register(SPEED_TEST_JOB, (payload) => this.run(payload));
  }

  /** Called by the job worker. Never throws: a failed test is a result (status 'failed' + the reason), not a job to retry. */
  async run(payload: { speed_test_id?: string | number }) {
    if (payload?.speed_test_id == null) return;
    const id = BigInt(payload.speed_test_id);
    const row = await this.prisma.speedTest.findUnique({ where: { id }, include: { device: { select: { id: true, genieacs_device_id: true, serial_number: true } } } });
    if (!row || row.status !== 'running') return;   // already finished (a job given back to the queue after a restart must not run twice)
    try {
      const r = await this.acs.speedTest(row.device.genieacs_device_id ?? row.device.serial_number ?? `dev-${row.device.id}`);
      await this.prisma.speedTest.update({ where: { id }, data: { status: 'done', error: null, download_mbps: r.download_mbps, upload_mbps: r.upload_mbps, ping_ms: r.ping_ms, tested_at: new Date() } });
    } catch (e: any) {
      const msg = String(e?.message ?? 'the modem did not answer').slice(0, 250);
      this.logger.warn(`speed test #${id} failed: ${msg}`);
      await this.prisma.speedTest.update({ where: { id }, data: { status: 'failed', error: msg, tested_at: new Date() } }).catch(() => undefined);
    }
  }
}
