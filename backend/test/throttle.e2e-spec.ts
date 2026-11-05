import { createCtx, Ctx, P, uniquePhone } from './helpers';

describe('rate limiting', () => {
  let c: Ctx;
  beforeAll(async () => { process.env.THROTTLE_ENABLED = 'true'; c = await createCtx(); });
  afterAll(async () => { process.env.THROTTLE_ENABLED = 'false'; await c.app.close(); });

  it('login endpoints are throttled per IP (429 after the limit)', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await c.http().post(`${P}/auth/otp/request`).send({ phone: uniquePhone() })).status);
    expect(codes.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(codes.slice(10)).toContain(429);
  });
  it('health checks are never throttled', async () => {
    for (let i = 0; i < 30; i++) await c.http().get('/health').expect(200);
  });
});
