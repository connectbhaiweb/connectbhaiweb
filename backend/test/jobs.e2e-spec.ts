import { ConfigService } from '@nestjs/config';
import { JobsService } from '../src/common/jobs/jobs.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

/** The real, database-backed queue (JOBS_MODE=db): saved before anything runs, retried, claimed by one server only, recovered after a crash. */
const wait = async (cond: () => boolean | Promise<boolean>, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await cond()) return; await new Promise((r) => setTimeout(r, 25)); } throw new Error('timed out'); };

describe('durable job queue', () => {
  let prisma: PrismaService;
  const make = () => new JobsService(new ConfigService({ APP_ENV: 'test', JOBS_MODE: 'db' }), prisma);
  const started: JobsService[] = [];
  const mk = () => { const j = make(); j.onModuleInit(); started.push(j); return j; };

  beforeAll(async () => { prisma = new PrismaService(); await prisma.$connect(); });
  beforeEach(async () => { await prisma.backgroundJob.deleteMany({}); });
  afterEach(async () => { for (const j of started.splice(0)) await j.onModuleDestroy(); });
  afterAll(async () => { await prisma.backgroundJob.deleteMany({}); await prisma.$disconnect(); });

  it('is saved to the table first, then run by the worker and marked done', async () => {
    const jobs = make(); const seen: any[] = [];
    jobs.register('t', async (p) => { seen.push(p); });
    await jobs.enqueue('t', { n: 1 }); await jobs.flush();   // worker not started yet: the job just waits in the table
    expect(await prisma.backgroundJob.count({ where: { status: 'pending' } })).toBe(1);
    expect(seen).toEqual([]);
    jobs.onModuleInit(); started.push(jobs);
    await wait(() => seen.length === 1);
    expect(seen).toEqual([{ n: 1 }]);
    await wait(async () => (await prisma.backgroundJob.count({ where: { status: 'done' } })) === 1);
  });

  it('survives a restart: a job saved by one server is run by the next one', async () => {
    const before = make(); await before.enqueue('t', { n: 7 }); await before.flush();       // "server A" saves it and dies without running anything
    const after = mk(); const seen: any[] = [];
    after.register('t', async (p) => { seen.push(p); });              // "server B" starts later
    await wait(() => seen.length === 1);
    expect(seen).toEqual([{ n: 7 }]);
  });

  it('retries a job that throws, then gives up and records the reason', async () => {
    const jobs = mk(); let calls = 0;
    jobs.register('flaky', async () => { calls++; if (calls < 2) throw new Error('later'); });
    await jobs.enqueue('flaky', {}, { maxAttempts: 3 });
    await wait(async () => (await prisma.backgroundJob.count({ where: { status: 'done' } })) === 1, 9000);
    expect(calls).toBe(2);

    jobs.register('doomed', async () => { throw new Error('never works'); });
    await jobs.enqueue('doomed', {}, { maxAttempts: 1 });
    await wait(async () => (await prisma.backgroundJob.count({ where: { name: 'doomed', status: 'failed' } })) === 1);
    const j = await prisma.backgroundJob.findFirstOrThrow({ where: { name: 'doomed' } });
    expect(j.last_error).toBe('never works');
  });

  it('two servers share the table but each job runs exactly once', async () => {
    const a = mk(), b = mk(); const ran: number[] = [];
    for (const s of [a, b]) s.register('once', async (p) => { ran.push(p.i); await new Promise((r) => setTimeout(r, 10)); });
    for (let i = 0; i < 20; i++) await a.enqueue('once', { i });
    await wait(async () => (await prisma.backgroundJob.count({ where: { status: 'done' } })) === 20);
    expect(ran.sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('a job stuck "running" by a server that died is queued again and finished', async () => {
    await prisma.backgroundJob.create({ data: { name: 't', payload: { n: 9 }, status: 'running', attempts: 1, locked_by: 'dead-server', locked_at: new Date(Date.now() - 10 * 60_000) } });
    const jobs = mk(); const seen: any[] = [];
    jobs.register('t', async (p) => { seen.push(p); });
    await wait(() => seen.length === 1);
    expect(seen).toEqual([{ n: 9 }]);
  });

  it('urgent jobs (login codes) go ahead of the ones already waiting', async () => {
    const jobs = make(); const order: string[] = [];
    jobs.register('slow', async () => { order.push('slow'); }); jobs.register('otp', async () => { order.push('otp'); });
    for (let i = 0; i < 3; i++) await jobs.enqueue('slow', {});
    await jobs.enqueue('otp', {}, { urgent: true }); await jobs.flush();
    (jobs as any).concurrency = 1; jobs.onModuleInit(); started.push(jobs);
    await wait(() => order.length === 4);
    expect(order[0]).toBe('otp');
  });
});
