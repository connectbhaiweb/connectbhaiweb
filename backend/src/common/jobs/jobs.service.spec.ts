import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';

const prod = () => new JobsService(new ConfigService({ APP_ENV: 'production' }));

describe('JobsService (background jobs)', () => {
  it('answers at once: the job runs after enqueue returns', async () => {
    const jobs = prod(); const order: string[] = [];
    await jobs.enqueue('slow', async () => { await new Promise((r) => setTimeout(r, 30)); order.push('job done'); });
    order.push('request answered');
    expect(order).toEqual(['request answered']);
    await jobs.whenIdle();
    expect(order).toEqual(['request answered', 'job done']);
  });

  it('a failing job never throws into the request, and the others still run', async () => {
    const jobs = prod(); let ran = 0;
    await expect(jobs.enqueue('bad', async () => { throw new Error('boom'); })).resolves.toBeUndefined();
    await jobs.enqueue('good', async () => { ran++; });
    await jobs.whenIdle();
    expect(ran).toBe(1);
  });

  it('runs at most four at a time and finishes all of them', async () => {
    const jobs = prod(); let live = 0, peak = 0, done = 0;
    for (let i = 0; i < 12; i++) await jobs.enqueue('n', async () => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 10)); live--; done++; });
    await jobs.whenIdle();
    expect(done).toBe(12);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('retries a job that throws, up to the number asked', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    const jobs = prod(); let calls = 0;
    await jobs.enqueue('flaky', async () => { calls++; if (calls < 3) throw new Error('later'); }, { retries: 2 });
    for (let i = 0; i < 4; i++) { await jest.advanceTimersByTimeAsync(5000); await Promise.resolve(); }
    expect(calls).toBe(3);
    jest.useRealTimers();
  });

  it('in tests a job has finished when enqueue returns', async () => {
    const jobs = new JobsService(new ConfigService({ APP_ENV: 'test' })); let ran = false;
    await jobs.enqueue('x', async () => { ran = true; });
    expect(ran).toBe(true);
  });
});
