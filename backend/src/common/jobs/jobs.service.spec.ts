import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';

/** In tests (APP_ENV=test) a job runs inside enqueue, without the table. The real queue (table, worker, retries, restart safety) is covered by test/jobs.e2e-spec.ts. */
const inline = () => new JobsService(new ConfigService({ APP_ENV: 'test' }));

describe('JobsService (inline mode used by tests)', () => {
  it('runs the registered handler with the payload before enqueue returns', async () => {
    const jobs = inline(); const seen: any[] = [];
    jobs.register('greet', async (p) => { seen.push(p); });
    await jobs.enqueue('greet', { name: 'Asha' });
    expect(seen).toEqual([{ name: 'Asha' }]);
  });

  it('a name like "message:otp" uses the handler registered for "message"', async () => {
    const jobs = inline(); let got: any;
    jobs.register('message', async (p) => { got = p; });
    await jobs.enqueue('message:otp', { code: '1' });
    expect(got).toEqual({ code: '1' });
  });

  it('never throws into the request: a failing or unknown job is only logged', async () => {
    const jobs = inline(); let ran = 0;
    jobs.register('bad', async () => { throw new Error('boom'); });
    jobs.register('good', async () => { ran++; });
    await expect(jobs.enqueue('bad')).resolves.toBeUndefined();
    await expect(jobs.enqueue('nobody-handles-this')).resolves.toBeUndefined();
    await jobs.enqueue('good');
    expect(ran).toBe(1);
  });

  it('whenIdle resolves at once when nothing is running', async () => {
    await expect(inline().whenIdle()).resolves.toBeUndefined();
  });
});
