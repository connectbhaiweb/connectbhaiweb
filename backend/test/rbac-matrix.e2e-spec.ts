import { actors, bearer, createCtx, Ctx, makeCustomer, P } from './helpers';

/**
 * Role matrix for every protected route. For each route we check: anonymous -> 401, a role that is NOT allowed -> 403,
 * an allowed role -> anything except 401/403. Ids are deliberately non-existent (99999999) and bodies empty, so allowed
 * calls end in 400/404 and never change data: this tests the guards only.
 */
type Role = 'admin' | 'dsa' | 'tip' | 'customer';
const ALL: Role[] = ['admin', 'dsa', 'tip', 'customer'];
const X = 99999999;
const routes: [string, string, Role[]][] = [
  // users
  ['GET', '/users/me', ALL], ['PATCH', '/users/me', ALL],
  ['GET', '/users', ['admin']], ['GET', `/users/${X}`, ['admin']], ['GET', `/users/${X}/documents`, ['admin']],
  ['PATCH', `/users/${X}/partner-status`, ['admin']], ['PATCH', `/users/${X}/active`, ['admin']], ['POST', '/users/admins', ['admin']],
  // settings, notifications, reports, waitlist
  ['GET', '/settings', ['admin']], ['PUT', '/settings/gst_percent', ['admin']],
  ['GET', '/notifications/me', ALL], ['PATCH', `/notifications/${X}/read`, ALL], ['GET', '/notifications', ['admin']],
  ['GET', '/reports/me', ALL], ['GET', '/reports/overview', ['admin']], ['GET', '/reports/leads-by-pincode', ['admin']], ['GET', '/reports/partners', ['admin']],
  ['GET', '/waitlist', ['admin']], ['POST', `/waitlist/notify/${X}`, ['admin']],
  // locations (admin writes)
  ['POST', '/cities', ['admin']], ['PATCH', `/cities/${X}`, ['admin']], ['POST', `/cities/${X}/areas`, ['admin']], ['DELETE', `/areas/${X}`, ['admin']],
  ['GET', '/admin/tip-pincodes', ['admin']], ['POST', '/admin/tip-pincodes', ['admin']], ['PATCH', `/admin/tip-pincodes/${X}`, ['admin']], ['DELETE', `/admin/tip-pincodes/${X}`, ['admin']],
  ['POST', '/admin/pincodes/import', ['admin']],
  // catalogue (admin writes)
  ['POST', '/plan-categories', ['admin']], ['PATCH', `/plan-categories/${X}`, ['admin']], ['POST', '/ott-apps', ['admin']], ['PATCH', `/ott-apps/${X}`, ['admin']],
  ['POST', '/plans', ['admin']], ['PATCH', `/plans/${X}`, ['admin']], ['PUT', `/plans/${X}/ott-apps`, ['admin']], ['PUT', '/pincodes/452010/plans', ['admin']],
  // leads, bookings
  ['GET', '/leads', ALL], ['GET', `/leads/${X}`, ALL], ['GET', `/leads/${X}/events`, ALL], ['POST', `/leads/${X}/notes`, ALL],
  ['PATCH', `/leads/${X}/status`, ['admin', 'tip', 'customer']], ['PATCH', `/leads/${X}/assign`, ['admin']],
  ['GET', '/bookings', ALL], ['POST', '/bookings', ['admin', 'tip']], ['PATCH', `/bookings/${X}`, ['admin', 'tip']], ['POST', `/bookings/${X}/complete`, ['admin', 'tip']],
  // money
  ['GET', '/charges', ['admin', 'tip', 'customer']], ['GET', `/charges/${X}`, ['admin', 'tip', 'customer']], ['POST', '/charges', ['admin']], ['POST', '/charges/customer', ['customer']], ['POST', '/charges/care-plan', ['tip']],
  ['POST', `/charges/${X}/offline`, ['admin']], ['POST', `/charges/${X}/waive`, ['admin']], ['POST', `/charges/${X}/cancel`, ['admin']],
  ['GET', '/commissions', ['admin', 'dsa']], ['POST', `/commissions/${X}/approve`, ['admin']], ['POST', `/commissions/${X}/pay`, ['admin']], ['POST', `/commissions/${X}/cancel`, ['admin']],
  // support
  ['GET', '/tickets', ALL], ['POST', '/tickets', ALL], ['GET', '/chat/threads', ALL],
  ['GET', '/care-plan/devices', ALL], ['PATCH', `/care-plan/devices/${X}`, ['admin', 'tip']], ['POST', '/care-plan/poll', ['admin']],
];
const publicRoutes: [string, string][] = [
  ['GET', '/cities'], ['GET', '/plans'], ['GET', '/plan-categories'], ['GET', '/ott-apps'], ['GET', '/pincodes/452010'], ['GET', '/locations/pincodes?codes=452010'],
  ['POST', '/auth/otp/request'], ['POST', '/auth/login'], ['POST', '/partners/register'], ['POST', '/leads'], ['GET', '/leads/track?ref_code=CB-1&phone=9811111111'], ['POST', '/waitlist'],
  ['POST', '/uploads/sign'], ['GET', '/settings/public'],
];

describe('role matrix', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>; let tokens: Record<Role, string>;
  beforeAll(async () => {
    c = await createCtx(); a = await actors(c);
    tokens = { admin: a.admin, dsa: a.dsa1, tip: a.dream, customer: (await makeCustomer(c)).token };
  });
  afterAll(() => c.app.close());
  const call = (method: string, path: string, token?: string) => {
    let r = (c.http() as any)[method.toLowerCase()](`${P}${path}`);
    if (token) r = r.set(bearer(token));
    return method === 'GET' || method === 'DELETE' ? r : r.send({});
  };

  it.each(routes)('%s %s needs a login', async (m, path) => { expect((await call(m, path)).status).toBe(401); });

  describe.each(routes)('%s %s', (m, path, allowed) => {
    for (const role of ALL) {
      const ok = allowed.includes(role);
      it(`${role} ${ok ? 'is allowed through' : 'is refused (403)'}`, async () => {
        const r = await call(m, path, tokens[role]);
        if (ok) expect([401, 403]).not.toContain(r.status);
        else expect(r.status).toBe(403);
      });
    }
  });

  it.each(publicRoutes)('%s %s is public (never 401/403)', async (m, path) => {
    const r = await call(m, path);
    expect([401, 403]).not.toContain(r.status);
  });

  it('garbage, expired and wrong-type tokens are 401 everywhere', async () => {
    for (const t of ['abc', 'Bearer', 'a.b.c', await c.jwt.signAsync({ sub: 1, role: 'admin', typ: 'refresh' }, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '5m' })]) {
      expect((await (c.http() as any).get(`${P}/users/me`).set('Authorization', `Bearer ${t}`)).status).toBe(401);
    }
    const expired = await c.jwt.signAsync({ sub: 1, role: 'admin', phone: '9999999999', typ: 'access' }, { secret: process.env.JWT_SECRET, expiresIn: '-10s' });
    expect((await (c.http() as any).get(`${P}/users/me`).set('Authorization', `Bearer ${expired}`)).status).toBe(401);
  });
});
