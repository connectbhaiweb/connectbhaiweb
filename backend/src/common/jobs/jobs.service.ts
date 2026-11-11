import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hostname } from 'os';
import { PrismaService } from '../prisma/prisma.service';

export type JobHandler = (payload: any) => Promise<void>;
export interface EnqueueOptions {
  /** How many times the job may run in total (default 3). */
  maxAttempts?: number;
  /** Goes ahead of everything that is waiting (login codes). */
  urgent?: boolean;
  /** Do not start before this many milliseconds from now. */
  delayMs?: number;
}

const STALE_AFTER_MIN = 5;     // a job "running" longer than this belongs to a server that died: it is given back to the queue
const KEEP_OTP_DAYS = 7;             // login-code messages are only useful for the rate limit (10 minutes)
const KEEP_NOTIFICATION_DAYS = 90;  // message log kept this long
const KEEP_DONE_DAYS = 7;     // finished jobs are kept this long for inspection, then removed

/**
 * A durable background job queue. Work that does not need to hold up a request (WhatsApp messages and the look-ups they need)
 * is written to the `background_jobs` table by `enqueue` and the request answers at once. A worker inside the API picks the
 * rows up and runs them, so nothing is lost when the server restarts or crashes, and nobody has to run a command.
 *
 *  - a job is a NAME plus a JSON payload; the code that owns the job registers a handler for the name with `register`
 *    (name "message:otp" is handled by the handler registered for "message")
 *  - the worker runs a few jobs at a time (default 8); an enqueue wakes it immediately, and it also polls every 2 seconds
 *  - a job that throws is tried again later with a growing pause, up to maxAttempts, then marked "failed" with the reason
 *  - several API servers can share the table: a job is claimed with one atomic UPDATE, so only one server runs it
 *  - a job found "running" for more than 5 minutes (its server died) goes back to "pending"
 *  - in tests (APP_ENV=test) the handler runs inside `enqueue`, without the table, so tests stay predictable
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly inline: boolean;
  private readonly concurrency: number;
  private readonly workerId = `${hostname()}:${process.pid}`;
  private running = 0;
  private ticking = false;
  private again = false;
  private started = false;
  private stopped = false;
  private timer?: NodeJS.Timeout;
  private lastHousekeeping = 0;
  private idle: (() => void)[] = [];
  private readonly saving = new Set<Promise<void>>();

  constructor(cfg: ConfigService, @Optional() private prisma?: PrismaService) {
    this.inline = cfg.get('APP_ENV') === 'test' && cfg.get('JOBS_MODE') !== 'db';
    this.concurrency = Number(cfg.get('JOBS_CONCURRENCY') ?? 8);   // WhatsApp sends mostly wait on the network, so a few slow ones must not hold up an OTP
  }

  /** Teach the queue how to run jobs called `name`. Call once, from the constructor of the service that owns the job. */
  register(name: string, handler: JobHandler) { this.handlers.set(name, handler); }

  /**
   * Returns AT ONCE: the request never waits for the database. The job is saved to the table right behind it (a few milliseconds,
   * retried if the table is busy), and the worker is woken as soon as the row exists. In tests the handler runs inside this call instead.
   * Never throws: a request must not fail because a message could not be queued.
   */
  async enqueue(name: string, payload: Record<string, unknown> = {}, opts: EnqueueOptions = {}): Promise<void> {
    if (this.inline || !this.prisma) { try { await this.runHandler(name, payload); } catch (e: any) { this.logger.error(`job ${name} failed: ${e?.message}`); } return; }
    const save = this.save(name, payload, opts);
    this.saving.add(save);
    void save.finally(() => this.saving.delete(save));
  }

  /** Resolves when every job passed to enqueue so far is stored in the table (used on shutdown and in tests). */
  async flush(): Promise<void> { while (this.saving.size) await Promise.allSettled([...this.saving]); }

  private async save(name: string, payload: Record<string, unknown>, opts: EnqueueOptions) {
    try {
      const data = {
        name: name.slice(0, 80), payload: JSON.parse(JSON.stringify(payload)), max_attempts: opts.maxAttempts ?? 3,
        priority: opts.urgent ? 10 : 0, run_at: new Date(Date.now() + (opts.delayMs ?? 0)),
      };
      // a busy table can cancel an insert with a deadlock / lock timeout: try again a few times rather than lose the job
      for (let n = 0; ; n++) {
        try { await this.prisma!.backgroundJob.create({ data }); break; }
        catch (e: any) {
          if (n >= 5) throw e;
          await new Promise((r) => setTimeout(r, 30 * (n + 1) + Math.random() * 50));
        }
      }
      this.kick();
    } catch (e: any) {
      this.logger.error(`COULD NOT QUEUE job ${name} (it was not saved): ${e?.message}`);
    }
  }

  onModuleInit() {
    if (this.inline || !this.prisma) return;
    this.started = true;
    this.timer = setInterval(() => { this.kick(); }, 2000);   // enqueue already wakes this server at once; the poll only picks up retries and other servers' jobs
    this.timer.unref();
    this.kick();
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.race([this.flush().then(() => this.whenIdle()), new Promise((r) => setTimeout(r, 5000))]);
  }

  /** Resolves when none of this server's jobs is running (used on shutdown and in tests). */
  whenIdle(): Promise<void> { return this.running ? new Promise((r) => this.idle.push(r)) : Promise.resolve(); }

  /** Ask the worker to look for ready jobs now. */
  kick() { if (this.started && !this.stopped && this.prisma) setImmediate(() => { this.tick().catch((e) => this.logger.error(`worker: ${e?.message}`)); }); }

  private async runHandler(name: string, payload: any) {
    const h = this.handlers.get(name) ?? this.handlers.get(name.split(':')[0]);
    if (!h) throw new Error(`no handler registered for job "${name}"`);
    await h(payload);
  }

  private async tick() {
    if (!this.prisma) return;
    if (this.ticking) { this.again = true; return; }
    this.ticking = true;
    try {
      do {
        this.again = false;
        await this.housekeeping();
        const room = this.concurrency - this.running;
        if (room <= 0) continue;
        const token = `${this.workerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        // claim in ONE statement: if two servers race, the status check lets only one of them take each row
        const claimed = await this.claim(token, room);
        if (!claimed) continue;
        const jobs = await this.prisma.backgroundJob.findMany({ where: { locked_by: token, status: 'running' }, orderBy: [{ priority: 'desc' }, { id: 'asc' }] });
        for (const j of jobs) {
          this.running++;
          this.execute(j).finally(() => {
            this.running--;
            if (!this.running) { this.idle.forEach((r) => r()); this.idle = []; }
            this.kick();   // there may be more waiting
          });
        }
        if (jobs.length === room) this.again = true;
      } while (this.again && !this.stopped);
    } finally { this.ticking = false; }
  }

  /** The claim UPDATE. When two servers claim at the same instant MySQL may cancel one of them with a deadlock (1213) or lock timeout (1205): nothing was changed, so just try again. */
  private async claim(token: string, room: number): Promise<number> {
    for (let n = 0; ; n++) {
      try {
        return await this.prisma!.$executeRaw`
          UPDATE background_jobs SET status = 'running', locked_by = ${token}, locked_at = NOW(3), attempts = attempts + 1
          WHERE status = 'pending' AND id IN (
            SELECT id FROM (SELECT id FROM background_jobs WHERE status = 'pending' AND run_at <= NOW(3) ORDER BY priority DESC, id ASC LIMIT ${room}) ready)`;
      } catch (e: any) {
        if (n >= 4 || !/\b(1213|1205)\b|deadlock|lock wait timeout/i.test(String(e?.message ?? e))) throw e;
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 60));
      }
    }
  }

  private async execute(j: { id: bigint; name: string; payload: any; attempts: number; max_attempts: number }) {
    try {
      await this.runHandler(j.name, j.payload ?? {});
      await this.prisma!.backgroundJob.update({ where: { id: j.id }, data: { status: 'done', finished_at: new Date(), locked_by: null, last_error: null } });
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 250);
      const more = j.attempts < j.max_attempts;
      this.logger[more ? 'warn' : 'error'](`job ${j.name} #${j.id} failed (attempt ${j.attempts}/${j.max_attempts}): ${msg}`);
      await this.prisma!.backgroundJob.update({
        where: { id: j.id },
        data: more
          ? { status: 'pending', locked_by: null, locked_at: null, last_error: msg, run_at: new Date(Date.now() + 2000 * j.attempts * j.attempts) }
          : { status: 'failed', finished_at: new Date(), locked_by: null, last_error: msg },
      }).catch((err) => this.logger.error(`could not record the result of job #${j.id}: ${err?.message}`));
    }
  }

  /** Gives back jobs whose server died, and removes old finished ones. Cheap; runs at most once a minute. */
  private async housekeeping() {
    if (Date.now() - this.lastHousekeeping < 60_000) return;
    this.lastHousekeeping = Date.now();
    const back = await this.prisma!.$executeRaw`
      UPDATE background_jobs SET status = 'pending', locked_by = NULL, locked_at = NULL, last_error = 'server stopped while running this job'
      WHERE status = 'running' AND locked_at < NOW(3) - INTERVAL ${STALE_AFTER_MIN} MINUTE`;
    if (back) this.logger.warn(`${back} job(s) found stuck from a stopped server; queued again`);
    await this.prisma!.$executeRaw`DELETE FROM background_jobs WHERE status = 'done' AND finished_at < NOW(3) - INTERVAL ${KEEP_DONE_DAYS} DAY LIMIT 500`;
    // the message log would otherwise grow for ever (every OTP and WhatsApp), and the admin log reads it.
    // The reminder templates are never removed: "send once per lead" is decided by finding the earlier row.
    await this.prisma!.$executeRaw`DELETE FROM notifications WHERE template = 'otp' AND created_at < NOW(3) - INTERVAL ${KEEP_OTP_DAYS} DAY LIMIT 500`;
    await this.prisma!.$executeRaw`DELETE FROM notifications WHERE created_at < NOW(3) - INTERVAL ${KEEP_NOTIFICATION_DAYS} DAY
      AND template NOT IN ('dsa_lead_reminder', 'tip_job_reminder', 'partner_agreement_pending', 'payment_due') LIMIT 500`;
  }
}

@Global()
@Module({ providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
