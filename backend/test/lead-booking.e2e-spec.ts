import { actors, bearer, createCtx, Ctx, newLead, P } from './helpers';

describe('a booked lead carries its booking, so the TIP can Install it', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  it('lead -> booked -> installed: the lead shows its latest booking at every step', async () => {
    const lead = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
    const get = async (token: string) => (await c.http().get(`${P}/leads/${lead.id}`).set(bearer(token)).expect(200)).body;
    expect((await get(a.dream)).bookings).toEqual([]);   // assigned, nothing booked yet

    const bk = await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: lead.id, scheduled_at: new Date(Date.now() + 86_400_000).toISOString() }).expect(201);
    const booked = await get(a.dream);
    expect(booked.status).toBe('scheduled');
    expect(booked.bookings).toHaveLength(1);
    expect(booked.bookings[0]).toMatchObject({ id: bk.body.id, status: 'scheduled' });
    // the TIP's lead list carries it too (that is what the Install button reads)
    const inList = (await c.http().get(`${P}/leads?status=scheduled&limit=100`).set(bearer(a.dream)).expect(200)).body.items.find((x: any) => x.id === lead.id);
    expect(inList.bookings[0]).toMatchObject({ id: bk.body.id, status: 'scheduled' });

    // the Install dialog reads one booking: the installing TIP and admin can, another TIP cannot
    const one = (await c.http().get(`${P}/bookings/${bk.body.id}`).set(bearer(a.dream)).expect(200)).body;
    expect(one).toMatchObject({ id: bk.body.id, status: 'scheduled' });
    expect(one.lead.ref_code).toBe(lead.ref_code);
    await c.http().get(`${P}/bookings/${bk.body.id}`).set(bearer(a.admin)).expect(200);
    await c.http().get(`${P}/bookings/${bk.body.id}`).expect(401);
    await c.http().get(`${P}/bookings/${bk.body.id}`).set(bearer(a.doulat)).expect(404);
    await c.http().get(`${P}/bookings/999999999`).set(bearer(a.dream)).expect(404);

    // Install: straight from scheduled
    await c.http().post(`${P}/bookings/${bk.body.id}/complete`).set(bearer(a.dream)).send({ connection_id: 'CID-77', router_serial: `SN-${Date.now()}` }).expect(200);
    const done = await get(a.dream);
    expect(done.status).toBe('installed');
    expect(done.bookings[0]).toMatchObject({ id: bk.body.id, status: 'completed', connection_id: 'CID-77' });
  });
});
