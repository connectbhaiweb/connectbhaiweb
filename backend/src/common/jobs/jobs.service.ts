import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * A small background job runner. A request does only the work the person is waiting for (saving the form), then
 * hands everything else (WhatsApp messages and the like) to `enqueue` and answers at once.
 *
 *  - jobs run a few at a time, in order, after the response has gone out
 *  - a job that throws is logged and never affects the request; `retries` re-runs it with a growing pause
 *  - on shutdown the queue is given a few seconds to finish
 *  - in tests (APP_ENV=test) a job runs before `enqueue` returns, so tests stay predictable
 */
@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly queue: { name: string; fn: () => Promise<void>; retries: number; attempt: number }[] = [];
  private running = 0;
  private idle: (() => void)[] = [];
  private readonly inline: boolean;
  private readonly concurrency = 4;
  constructor(cfg: ConfigService) { this.inline = cfg.get('APP_ENV') === 'test'; }

  /** Returns at once (in tests: after the job ran). Never throws. */
  async enqueue(name: string, fn: () => Promise<void>, opts: { retries?: number } = {}): Promise<void> {
    const job = { name, fn, retries: opts.retries ?? 0, attempt: 0 };
    if (this.inline) { await this.exec(job, false); return; }
    this.queue.push(job);
    setImmediate(() => this.pump());
  }

  private pump() {
    while (this.running < this.concurrency && this.queue.length) {
      const job = this.queue.shift()!;
      this.running++;
      this.exec(job, true).finally(() => { this.running--; this.pump(); if (!this.running && !this.queue.length) { this.idle.forEach((r) => r()); this.idle = []; } });
    }
  }

  private async exec(job: { name: string; fn: () => Promise<void>; retries: number; attempt: number }, canRetry: boolean) {
    try { await job.fn(); }
    catch (e: any) {
      if (canRetry && job.attempt < job.retries) {
        job.attempt++;
        const wait = 2000 * job.attempt;
        this.logger.warn(`job ${job.name} failed (${e?.message}); retry ${job.attempt}/${job.retries} in ${wait / 1000}s`);
        setTimeout(() => { this.queue.push(job); this.pump(); }, wait).unref();
      } else this.logger.error(`job ${job.name} failed: ${e?.message}`);
    }
  }

  /** Resolves when nothing is running or waiting (used on shutdown and in tests). */
  whenIdle(): Promise<void> { return this.running || this.queue.length ? new Promise((r) => this.idle.push(r)) : Promise.resolve(); }

  async onModuleDestroy() { await Promise.race([this.whenIdle(), new Promise((r) => setTimeout(r, 5000))]); }
}

@Global()
@Module({ providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
