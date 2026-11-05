import { actors, bearer, createCtx, Ctx, install, makeCustomer, newLead, P, uniquePhone } from './helpers';

describe('waitlist, settings, notifications, reports', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  describe('waitlist', () => {
    it('joins for a "soon" city, idempotently; live and unknown cities are refused', async () => {
      const bhopal = await c.prisma.city.findUniqueOrThrow({ where: { name: 'Bhopal' } });
      const indore = await c.prisma.city.findUniqueOrThrow({ where: { name: 'Indore' } });
      const phone = uniquePhone();
      const r = await c.http().post(`${P}/waitlist`).send({ city_id: Number(bhopal.id), phone, name: 'Wait Wala' }).expect(200);
      expect(r.body).toEqual({ joined: true, city: 'Bhopal' });
      await c.http().post(`${P}/waitlist`).send({ city_id: Number(bhopal.id), phone }).expect(200);
      expect(await c.prisma.waitlist.count({ where: { city_id: bhopal.id, phone } })).toBe(1);
      await c.http().post(`${P}/waitlist`).send({ city_id: Number(indore.id), phone }).expect(400);
      await c.http().post(`${P}/waitlist`).send({ city_id: 999999, phone }).expect(400);
      await c.http().post(`${P}/waitlist`).send({ city_id: Number(bhopal.id), phone: '123' }).expect(400);
    });
    it('admin lists it and notifies everyone once the city goes live', async () => {
      const city = await c.prisma.city.create({ data: { name: `Waitville ${Date.now()}`, status: 'soon' } });
      for (let i = 0; i < 3; i++) await c.http().post(`${P}/waitlist`).send({ city_id: Number(city.id), phone: uniquePhone() }).expect(200);
      await c.http().get(`${P}/waitlist`).set(bearer(a.dream)).expect(403);
      expect((await c.http().get(`${P}/waitlist`).set(bearer(a.admin)).expect(200)).body.total).toBeGreaterThanOrEqual(3);
      await c.http().post(`${P}/waitlist/notify/${city.id}`).set(bearer(a.admin)).expect(400); // not live yet
      await c.http().patch(`${P}/cities/${city.id}`).set(bearer(a.admin)).send({ status: 'live' }).expect(200);
      expect((await c.http().post(`${P}/waitlist/notify/${city.id}`).set(bearer(a.admin)).expect(200)).body).toEqual({ notified: 3 });
      expect((await c.http().post(`${P}/waitlist/notify/${city.id}`).set(bearer(a.admin)).expect(200)).body).toEqual({ notified: 0 }); // never twice
      expect(await c.prisma.notification.count({ where: { template: 'city_live' } })).toBeGreaterThanOrEqual(3);
    });
  });

  describe('settings', () => {
    it('admin reads all six money / behaviour settings', async () => {
      const r = await c.http().get(`${P}/settings`).set(bearer(a.admin)).expect(200);
      expect(r.body.map((s: any) => s.key).sort()).toEqual(['auto_assign', 'care_plan_fee_per_lead', 'dsa_payout_per_lead', 'gst_percent', 'tip_install_fee', 'tip_onboarding_fee']);
      expect(r.body.find((s: any) => s.key === 'gst_percent').value).toBe('18');
    });
    it('validates values and keys; only admin may change', async () => {
      await c.http().put(`${P}/settings/gst_percent`).set(bearer(a.admin)).send({ value: '150' }).expect(400);
      await c.http().put(`${P}/settings/gst_percent`).set(bearer(a.admin)).send({ value: 'abc' }).expect(400);
      await c.http().put(`${P}/settings/tip_install_fee`).set(bearer(a.admin)).send({ value: '-5' }).expect(400);
      await c.http().put(`${P}/settings/not_a_setting`).set(bearer(a.admin)).send({ value: '1' }).expect(400);
      await c.http().put(`${P}/settings/tip_install_fee`).set(bearer(a.admin)).send({}).expect(400);
      await c.http().put(`${P}/settings/tip_install_fee`).set(bearer(a.dream)).send({ value: '1' }).expect(403);
      await c.http().get(`${P}/settings`).set(bearer(a.dsa1)).expect(403);
      await c.http().get(`${P}/settings`).expect(401);
    });
    it('GST percent change flows into new charges', async () => {
      await c.http().put(`${P}/settings/gst_percent`).set(bearer(a.admin)).send({ value: '12' }).expect(200);
      const l = await newLead(c, a, { tip: 'dream' });
      const { result } = await install(c, a.dream, l.id);
      expect(result.charge).toMatchObject({ gst_percent: 12, total_amount: 560 });
      await c.http().put(`${P}/settings/gst_percent`).set(bearer(a.admin)).send({ value: '18' }).expect(200);
    });
  });

  describe('notifications', () => {
    it('users see their own messages and can mark them read; admin sees the whole log', async () => {
      const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
      await install(c, a.dream, l.id);
      const mine = await c.http().get(`${P}/notifications/me`).set(bearer(a.dsa1)).expect(200);
      expect(mine.body.items.length).toBeGreaterThan(0);
      expect(mine.body.items.every((n: any) => n.user_id === a.ids.dsa1)).toBe(true);
      expect(mine.body.unread).toBeGreaterThan(0);
      const first = mine.body.items[0];
      await c.http().patch(`${P}/notifications/${first.id}/read`).set(bearer(a.dsa1)).expect(200);
      await c.http().patch(`${P}/notifications/${first.id}/read`).set(bearer(a.dsa2)).expect(200); // someone else's: no effect
      expect((await c.prisma.notification.findUniqueOrThrow({ where: { id: first.id } })).read_at).toBeTruthy();
      const all = await c.http().get(`${P}/notifications`).set(bearer(a.admin)).expect(200);
      expect(all.body.total).toBeGreaterThan(0);
      await c.http().get(`${P}/notifications`).set(bearer(a.dsa1)).expect(403);
    });
    it('OTP and lead messages are recorded as sent (provider not configured => logged only)', async () => {
      const n = await c.prisma.notification.findFirst({ where: { template: 'new_lead' }, orderBy: { id: 'desc' } });
      expect(n?.status).toBe('sent');
    });
  });

  describe('reports', () => {
    it('every role gets scoped dashboard numbers', async () => {
      const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
      await install(c, a.dream, l.id);
      const dsa = (await c.http().get(`${P}/reports/me`).set(bearer(a.dsa1)).expect(200)).body;
      expect(dsa.leads.installed).toBeGreaterThan(0);
      expect(dsa.commission).toBeDefined();
      const tip = (await c.http().get(`${P}/reports/me`).set(bearer(a.dream)).expect(200)).body;
      expect(tip.charges.pending).toBeGreaterThan(0);
      expect(tip.leads_total).toBeGreaterThan(0);
      const cust = await makeCustomer(c);
      expect((await c.http().get(`${P}/reports/me`).set(bearer(cust.token)).expect(200)).body.leads_total).toBe(0);
      await c.http().get(`${P}/reports/me`).expect(401);
    });
    it('admin overview, hot PIN codes and partner performance', async () => {
      const ov = (await c.http().get(`${P}/reports/overview`).set(bearer(a.admin)).expect(200)).body;
      expect(ov.users).toMatchObject({ admin: expect.any(Number), tip: expect.any(Number), dsa: expect.any(Number) });
      expect(ov.leads.installed).toBeGreaterThan(0);
      expect(ov.charges.some((x: any) => x.kind === 'tip_install_fee')).toBe(true);
      expect(ov.commissions.length).toBeGreaterThan(0);
      expect(typeof ov.pending_partner_approvals).toBe('number');
      const pins = (await c.http().get(`${P}/reports/leads-by-pincode?limit=3`).set(bearer(a.admin)).expect(200)).body;
      expect(pins.length).toBeLessThanOrEqual(3);
      expect(pins[0].leads).toBeGreaterThanOrEqual(pins[pins.length - 1].leads);
      const partners = (await c.http().get(`${P}/reports/partners`).set(bearer(a.admin)).expect(200)).body;
      expect(partners.tips.length).toBeGreaterThan(0);
      expect(partners.dsas.length).toBeGreaterThan(0);
      for (const path of ['overview', 'leads-by-pincode', 'partners']) await c.http().get(`${P}/reports/${path}`).set(bearer(a.dream)).expect(403);
      await c.http().get(`${P}/reports/leads-by-pincode?limit=0`).set(bearer(a.admin)).expect(400);
    });
  });
});
