import { actors, bearer, createCtx, Ctx, makeCustomer, newLead, P } from './helpers';

describe('pagination and search', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());
  const get = (path: string, who: string = 'admin') => c.http().get(`${P}${path}`).set(bearer((a as any)[who]));

  describe('limits are enforced on every list', () => {
    it.each(['/leads', '/users', '/charges', '/commissions', '/tickets', '/bookings', '/notifications', '/plans'])('%s rejects page=0, limit=0 and limit=201, and echoes valid values', async (path) => {
      for (const q of ['page=0', 'limit=0', 'limit=201', 'page=abc', 'limit=1.5']) expect((await get(`${path}?${q}`)).status).toBe(400);
      const ok = await get(`${path}?page=1&limit=2`).expect(200);
      expect(ok.body).toMatchObject({ page: 1, limit: 2 });
      expect(ok.body.items.length).toBeLessThanOrEqual(2);
    });
    it('a page past the end is an empty list with the true total, not an error', async () => {
      const r = await get('/leads?page=9999&limit=25').expect(200);
      expect(r.body.items).toEqual([]);
      expect(r.body.total).toBeGreaterThan(0);
    });
  });

  describe('walking every page returns every row exactly once', () => {
    it.each(['/leads', '/users', '/plans'])('%s', async (path) => {
      const first = await get(`${path}?limit=7&page=1`).expect(200);
      const total = first.body.total, ids: number[] = [];
      for (let p = 1; p <= Math.ceil(total / 7); p++) ids.push(...(await get(`${path}?limit=7&page=${p}`).expect(200)).body.items.map((x: any) => x.id));
      expect(ids).toHaveLength(total);
      expect(new Set(ids).size).toBe(total);
    });
  });

  describe('search (q)', () => {
    let lead: any;
    beforeAll(async () => { lead = await newLead(c, a, { by: 'dsa1', tip: 'dream' }); });
    it('leads: finds by name, phone, ref code and is case-insensitive; no match gives total 0', async () => {
      const name = (await c.prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).customer_name;
      for (const q of [name.slice(0, 5), name.slice(0, 5).toUpperCase(), lead.customer_phone, lead.customer_phone.slice(2, 8), lead.ref_code]) {
        const r = await get(`/leads?q=${encodeURIComponent(q)}&limit=200`).expect(200);
        expect(r.body.items.map((x: any) => x.id)).toContain(lead.id);
      }
      expect((await get('/leads?q=zzzznomatchzzzz').expect(200)).body.total).toBe(0);
    });
    it('leads: search never leaks across roles (a TIP only searches their own leads)', async () => {
      const other = await get(`/leads?q=${lead.ref_code}`, 'doulat').expect(200);
      expect(other.body.items).toHaveLength(0);
      const mine = await get(`/leads?q=${lead.ref_code}`, 'dream').expect(200);
      expect(mine.body.items).toHaveLength(1);
    });
    it('leads: filters combine (status + pincode + source)', async () => {
      const r = await get('/leads?status=new&pincode=452010&limit=200').expect(200);
      expect(r.body.items.every((x: any) => x.status === 'new' && x.pincode === '452010')).toBe(true);
      expect((await get('/leads?status=bogus')).status).toBe(400);
      expect((await get('/leads?pincode=12')).status).toBe(400);
    });
    it('users: finds by name, phone and partner code', async () => {
      const dsa = await c.prisma.user.findFirstOrThrow({ where: { role: 'dsa', partner_code: { not: null } } });
      for (const q of [dsa.name.split(' ')[0], dsa.phone, dsa.partner_code!]) {
        const r = await get(`/users?q=${encodeURIComponent(q)}&limit=200`).expect(200);
        expect(r.body.items.map((x: any) => x.id)).toContain(Number(dsa.id));
      }
      const onlyTips = await get('/users?role=tip&limit=200').expect(200);
      expect(onlyTips.body.items.every((x: any) => x.role === 'tip')).toBe(true);
    });
    it('search text is treated as data (SQL/wildcard characters are harmless)', async () => {
      for (const q of ["' OR 1=1 --", '%', '_', '\\', '"; DROP TABLE leads;--']) expect((await get(`/leads?q=${encodeURIComponent(q)}`)).status).toBe(200);
      expect(await c.prisma.lead.count()).toBeGreaterThan(0);
    });
    it('plans: free-text, price (before GST), speed and brand filters narrow results correctly', async () => {
      const all = (await get('/plans?type=fiber&limit=200').expect(200)).body.items;
      const cheap = (await get('/plans?type=fiber&max_price=500&limit=200').expect(200)).body.items;
      expect(cheap.length).toBeGreaterThan(0); expect(cheap.length).toBeLessThan(all.length);
      expect(cheap.every((p: any) => p.price_ex_gst <= 500)).toBe(true);
      const fast = (await get('/plans?type=fiber&min_speed=200&limit=200').expect(200)).body.items;
      expect(fast.every((p: any) => p.speed_mbps >= 200)).toBe(true);
      const jio = (await get('/plans?brand=Jio&limit=200').expect(200)).body.items;
      expect(jio.every((p: any) => p.category.name === 'Jio')).toBe(true);
      const band = (await get('/plans?type=fiber&min_price=400&max_price=600&limit=200').expect(200)).body.items;
      expect(band.every((p: any) => p.price_ex_gst >= 400 && p.price_ex_gst <= 600)).toBe(true);
      expect((await get('/plans?sort=price_desc&type=fiber&limit=200').expect(200)).body.items.map((p: any) => p.price)).toEqual([...all.map((p: any) => p.price)].sort((x: number, y: number) => y - x));
    });
  });

  describe('customers only ever see their own rows', () => {
    it('two customers searching the same text never see each other', async () => {
      const [c1, c2] = [await makeCustomer(c, 'Search Owner'), await makeCustomer(c, 'Other Person')];
      const mine = await c.http().post(`${P}/leads`).set(bearer(c1.token)).send({ customer_name: 'Search Owner', customer_phone: c1.phone, pincode: '452010', source: 'callback' }).expect(201);
      const seen = await c.http().get(`${P}/leads?q=${c1.phone}`).set(bearer(c1.token)).expect(200);
      expect(seen.body.items.map((x: any) => x.id)).toContain(mine.body.id);
      const leak = await c.http().get(`${P}/leads?q=${c1.phone}`).set(bearer(c2.token)).expect(200);
      expect(leak.body.items).toHaveLength(0);
      await c.http().get(`${P}/leads/${mine.body.id}`).set(bearer(c2.token)).expect(404);
    });
  });
});
