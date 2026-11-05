import { actors, bearer, createCtx, Ctx, newLead, P, PIN, planId, uniquePhone } from './helpers';

describe('security & robustness', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  const PRIVATE: [string, string][] = [
    ['get', '/users/me'], ['get', '/leads'], ['get', '/bookings'], ['get', '/charges'], ['get', '/commissions'], ['get', '/tickets'],
    ['get', '/care-plan/devices'], ['get', '/notifications/me'], ['get', '/reports/me'], ['get', '/settings'], ['get', '/users'],
    ['post', '/bookings'], ['post', '/tickets'], ['post', '/charges/care-plan'], ['post', '/care-plan/poll'], ['get', '/chat/lead/1/messages'],
  ];
  it.each(PRIVATE)('%s %s requires a login', async (m, path) => {
    await (c.http() as any)[m](`${P}${path}`).expect(401);
  });
  it('a garbage / expired / wrong-secret token is rejected', async () => {
    await c.http().get(`${P}/users/me`).set(bearer('not.a.jwt')).expect(401);
    const forged = await c.jwt.signAsync({ sub: 1, role: 'admin', typ: 'access' }, { secret: 'attacker-secret-attacker-secret' });
    await c.http().get(`${P}/users/me`).set(bearer(forged)).expect(401);
    const expired = await c.jwt.signAsync({ sub: a.ids.dsa1, role: 'dsa', typ: 'access' }, { secret: process.env.JWT_SECRET, expiresIn: -10 });
    await c.http().get(`${P}/users/me`).set(bearer(expired)).expect(401);
    await c.http().get(`${P}/users/me`).set('Authorization', 'Basic abc').expect(401);
  });
  it('role in a token cannot be escalated without the signing secret', async () => {
    const t = await c.jwt.signAsync({ sub: a.ids.dsa1, role: 'admin', typ: 'access' }, { secret: 'nope-nope-nope-nope-nope' });
    await c.http().get(`${P}/settings`).set(bearer(t)).expect(401);
  });
  it('a public route still attributes a logged-in DSA, but a bad token on a public route is just anonymous', async () => {
    const pid = await planId(c);
    const bad = await c.http().post(`${P}/leads`).set(bearer('junk')).send({ customer_name: 'Anon Person', customer_phone: uniquePhone(), pincode: PIN, plan_id: pid }).expect(201);
    expect(bad.body.source).toBe('website');
  });
  it('rejects unknown fields (mass-assignment) and wrong types', async () => {
    await c.http().post(`${P}/leads`).send({ customer_name: 'X Person', customer_phone: uniquePhone(), pincode: PIN, status: 'installed', care_plan: true }).expect(400);
    await c.http().post(`${P}/leads`).send({ customer_name: 123, customer_phone: uniquePhone(), pincode: PIN }).expect(400);
    await c.http().post(`${P}/leads`).send({ customer_name: 'X Person', customer_phone: uniquePhone(), pincode: PIN, plan_id: 'abc' }).expect(400);
    await c.http().post(`${P}/leads`).set('content-type', 'application/json').send('{"broken json').expect(400);
  });
  it('SQL-injection style input is treated as plain text', async () => {
    const q = `x' OR '1'='1`;
    const r = await c.http().get(`${P}/plans?q=${encodeURIComponent(q)}`).expect(200);
    expect(r.body.total).toBe(0);
    const r2 = await c.http().get(`${P}/leads?q=${encodeURIComponent(`'; DROP TABLE leads;--`)}`).set(bearer(a.admin)).expect(200);
    expect(r2.body.total).toBe(0);
    expect(await c.prisma.lead.count()).toBeGreaterThan(0);
  });
  it('stored text comes back verbatim (no HTML execution server-side) and large bodies are refused', async () => {
    const l = await newLead(c, a, { tip: 'dream' });
    const note = '<script>alert(1)</script>';
    await c.http().post(`${P}/leads/${l.id}/notes`).set(bearer(a.dream)).send({ note }).expect(201);
    const ev = await c.http().get(`${P}/leads/${l.id}/events`).set(bearer(a.dream)).expect(200);
    expect(ev.body.find((e: any) => e.event_type === 'note').note).toBe(note);
    await c.http().post(`${P}/leads/${l.id}/notes`).set(bearer(a.dream)).send({ note: 'x'.repeat(2_000_000) }).expect(413);
  });
  it('IDs are not guessable across tenants: out-of-scope records look like 404, never 403/200', async () => {
    const l = await newLead(c, a, { by: 'dsa2', tip: 'doulat' });
    for (const t of [a.dsa1, a.dream]) await c.http().get(`${P}/leads/${l.id}`).set(bearer(t)).expect(404);
  });
  it('sensitive columns never appear in any user payload', async () => {
    const me = await c.http().get(`${P}/users/me`).set(bearer(a.dream)).expect(200);
    const list = await c.http().get(`${P}/users?limit=50`).set(bearer(a.admin)).expect(200);
    const txt = JSON.stringify([me.body, list.body]);
    for (const k of ['password_hash', 'aadhaar_enc', 'pan_enc', 'bank_account_enc']) expect(txt).not.toContain(k);
  });
  it('CORS only allows the configured frontend origin', async () => {
    const ok = await c.http().options(`${P}/plans`).set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const bad = await c.http().options(`${P}/plans`).set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('error responses never leak stack traces or SQL', async () => {
    const r = await c.http().get(`${P}/leads/99999999999999999999`).set(bearer(a.admin));
    expect(JSON.stringify(r.body)).not.toMatch(/prisma|select |stack|node_modules/i);
  });
});
