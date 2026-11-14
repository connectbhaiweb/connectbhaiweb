import { actors, bearer, createCtx, Ctx, makeCustomer, P } from './helpers';

describe('per-install rates come from Admin > Settings, the same for every DSA and TIP', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  it('GET /settings/partner: DSA, TIP and admin only, and only the rates they need', async () => {
    await c.http().get(`${P}/settings/partner`).expect(401);
    const cust = await makeCustomer(c);
    await c.http().get(`${P}/settings/partner`).set(bearer(cust.token)).expect(403);
    for (const t of [a.dsa1, a.dsa2, a.dream, a.doulat, a.admin]) {
      const r = await c.http().get(`${P}/settings/partner`).set(bearer(t)).expect(200);
      expect(Object.keys(r.body).sort()).toEqual(['dsa_payout_per_lead', 'gst_percent', 'lead_target_default', 'tip_install_fee']);
    }
    const dsa = (await c.http().get(`${P}/settings/partner`).set(bearer(a.dsa1)).expect(200)).body;
    const tip = (await c.http().get(`${P}/settings/partner`).set(bearer(a.dream)).expect(200)).body;
    expect(dsa).toEqual(tip);   // identical for every partner
  });

  it('changing a rate in Settings changes it for everyone', async () => {
    const before = (await c.http().get(`${P}/settings/partner`).set(bearer(a.dsa1)).expect(200)).body;
    await c.http().put(`${P}/settings/dsa_payout_per_lead`).set(bearer(a.admin)).send({ value: '350' }).expect(200);
    await c.http().put(`${P}/settings/tip_install_fee`).set(bearer(a.admin)).send({ value: '650' }).expect(200);
    await c.http().put(`${P}/settings/lead_target_default`).set(bearer(a.admin)).send({ value: '30' }).expect(200);
    try {
      for (const t of [a.dsa1, a.dsa2, a.dream, a.doulat]) {
        const r = await c.http().get(`${P}/settings/partner`).set(bearer(t)).expect(200);
        expect(r.body).toMatchObject({ dsa_payout_per_lead: 350, tip_install_fee: 650, lead_target_default: 30 });
      }
      const adminView = (await c.http().get(`${P}/settings`).set(bearer(a.admin)).expect(200)).body;
      expect(adminView.find((x: any) => x.key === 'lead_target_default')).toMatchObject({ value: '30' });
      await c.http().put(`${P}/settings/lead_target_default`).set(bearer(a.admin)).send({ value: '-1' }).expect(400);
    } finally {
      for (const [k, v] of Object.entries(before)) {
        if (k !== 'gst_percent') await c.http().put(`${P}/settings/${k}`).set(bearer(a.admin)).send({ value: String(v) }).expect(200);
      }
    }
  });
});
