import { actors, bearer, createCtx, Ctx, makeCustomer, P, tokenFor, uniquePhone } from './helpers';

const dsaApplication = (over: object = {}) => ({
  role: 'dsa', name: 'Coverage Test', phone: uniquePhone(), address: '3 Test Road, Indore', pincode: '452001',
  aadhaar: '9999 1111 2222', pan: 'ABCDE1234F', bank_name: 'SBI', bank_account: '123456789012', bank_ifsc: 'SBIN0001234', ...over,
});

describe('DSA PIN coverage: the PIN codes a DSA serves decide which new leads they get', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());
  const rows = (id: number) => c.prisma.dsaPincodeMapping.findMany({ where: { dsa_user_id: id }, orderBy: { pincode: 'asc' } });

  it('an application saves the PIN codes the DSA serves, off until approved; suspending switches them off again', async () => {
    const reg = await c.http().post(`${P}/partners/register`).send(dsaApplication({ service_pincodes: ['999601', '999602', '999601'] })).expect(201);
    const id = reg.body.user.id;
    expect((await rows(id)).map((r) => [r.pincode, r.is_active])).toEqual([['999601', false], ['999602', false]]);   // de-duplicated, not live yet
    await c.http().patch(`${P}/users/${id}/partner-status`).set(bearer(a.admin)).send({ status: 'approved' }).expect(200);
    expect((await rows(id)).every((r) => r.is_active)).toBe(true);
    await c.http().patch(`${P}/users/${id}/partner-status`).set(bearer(a.admin)).send({ status: 'suspended' }).expect(200);
    expect((await rows(id)).every((r) => !r.is_active)).toBe(true);
  });

  it('admin sets a DSA\'s PIN codes (the list is replaced); a TIP\'s cannot be set this way; bad input and other roles are refused', async () => {
    const reg = await c.http().post(`${P}/partners/register`).send(dsaApplication({ service_pincodes: ['999611'] })).expect(201);
    const id = reg.body.user.id;
    await c.http().patch(`${P}/users/${id}/partner-status`).set(bearer(a.admin)).send({ status: 'approved' }).expect(200);
    await c.http().patch(`${P}/users/${id}`).send({ service_pincodes: ['999612'] }).expect(401);
    await c.http().patch(`${P}/users/${id}`).set(bearer(a.dsa1)).send({ service_pincodes: ['999612'] }).expect(403);
    await c.http().patch(`${P}/users/${id}`).set(bearer(a.admin)).send({ service_pincodes: ['12'] }).expect(400);
    await c.http().patch(`${P}/users/${id}`).set(bearer(a.admin)).send({ service_pincodes: ['999612', '999613'] }).expect(200);
    expect((await rows(id)).map((r) => [r.pincode, r.is_active])).toEqual([['999612', true], ['999613', true]]);   // 999611 is gone, new ones are live
    await c.http().patch(`${P}/users/${id}`).set(bearer(a.admin)).send({ service_pincodes: [] }).expect(200);
    expect(await rows(id)).toHaveLength(0);
    await c.http().patch(`${P}/users/${a.ids.dream}`).set(bearer(a.admin)).send({ service_pincodes: ['999612'] }).expect(400);   // a TIP: coverage is managed elsewhere
    await c.http().patch(`${P}/users/${id}`).set(bearer(a.admin)).send({ name: 'Renamed DSA' }).expect(200);                  // other edits leave the coverage alone
    expect(await rows(id)).toHaveLength(0);
  });

  it('the partner list and detail show a DSA\'s PIN codes', async () => {
    const reg = await c.http().post(`${P}/partners/register`).send(dsaApplication({ service_pincodes: ['999622', '999621'] })).expect(201);
    const id = reg.body.user.id;
    const list = await c.http().get(`${P}/users?role=dsa&limit=100`).set(bearer(a.admin)).expect(200);
    expect(list.body.items.find((u: any) => u.id === id).service_pincodes).toEqual(['999621', '999622']);
    expect(list.body.items.every((u: any) => u.dsa_pincodes === undefined)).toBe(true);   // only the plain list of PIN codes
    const one = await c.http().get(`${P}/users/${id}`).set(bearer(a.admin)).expect(200);
    expect(one.body.service_pincodes).toEqual(['999621', '999622']);
  });

  it('a newly approved DSA gets the next lead in their PIN code, and deleting the DSA removes their coverage', async () => {
    const indore = await c.prisma.city.findUniqueOrThrow({ where: { name: 'Indore' } });
    await c.prisma.area.create({ data: { city_id: indore.id, name: 'Coverage Colony', pincode: '999631' } });
    const reg = await c.http().post(`${P}/partners/register`).send(dsaApplication({ service_pincodes: ['999631'] })).expect(201);
    const id = reg.body.user.id;
    const before = await c.http().post(`${P}/leads`).send({ customer_name: 'Before Approval', customer_phone: uniquePhone(), pincode: '999631' }).expect(201);
    expect(before.body.brought_by_user_id).toBeNull();                    // not approved yet: the lead waits for admin
    await c.http().patch(`${P}/users/${id}/partner-status`).set(bearer(a.admin)).send({ status: 'approved' }).expect(200);
    const after = await c.http().post(`${P}/leads`).send({ customer_name: 'After Approval', customer_phone: uniquePhone(), pincode: '999631' }).expect(201);
    expect(after.body.brought_by_user_id).toBe(id);
    const token = await tokenFor(c, 'dsa', reg.body.user.phone);
    const mine = await c.http().get(`${P}/leads?limit=50`).set(bearer(token)).expect(200);
    expect(mine.body.items.map((l: any) => l.id)).toEqual([after.body.id]);   // the DSA sees only their lead
    await c.http().delete(`${P}/users/${id}`).set(bearer(a.admin)).expect(200);
    expect(await rows(id)).toHaveLength(0);
    const cust = await makeCustomer(c);
    expect(cust.user.id).toBeTruthy();
  });
});
