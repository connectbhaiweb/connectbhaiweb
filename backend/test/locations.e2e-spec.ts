import { actors, bearer, createCtx, Ctx, makeCustomer, P, PIN } from './helpers';

describe('locations', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  it('lists live and soon cities publicly, hides hidden ones', async () => {
    await c.prisma.city.upsert({ where: { name: 'HiddenTown' }, update: {}, create: { name: 'HiddenTown', status: 'hidden' } });
    const r = await c.http().get(`${P}/cities`).expect(200);
    const names = r.body.map((x: any) => x.name);
    expect(names).toContain('Indore');
    expect(names).toContain('Bhopal');
    expect(names).not.toContain('HiddenTown');
    expect(r.body.find((x: any) => x.name === 'Indore').status).toBe('live');
  });

  it('PIN lookup: serviceable PIN returns areas and plan count', async () => {
    const r = await c.http().get(`${P}/pincodes/${PIN}`).expect(200);
    expect(r.body).toMatchObject({ pincode: PIN, serviceable: true });
    expect(r.body.city.name).toBe('Indore');
    expect(r.body.areas.length).toBeGreaterThan(0);
    expect(r.body.plan_count).toBeGreaterThan(0);
  });
  it('PIN lookup: unknown PIN is not serviceable; malformed PIN is a 400', async () => {
    const r = await c.http().get(`${P}/pincodes/999999`).expect(200);
    expect(r.body).toMatchObject({ serviceable: false, areas: [], plan_count: 0 });
    await c.http().get(`${P}/pincodes/12ab`).expect(400);
    await c.http().get(`${P}/pincodes/012345`).expect(400);
  });
  it('areas of a city', async () => {
    const indore = await c.prisma.city.findUniqueOrThrow({ where: { name: 'Indore' } });
    const r = await c.http().get(`${P}/cities/${indore.id}/areas`).expect(200);
    expect(r.body.length).toBeGreaterThan(50);
    await c.http().get(`${P}/cities/abc/areas`).expect(400);
  });

  it('only admin can manage cities and areas', async () => {
    const cust = await makeCustomer(c);
    await c.http().post(`${P}/cities`).send({ name: 'X City' }).expect(401);
    await c.http().post(`${P}/cities`).set(bearer(cust.token)).send({ name: 'X City' }).expect(403);
    await c.http().post(`${P}/cities`).set(bearer(a.dsa1)).send({ name: 'X City' }).expect(403);
  });
  it('admin creates, updates a city and adds / removes an area', async () => {
    const name = `Testpur ${Date.now()}`;
    const city = await c.http().post(`${P}/cities`).set(bearer(a.admin)).send({ name }).expect(201);
    expect(city.body.status).toBe('soon');
    await c.http().post(`${P}/cities`).set(bearer(a.admin)).send({ name }).expect(409);
    await c.http().patch(`${P}/cities/${city.body.id}`).set(bearer(a.admin)).send({ status: 'live' }).expect(200);
    await c.http().patch(`${P}/cities/${city.body.id}`).set(bearer(a.admin)).send({ status: 'bogus' }).expect(400);
    const area = await c.http().post(`${P}/cities/${city.body.id}/areas`).set(bearer(a.admin)).send({ name: 'Sector 1', pincode: '999001' }).expect(201);
    await c.http().post(`${P}/cities/${city.body.id}/areas`).set(bearer(a.admin)).send({ name: 'Sector 1', pincode: '999001' }).expect(409);
    await c.http().post(`${P}/cities/${city.body.id}/areas`).set(bearer(a.admin)).send({ name: 'Bad', pincode: '12' }).expect(400);
    await c.http().post(`${P}/cities/999999/areas`).set(bearer(a.admin)).send({ name: 'Nope', pincode: '999002' }).expect(404);
    expect((await c.http().get(`${P}/pincodes/999001`).expect(200)).body.serviceable).toBe(true);
    await c.http().delete(`${P}/areas/${area.body.id}`).set(bearer(a.admin)).expect(200);
    await c.http().delete(`${P}/areas/${area.body.id}`).set(bearer(a.admin)).expect(404);
  });

  it('admin renames an area; the PIN code cannot be changed and duplicates are refused', async () => {
    const city = await c.http().post(`${P}/cities`).set(bearer(a.admin)).send({ name: `Renamepur ${Date.now()}` }).expect(201);
    const one = await c.http().post(`${P}/cities/${city.body.id}/areas`).set(bearer(a.admin)).send({ name: 'Old Name', pincode: '999011' }).expect(201);
    const two = await c.http().post(`${P}/cities/${city.body.id}/areas`).set(bearer(a.admin)).send({ name: 'Other Name', pincode: '999011' }).expect(201);
    const cust = await makeCustomer(c);
    await c.http().patch(`${P}/areas/${one.body.id}`).send({ name: 'New Name' }).expect(401);
    await c.http().patch(`${P}/areas/${one.body.id}`).set(bearer(cust.token)).send({ name: 'New Name' }).expect(403);
    const r = await c.http().patch(`${P}/areas/${one.body.id}`).set(bearer(a.admin)).send({ name: '  New Name  ' }).expect(200);
    expect(r.body).toMatchObject({ name: 'New Name', pincode: '999011' });
    await c.http().patch(`${P}/areas/${one.body.id}`).set(bearer(a.admin)).send({ name: 'Other Name' }).expect(409);
    await c.http().patch(`${P}/areas/${one.body.id}`).set(bearer(a.admin)).send({ name: 'x' }).expect(400);
    await c.http().patch(`${P}/areas/${one.body.id}`).set(bearer(a.admin)).send({ name: 'Fine Name', pincode: '999012' }).expect(400);   // the PIN code is not editable
    await c.http().patch(`${P}/areas/999999999`).set(bearer(a.admin)).send({ name: 'Nope' }).expect(404);
    await c.http().delete(`${P}/areas/${one.body.id}`).set(bearer(a.admin)).expect(200);
    await c.http().delete(`${P}/areas/${two.body.id}`).set(bearer(a.admin)).expect(200);
  });

  it('admin adds many PIN / area rows at once (sheet); existing rows are skipped, bad rows are refused', async () => {
    const city = await c.http().post(`${P}/cities`).set(bearer(a.admin)).send({ name: `Bulkpur ${Date.now()}` }).expect(201);
    const url = `${P}/cities/${city.body.id}/areas/bulk`;
    const rows = [{ name: 'Alpha Colony', pincode: '999021' }, { name: ' Beta Nagar ', pincode: '999021' }, { name: 'Gamma Park', pincode: '999022' }];
    await c.http().post(url).send({ areas: rows }).expect(401);
    const cust = await makeCustomer(c);
    await c.http().post(url).set(bearer(cust.token)).send({ areas: rows }).expect(403);
    const r = await c.http().post(url).set(bearer(a.admin)).send({ areas: rows }).expect(201);
    expect(r.body).toEqual({ added: 3, skipped: 0 });
    const again = await c.http().post(url).set(bearer(a.admin)).send({ areas: [...rows, { name: 'Delta Road', pincode: '999022' }] }).expect(201);
    expect(again.body).toEqual({ added: 1, skipped: 3 });
    const saved = await c.prisma.area.findMany({ where: { city_id: city.body.id }, orderBy: { name: 'asc' } });
    expect(saved.map((x) => x.name)).toEqual(['Alpha Colony', 'Beta Nagar', 'Delta Road', 'Gamma Park']);   // names are trimmed
    await c.http().post(url).set(bearer(a.admin)).send({ areas: [{ name: 'Bad Pin', pincode: '12' }] }).expect(400);
    await c.http().post(url).set(bearer(a.admin)).send({ areas: [] }).expect(400);
    await c.http().post(url).set(bearer(a.admin)).send({}).expect(400);
    await c.http().post(`${P}/cities/999999/areas/bulk`).set(bearer(a.admin)).send({ areas: rows }).expect(404);
    await c.prisma.area.deleteMany({ where: { city_id: city.body.id } });
  });

  it('admin manages the TIP <-> PIN mapping', async () => {
    const pin = '999777';
    const add = await c.http().post(`${P}/admin/tip-pincodes`).set(bearer(a.admin)).send({ pincode: pin, tip_user_id: a.ids.dream }).expect(201);
    await c.http().post(`${P}/admin/tip-pincodes`).set(bearer(a.admin)).send({ pincode: pin, tip_user_id: a.ids.dream }).expect(201); // idempotent upsert
    expect((await c.prisma.tipPincodeMapping.count({ where: { pincode: pin } }))).toBe(1);
    await c.http().post(`${P}/admin/tip-pincodes`).set(bearer(a.admin)).send({ pincode: pin, tip_user_id: a.ids.dsa1 }).expect(400); // not a TIP
    const list = await c.http().get(`${P}/admin/tip-pincodes?pincode=${pin}`).set(bearer(a.admin)).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].tip.name).toBeDefined();
    await c.http().patch(`${P}/admin/tip-pincodes/${add.body.id}`).set(bearer(a.admin)).send({ is_active: false }).expect(200);
    await c.http().delete(`${P}/admin/tip-pincodes/${add.body.id}`).set(bearer(a.admin)).expect(200);
    await c.http().get(`${P}/admin/tip-pincodes`).set(bearer(a.dream)).expect(403);
  });
});
