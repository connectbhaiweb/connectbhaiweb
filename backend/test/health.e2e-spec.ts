import { Ctx, createCtx } from './helpers';

describe('health', () => {
  let c: Ctx;
  beforeAll(async () => { c = await createCtx(); });
  afterAll(() => c.app.close());

  it('GET /health is public and outside the API prefix', async () => {
    const r = await c.http().get('/health').expect(200);
    expect(r.body.status).toBe('ok');
  });
  it('GET /health/ready checks the database', async () => {
    const r = await c.http().get('/health/ready').expect(200);
    expect(r.body).toEqual({ status: 'ready', database: 'up' });
  });
  it('sets security headers and hides x-powered-by', async () => {
    const r = await c.http().get('/health');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });
  it('unknown routes return the standard error shape', async () => {
    const r = await c.http().get('/api/v1/nope').expect(404);
    expect(r.body).toMatchObject({ statusCode: 404, path: '/api/v1/nope' });
    expect(r.body.stack).toBeUndefined();
  });
});
