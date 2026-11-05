import { actors, ADMIN_PHONE, bearer, createCtx, Ctx, DSA1_PHONE, install, makeCustomer, newLead, P, uniquePhone } from './helpers';

/** Endpoints the web app relies on: phone-only login, public settings, mock payments, inbox, charge creation, richer lists. */
describe('frontend integration', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  describe('login without a role (phone-only screen)', () => {
    it('OTP: a DSA number logs in as DSA, a new number becomes a customer', async () => {
      await c.http().post(`${P}/auth/otp/request`).send({ phone: DSA1_PHONE }).expect(200);
      const dsa = await c.http().post(`${P}/auth/otp/verify`).send({ phone: DSA1_PHONE, code: '123456' }).expect(200);
      expect(dsa.body.user.role).toBe('dsa');
      const phone = uniquePhone();
      await c.http().post(`${P}/auth/otp/request`).send({ phone }).expect(200);
      const cust = await c.http().post(`${P}/auth/otp/verify`).send({ phone, code: '123456', name: 'New Person' }).expect(200);
      expect(cust.body.user.role).toBe('customer');
    });
    it('password: admin works without a role; wrong password is refused', async () => {
      const ok = await c.http().post(`${P}/auth/login`).send({ phone: ADMIN_PHONE, password: process.env.SEED_ADMIN_PASSWORD }).expect(200);
      expect(ok.body.user.role).toBe('admin');
      await c.http().post(`${P}/auth/login`).send({ phone: ADMIN_PHONE, password: 'wrong-password' }).expect(401);
      await c.http().post(`${P}/auth/login`).send({ phone: uniquePhone(), password: 'whatever1' }).expect(401);
    });
  });

  it('GET /settings/public needs no login and exposes only fee amounts', async () => {
    const r = await c.http().get(`${P}/settings/public`).expect(200);
    expect(Object.keys(r.body).sort()).toEqual(['care_plan_fee_per_lead', 'gst_percent', 'tip_install_fee', 'tip_onboarding_fee']);
    expect(r.body.gst_percent).toBe(18);
    await c.http().get(`${P}/settings`).expect(401);
    await c.http().get(`${P}/settings`).set(bearer(a.dsa1)).expect(403);
    await c.http().get(`${P}/settings`).set(bearer(a.admin)).expect(200);
  });

  describe('customer payments (mock gateway)', () => {
    it('customer creates a GST-inclusive charge and settles it with mock-pay; others cannot touch it', async () => {
      const cust = await makeCustomer(c);
      const ch = await c.http().post(`${P}/charges/customer`).set(bearer(cust.token)).send({ description: 'Router rental', amount: 236 }).expect(201);
      expect(Number(ch.body.total_amount)).toBeCloseTo(236, 0);
      await c.http().post(`${P}/charges/${ch.body.id}/mock-pay`).expect(403);                  // anonymous
      await c.http().post(`${P}/charges/${ch.body.id}/mock-pay`).set(bearer(a.dream)).expect(403); // someone else
      const paid = await c.http().post(`${P}/charges/${ch.body.id}/mock-pay`).set(bearer(cust.token)).expect(200);
      expect(paid.body.status).toBe('paid');
      expect(paid.body.invoice_no).toMatch(/^CB-INV-\d{6}$/);
      await c.http().post(`${P}/charges/${ch.body.id}/mock-pay`).set(bearer(cust.token)).expect(400); // already paid
    });
    it('DSAs and TIPs cannot use the customer charge endpoint; amount is validated', async () => {
      await c.http().post(`${P}/charges/customer`).set(bearer(a.dsa1)).send({ description: 'x y z', amount: 100 }).expect(403);
      const cust = await makeCustomer(c);
      await c.http().post(`${P}/charges/customer`).set(bearer(cust.token)).send({ description: 'Router', amount: 0 }).expect(400);
      await c.http().post(`${P}/charges/customer`).set(bearer(cust.token)).send({ description: 'Router', amount: 99999999 }).expect(400);
    });
  });

  describe('admin raises a charge', () => {
    it('creates a GST charge for a TIP; non-admins are refused; unknown payer is a 400', async () => {
      const r = await c.http().post(`${P}/charges`).set(bearer(a.admin)).send({ payer_user_id: a.ids.dream, description: 'Router stock', base_amount: 1000, kind: 'other' }).expect(201);
      expect(Number(r.body.total_amount)).toBe(1180);
      await c.http().post(`${P}/charges`).set(bearer(a.dream)).send({ payer_user_id: a.ids.dream, description: 'self', base_amount: 10 }).expect(403);
      await c.http().post(`${P}/charges`).set(bearer(a.admin)).send({ payer_user_id: 99999999, description: 'ghost', base_amount: 10 }).expect(400);
    });
    it('charge list includes the payer so admin can show names', async () => {
      const r = await c.http().get(`${P}/charges?limit=5`).set(bearer(a.admin)).expect(200);
      expect(r.body.items[0].payer).toMatchObject({ id: expect.any(Number), name: expect.any(String), role: expect.any(String) });
    });
  });

  describe('lists carry what the screens need', () => {
    it('bookings include the lead plan and the TIP', async () => {
      const l = await newLead(c, a, { tip: 'dream' });
      await install(c, a.dream, l.id);
      const r = await c.http().get(`${P}/bookings?lead_id=${l.id}`).set(bearer(a.admin)).expect(200);
      const b = r.body.items[0];
      expect(b.lead.plan.category.name).toBeDefined();
      expect(b.tip).toMatchObject({ id: a.ids.dream });
    });
    it('tickets include the lead and who raised them', async () => {
      const l = await newLead(c, a, { tip: 'dream' });
      await c.http().post(`${P}/tickets`).set(bearer(a.admin)).send({ lead_id: l.id, subject: 'Integration ticket', category: 'other' }).expect(201);
      const r = await c.http().get(`${P}/tickets?limit=5`).set(bearer(a.admin)).expect(200);
      expect(r.body.items[0].raiser).toBeDefined();
      expect(r.body.items[0].lead.customer_name).toBeDefined();
    });
  });

  describe('GET /chat/threads (inbox)', () => {
    it('lists the lead thread with last message and unread count, and respects scope', async () => {
      const l = await newLead(c, a, { tip: 'dream' });
      await c.http().post(`${P}/chat/lead/${l.id}/messages`).set(bearer(a.dream)).send({ body: 'Hello from the TIP' }).expect(201);
      const admin = await c.http().get(`${P}/chat/threads`).set(bearer(a.admin)).expect(200);
      const row = admin.body.find((t: any) => t.type === 'lead' && t.id === l.id);
      expect(row.last.body).toBe('Hello from the TIP');
      expect(row.unread).toBe(1);
      await c.http().post(`${P}/chat/lead/${l.id}/read`).set(bearer(a.admin)).expect(200);
      const again = await c.http().get(`${P}/chat/threads`).set(bearer(a.admin)).expect(200);
      expect(again.body.find((t: any) => t.type === 'lead' && t.id === l.id).unread).toBe(0);
      const other = await c.http().get(`${P}/chat/threads`).set(bearer(a.doulat)).expect(200);   // a TIP that does not own the lead
      expect(other.body.find((t: any) => t.type === 'lead' && t.id === l.id)).toBeUndefined();
      await c.http().get(`${P}/chat/threads`).expect(401);
    });
    it('every user has their own support thread; admin sees support threads that have messages', async () => {
      const cust = await makeCustomer(c);
      const mine = await c.http().get(`${P}/chat/threads`).set(bearer(cust.token)).expect(200);
      expect(mine.body.some((t: any) => t.type === 'support' && t.id === Number(cust.user.id))).toBe(true);
      await c.http().post(`${P}/chat/support/${cust.user.id}/messages`).set(bearer(cust.token)).send({ body: 'Need help' }).expect(201);
      const admin = await c.http().get(`${P}/chat/threads`).set(bearer(a.admin)).expect(200);
      expect(admin.body.some((t: any) => t.type === 'support' && t.id === Number(cust.user.id) && t.unread >= 1)).toBe(true);
    });
  });
  describe('GET /locations/reverse ("Use my current location")', () => {
    const geo = (body: any, ok = true) => jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok, status: ok ? 200 : 500, json: async () => body } as any);
    afterEach(() => jest.restoreAllMocks());
    it('turns coordinates into a PIN code, area and city', async () => {
      geo({ address: { postcode: '452 010', suburb: 'Vijay Nagar', city: 'Indore', state: 'Madhya Pradesh' } });
      const r = await c.http().get(`${P}/locations/reverse?lat=22.7533&lng=75.8937`).expect(200);
      expect(r.body).toMatchObject({ pincode: '452010', area: 'Vijay Nagar', city: 'Indore' });
    });
    it('404 when the geocoder has no PIN, 503 when it is down, 400 outside India', async () => {
      geo({ address: { city: 'Somewhere' } });
      await c.http().get(`${P}/locations/reverse?lat=22.7&lng=75.8`).expect(404);
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network'));
      await c.http().get(`${P}/locations/reverse?lat=22.7&lng=75.8`).expect(503);
      await c.http().get(`${P}/locations/reverse?lat=0&lng=0`).expect(400);
      await c.http().get(`${P}/locations/reverse`).expect(400);
    });
  });

  describe('GET /locations/pincode/:pincode (form PIN lookup)', () => {
    const post = (offices: any[] | null) => jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, status: 200, json: async () => [offices ? { Status: 'Success', PostOffice: offices } : { Status: 'Error', PostOffice: null }] } as any);
    afterEach(() => jest.restoreAllMocks());
    it('returns state, district, area names and whether we serve the PIN', async () => {
      post([{ Name: 'Vijay Nagar', District: 'Indore', State: 'Madhya Pradesh' }, { Name: 'Indore DDU Nagar', District: 'Indore', State: 'Madhya Pradesh' }]);
      const r = await c.http().get(`${P}/locations/pincode/452010`).expect(200);
      expect(r.body).toMatchObject({ pincode: '452010', valid: true, state: 'Madhya Pradesh', district: 'Indore', serviceable: true, source: 'india_post' });
      expect(r.body.areas).toEqual(expect.arrayContaining(['Vijay Nagar', 'Indore DDU Nagar']));
    });
    it('an unknown PIN is valid:false; a malformed PIN is a 400; India Post being down falls back to our own areas', async () => {
      post(null);
      const bad = await c.http().get(`${P}/locations/pincode/999998`).expect(200);
      expect(bad.body).toMatchObject({ valid: false, serviceable: false, state: null });
      await c.http().get(`${P}/locations/pincode/12`).expect(400);
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('down'));
      const local = await c.http().get(`${P}/locations/pincode/452001`).expect(200);
      expect(local.body).toMatchObject({ valid: true, source: 'local' });
    });
  });

  describe('provider logos (Cloudinary path stored, URL built from env)', () => {
    it('the API returns the stored value unchanged when Cloudinary is not configured, and keeps site-relative paths', async () => {
      const cat = await c.prisma.planCategory.findFirstOrThrow({ where: { name: 'BSNL', type: 'fiber' } });
      const before = cat.logo_url;
      try {
        await c.prisma.planCategory.update({ where: { id: cat.id }, data: { logo_url: 'v1/connectbhai/logos/bsnl.svg' } });
        const r = await c.http().get(`${P}/plans?pincode=452010&type=fiber&limit=1`).expect(200);
        expect(r.body.items[0].category.logo_url).toBe('v1/connectbhai/logos/bsnl.svg');   // test env has no cloud name, so nothing to build
        await c.prisma.planCategory.update({ where: { id: cat.id }, data: { logo_url: '/logos/bsnl.svg' } });
        expect((await c.http().get(`${P}/plans?pincode=452010&type=fiber&limit=1`).expect(200)).body.items[0].category.logo_url).toBe('/logos/bsnl.svg');
      } finally { await c.prisma.planCategory.update({ where: { id: cat.id }, data: { logo_url: before } }); }
    });
  });
});
