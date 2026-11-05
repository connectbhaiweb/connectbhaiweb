import { actors, bearer, createCtx, Ctx, P, PIN } from './helpers';

describe('catalogue', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  it('lists categories (brands) and OTT apps', async () => {
    const cats = await c.http().get(`${P}/plan-categories`).expect(200);
    expect(cats.body.map((x: any) => x.name)).toEqual(expect.arrayContaining(['BSNL', 'Airtel', 'Jio']));
    const otts = await c.http().get(`${P}/ott-apps`).expect(200);
    expect(otts.body.length).toBeGreaterThan(5);
  });

  it('plans for a PIN: cheapest first, with category and OTT apps', async () => {
    const r = await c.http().get(`${P}/plans?pincode=${PIN}&type=fiber&limit=50`).expect(200);
    expect(r.body.total).toBeGreaterThan(5);
    const prices = r.body.items.map((p: any) => p.price);
    expect([...prices].sort((x: number, y: number) => x - y)).toEqual(prices);
    expect(r.body.items[0].category).toMatchObject({ type: 'fiber' });
    expect(Array.isArray(r.body.items[0].ott_apps)).toBe(true);
    expect(r.body.items.some((p: any) => p.plan_code === 'BSNL-01')).toBe(true);
  });
  it('sorting, brand, price, speed and pagination filters', async () => {
    const desc = await c.http().get(`${P}/plans?pincode=${PIN}&sort=price_desc&limit=5`).expect(200);
    expect(desc.body.items.length).toBeLessThanOrEqual(5);
    expect(desc.body.items[0].price).toBeGreaterThanOrEqual(desc.body.items[desc.body.items.length - 1].price);
    const brand = await c.http().get(`${P}/plans?brand=Airtel&type=fiber`).expect(200);
    expect(brand.body.items.length).toBeGreaterThan(0);
    expect(brand.body.items.every((p: any) => p.category.name === 'Airtel')).toBe(true);
    const cheap = await c.http().get(`${P}/plans?pincode=${PIN}&max_price=600&type=fiber`).expect(200);
    expect(cheap.body.items.length).toBeGreaterThan(0);
    expect(cheap.body.items.every((p: any) => p.price_ex_gst <= 600)).toBe(true);   // budget filters compare the price BEFORE GST
    const fast = await c.http().get(`${P}/plans?pincode=${PIN}&min_speed=200&type=fiber`).expect(200);
    expect(fast.body.items.every((p: any) => p.speed_mbps >= 200)).toBe(true);
    const air = await c.http().get(`${P}/plans?type=airfiber`).expect(200);
    expect(air.body.items.every((p: any) => p.category.type === 'airfiber')).toBe(true);
    const p2 = await c.http().get(`${P}/plans?limit=3&page=2`).expect(200);
    expect(p2.body).toMatchObject({ page: 2, limit: 3 });
  });
  it('filters plans by OTT app', async () => {
    const link = await c.prisma.planOttApp.findFirstOrThrow({ include: { ott: true } });
    const r = await c.http().get(`${P}/plans?ott=${encodeURIComponent(link.ott.name)}`).expect(200);
    expect(r.body.total).toBeGreaterThan(0);
    expect(r.body.items.every((p: any) => p.ott_apps.some((o: any) => o.name.includes(link.ott.name)))).toBe(true);
  });
  it('a PIN with no mapping returns no plans', async () => {
    expect((await c.http().get(`${P}/plans?pincode=999999`).expect(200)).body.total).toBe(0);
  });
  it('validates query params', async () => {
    await c.http().get(`${P}/plans?pincode=abc`).expect(400);
    await c.http().get(`${P}/plans?limit=9999`).expect(400);
    await c.http().get(`${P}/plans?type=satellite`).expect(400);
    await c.http().get(`${P}/plans?bogus=1`).expect(400);
  });
  it('plan by code (and 404)', async () => {
    const r = await c.http().get(`${P}/plans/BSNL-01`).expect(200);
    expect(r.body).toMatchObject({ plan_code: 'BSNL-01', price: 471 });
    await c.http().get(`${P}/plans/NOPE-99`).expect(404);
  });

  it('only admin can change the catalogue', async () => {
    await c.http().post(`${P}/plans`).send({}).expect(401);
    await c.http().post(`${P}/plans`).set(bearer(a.dream)).send({}).expect(403);
    await c.http().post(`${P}/plan-categories`).set(bearer(a.dsa1)).send({ name: 'X' }).expect(403);
  });
  it('admin creates a category, plan, attaches OTT apps and maps it to a PIN; inactive plans disappear', async () => {
    const code = `T-${Date.now()}`;
    const cat = await c.http().post(`${P}/plan-categories`).set(bearer(a.admin)).send({ name: `TestNet ${code}`, type: 'fiber' }).expect(201);
    const bad = await c.http().post(`${P}/plans`).set(bearer(a.admin)).send({ plan_code: code, category_id: cat.body.id, name: 'x', price: -5 }).expect(400);
    expect(JSON.stringify(bad.body.message)).toMatch(/price/);
    const plan = await c.http().post(`${P}/plans`).set(bearer(a.admin)).send({ plan_code: code, category_id: cat.body.id, name: 'Test Plan 100', speed_mbps: 100, price: 777, benefits: { note: 'hi' } }).expect(201);
    await c.http().post(`${P}/plans`).set(bearer(a.admin)).send({ plan_code: code, category_id: cat.body.id, name: 'dup', price: 1 }).expect(409);
    const ott = await c.http().post(`${P}/ott-apps`).set(bearer(a.admin)).send({ name: `TestOTT ${code}` }).expect(201);
    const withOtt = await c.http().put(`${P}/plans/${plan.body.id}/ott-apps`).set(bearer(a.admin)).send({ ott_app_ids: [ott.body.id] }).expect(200);
    expect(withOtt.body.ott_apps).toHaveLength(1);
    await c.http().put(`${P}/pincodes/${PIN}/plans`).set(bearer(a.admin)).send({ plan_ids: [999999] }).expect(400);
    const existing = await c.prisma.pincodePlanMapping.findMany({ where: { pincode: PIN } });
    await c.http().put(`${P}/pincodes/${PIN}/plans`).set(bearer(a.admin)).send({ plan_ids: [...existing.map((e) => Number(e.plan_id)), Number(plan.body.id)] }).expect(200);
    expect((await c.http().get(`${P}/plans?pincode=${PIN}&q=${code}`).expect(200)).body.total).toBe(1);
    await c.http().patch(`${P}/plans/${plan.body.id}`).set(bearer(a.admin)).send({ price: 799, is_active: false }).expect(200);
    expect((await c.http().get(`${P}/plans?pincode=${PIN}&q=${code}`).expect(200)).body.total).toBe(0);
    expect((await c.http().get(`${P}/plans/${code}`).expect(200)).body.price).toBe(799);
  });
});
