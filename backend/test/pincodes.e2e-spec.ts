import { actors, bearer, createCtx, Ctx, P } from './helpers';
import { PincodeService } from '../src/locations/pincode.service';

/** India Post is mocked: tests never touch the network. */
describe('PIN code lookup and import (India Post)', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>; let svc: PincodeService;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); svc = c.app.get(PincodeService); });
  afterAll(() => c.app.close());
  beforeEach(() => svc.clearCache());
  afterEach(() => jest.restoreAllMocks());

  const offices = (pin: string, names: string[], district = 'Indore', state = 'Madhya Pradesh') => [{ Status: 'Success', PostOffice: names.map((Name) => ({ Name, District: district, State: state, Pincode: pin })) }];
  const none = [{ Status: 'Error', PostOffice: null }];
  const mockPost = (table: Record<string, any>) => jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
    const pin = String(url).split('/').pop()!;
    if (!(pin in table)) throw new Error('network');
    return { ok: true, status: 200, json: async () => table[pin] } as any;
  });

  it('checks 2-3 PINs in one call: valid ones get areas, unknown and malformed ones are flagged', async () => {
    mockPost({ '452010': offices('452010', ['Vijay Nagar', 'Indore DDU Nagar']), '452016': offices('452016', ['Nipania']), '999998': none });
    const r = await c.http().get(`${P}/locations/pincodes?codes=452010,452016,999998,12ab`).expect(200);
    expect(r.body.map((x: any) => [x.pincode, x.valid])).toEqual([['452010', true], ['452016', true], ['999998', false], ['12ab', false]]);
    expect(r.body[0]).toMatchObject({ state: 'Madhya Pradesh', district: 'Indore', areas: ['Vijay Nagar', 'Indore DDU Nagar'], serviceable: true });
    expect(r.body[3].error).toMatch(/6-digit/);
  });
  it('duplicates and spaces are collapsed; empty and oversized lists are 400', async () => {
    mockPost({ '452010': offices('452010', ['Vijay Nagar']) });
    const r = await c.http().get(`${P}/locations/pincodes?codes=452010,%20452010,452010`).expect(200);
    expect(r.body).toHaveLength(1);
    await c.http().get(`${P}/locations/pincodes`).expect(400);
    await c.http().get(`${P}/locations/pincodes?codes=${Array.from({ length: 11 }, (_, i) => 452000 + i).join(',')}`).expect(400);
  });
  it('caches India Post answers (positive and negative) for 24 h', async () => {
    const spy = mockPost({ '452010': offices('452010', ['Vijay Nagar']), '999998': none });
    await c.http().get(`${P}/locations/pincode/452010`).expect(200);
    await c.http().get(`${P}/locations/pincode/452010`).expect(200);
    await c.http().get(`${P}/locations/pincode/999998`).expect(200);
    await c.http().get(`${P}/locations/pincode/999998`).expect(200);
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('falls back to our own areas when India Post is down, and says so', async () => {
    mockPost({});
    const r = await c.http().get(`${P}/locations/pincode/452010`).expect(200);
    expect(r.body).toMatchObject({ valid: true, source: 'local', serviceable: true });
    expect(r.body.areas.length).toBeGreaterThan(0);
    const unknown = await c.http().get(`${P}/locations/pincode/999997`).expect(503);   // down AND not ours: cannot tell
    expect(JSON.stringify(unknown.body)).toMatch(/unavailable/);
  });
  it('a PIN outside Madhya Pradesh is valid but not serviceable', async () => {
    mockPost({ '110001': offices('110001', ['Connaught Place'], 'New Delhi', 'Delhi') });
    const r = await c.http().get(`${P}/locations/pincode/110001`).expect(200);
    expect(r.body).toMatchObject({ valid: true, serviceable: false, state: 'Delhi' });
  });

  describe('POST /admin/pincodes/import', () => {
    it('admin imports PINs from India Post as areas of a city, and repeating it adds nothing new', async () => {
      const table = { '453001': offices('453001', ['Ujjain City', 'Freeganj']), '999996': none };
      mockPost(table);
      const city = await c.prisma.city.upsert({ where: { name: 'Ujjain' }, update: {}, create: { name: 'Ujjain', status: 'soon' } });
      const body = { city_id: Number(city.id), pincodes: ['453001', '999996'] };
      const r = await c.http().post(`${P}/admin/pincodes/import`).set(bearer(a.admin)).send(body).expect(201);
      expect(r.body.added).toEqual([{ pincode: '453001', areas: 2 }]);
      expect(r.body.skipped).toEqual([{ pincode: '999996', reason: expect.stringMatching(/not found/i) }]);
      expect(await c.prisma.area.count({ where: { city_id: city.id, pincode: '453001' } })).toBe(2);
      const again = await c.http().post(`${P}/admin/pincodes/import`).set(bearer(a.admin)).send(body).expect(201);
      expect(again.body.added).toEqual([{ pincode: '453001', areas: 0 }]);
    });
    it('is admin-only and validates its input', async () => {
      const body = { city_id: 1, pincodes: ['452010'] };
      await c.http().post(`${P}/admin/pincodes/import`).send(body).expect(401);
      await c.http().post(`${P}/admin/pincodes/import`).set(bearer(a.dream)).send(body).expect(403);
      await c.http().post(`${P}/admin/pincodes/import`).set(bearer(a.admin)).send({ city_id: 1, pincodes: [] }).expect(400);
      await c.http().post(`${P}/admin/pincodes/import`).set(bearer(a.admin)).send({ city_id: 1, pincodes: ['abc'] }).expect(400);
      await c.http().post(`${P}/admin/pincodes/import`).set(bearer(a.admin)).send({ city_id: 99999, pincodes: ['452010'] }).expect(404);
    });
  });
});
