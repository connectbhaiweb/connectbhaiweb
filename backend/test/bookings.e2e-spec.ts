import { actors, bearer, createCtx, Ctx, inDays, install, newLead, P } from './helpers';

describe('bookings & installation money flow', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  it('TIP books an installation: lead becomes scheduled', async () => {
    const l = await newLead(c, a, { tip: 'dream' });
    const b = await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: l.id, scheduled_at: inDays(2), notes: 'gate code 12' }).expect(201);
    expect(b.body).toMatchObject({ status: 'scheduled', tip_user_id: a.ids.dream });
    expect((await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.admin))).body.status).toBe('scheduled');
    await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: l.id, scheduled_at: inDays(3) }).expect(400); // already scheduled
  });
  it('validates booking rules and permissions', async () => {
    const l = await newLead(c, a, { tip: 'dream' });
    await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: l.id, scheduled_at: inDays(-3) }).expect(400);
    await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: l.id, scheduled_at: 'tomorrow' }).expect(400);
    await c.http().post(`${P}/bookings`).set(bearer(a.doulat)).send({ lead_id: l.id, scheduled_at: inDays(1) }).expect(404); // not their lead
    await c.http().post(`${P}/bookings`).set(bearer(a.dsa2)).send({ lead_id: l.id, scheduled_at: inDays(1) }).expect(404); // another DSA: not their lead
    await c.http().post(`${P}/bookings`).send({ lead_id: l.id, scheduled_at: inDays(1) }).expect(401);
    await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: 999999, scheduled_at: inDays(1) }).expect(404);
    const lost = await newLead(c, a, { tip: 'dream' });
    await c.http().patch(`${P}/leads/${lost.id}/status`).set(bearer(a.dream)).send({ status: 'cancelled' }).expect(200);
    await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: lost.id, scheduled_at: inDays(1) }).expect(400);
  });
  it('a lead nobody is assigned to (no DSA, no TIP) cannot be booked', async () => {
    await c.http().put(`${P}/settings/auto_assign`).set(bearer(a.admin)).send({ value: '0' }).expect(200);
    const l = await newLead(c, a, { by: 'web' });
    await c.http().put(`${P}/settings/auto_assign`).set(bearer(a.admin)).send({ value: '1' }).expect(200);
    expect(l.tip_user_id).toBeNull();
    expect(l.brought_by_user_id).toBeNull();
    await c.http().post(`${P}/bookings`).set(bearer(a.admin)).send({ lead_id: l.id, scheduled_at: inDays(1) }).expect(400);
  });
  it('a DSA can book, reschedule and cancel their own lead, but not install it', async () => {
    const l = await newLead(c, a, { by: 'dsa1' });
    const b = (await c.http().post(`${P}/bookings`).set(bearer(a.dsa1)).send({ lead_id: l.id, scheduled_at: inDays(2) }).expect(201)).body;
    expect(b.tip_user_id).toBeNull();
    await c.http().patch(`${P}/bookings/${b.id}`).set(bearer(a.dsa2)).send({ scheduled_at: inDays(3) }).expect(404);      // not their lead
    await c.http().patch(`${P}/bookings/${b.id}`).set(bearer(a.dsa1)).send({ scheduled_at: inDays(3) }).expect(200);      // reschedule
    await c.http().post(`${P}/bookings/${b.id}/start`).set(bearer(a.dsa1)).expect(403);                                   // installing is the TIP's job
    await c.http().post(`${P}/bookings/${b.id}/complete`).set(bearer(a.dsa1)).send({ connection_id: 'X1' }).expect(403);
    await c.http().patch(`${P}/bookings/${b.id}`).set(bearer(a.dsa1)).send({ status: 'cancelled' }).expect(200);          // cancel: back to follow-up
    expect((await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.dsa1)).expect(200)).body.status).toBe('followup');
    const again = (await c.http().post(`${P}/bookings`).set(bearer(a.dsa1)).send({ lead_id: l.id, scheduled_at: inDays(4) }).expect(201)).body;   // and book again
    expect(again.id).not.toBe(b.id);
  });

  it('reschedule and cancel (cancel returns the lead to follow-up)', async () => {
    const l = await newLead(c, a, { tip: 'dream' });
    const b = (await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: l.id, scheduled_at: inDays(2) }).expect(201)).body;
    const when = inDays(5);
    const r = await c.http().patch(`${P}/bookings/${b.id}`).set(bearer(a.dream)).send({ scheduled_at: when }).expect(200);
    expect(new Date(r.body.scheduled_at).getTime()).toBe(new Date(when).getTime());
    await c.http().patch(`${P}/bookings/${b.id}`).set(bearer(a.doulat)).send({ scheduled_at: when }).expect(404);
    await c.http().patch(`${P}/bookings/${b.id}`).set(bearer(a.dream)).send({}).expect(400);
    await c.http().patch(`${P}/bookings/${b.id}`).set(bearer(a.dream)).send({ status: 'cancelled' }).expect(200);
    expect((await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.admin))).body.status).toBe('followup');
    await c.http().patch(`${P}/bookings/${b.id}`).set(bearer(a.dream)).send({ status: 'cancelled' }).expect(400);
    await c.http().post(`${P}/bookings/${b.id}/complete`).set(bearer(a.dream)).send({ connection_id: 'X' }).expect(409);
  });

  it('completing an installation pays out the DSA and bills the TIP (with GST) — atomically', async () => {
    const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
    const { result } = await install(c, a.dream, l.id);
    expect(result.booking).toMatchObject({ status: 'completed', connection_id: 'CID-1' });
    // DSA payout: flat 300, pending, tied to the lead
    expect(result.commission).toMatchObject({ dsa_user_id: a.ids.dsa1, lead_id: l.id, amount: 300, status: 'pending' });
    // TIP install fee: 500 + 9% + 9%
    expect(result.charge).toMatchObject({ kind: 'tip_install_fee', payer_user_id: a.ids.dream, lead_id: l.id, base_amount: 500, cgst_amount: 45 + 0, status: 'pending' });
    expect(result.charge.cgst_amount + result.charge.sgst_amount).toBe(90);
    expect(result.charge.total_amount).toBe(590);
    expect(result.charge.install_fee_key).toBe(l.id);
    const lead = (await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.admin))).body;
    expect(lead.status).toBe('installed');
    expect(lead.installed_at).toBeTruthy();
    // completing again is rejected and never double-bills
    await c.http().post(`${P}/bookings/${result.booking.id}/complete`).set(bearer(a.dream)).send({ connection_id: 'CID-2' }).expect(409);
    expect(await c.prisma.charge.count({ where: { lead_id: l.id, kind: 'tip_install_fee' } })).toBe(1);
    expect(await c.prisma.commission.count({ where: { lead_id: l.id } })).toBe(1);
    // terminal: cannot be cancelled or re-opened afterwards
    await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(a.dream)).send({ status: 'cancelled' }).expect(400);
  });
  it('website lead (no DSA) creates no payout; internal TIP pays no install fee', async () => {
    const l = await newLead(c, a, { by: 'web', noDsa: true, tip: 'internal' });   // a lead no DSA brought
    const { result } = await install(c, a.internal, l.id);
    expect(result.commission).toBeNull();
    expect(result.charge).toBeNull();
    const mixed = await newLead(c, a, { by: 'dsa2', tip: 'internal' });
    const r2 = await install(c, a.internal, mixed.id);
    expect(r2.result.commission).toMatchObject({ dsa_user_id: a.ids.dsa2, amount: 300 });
    expect(r2.result.charge).toBeNull();
  });
  it('lost / cancelled leads earn the DSA nothing', async () => {
    const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
    await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(a.dream)).send({ status: 'lost', lost_reason: 'no network' }).expect(200);
    expect(await c.prisma.commission.count({ where: { lead_id: l.id } })).toBe(0);
  });
  it('only the assigned TIP (or admin) can complete; the connection id is required', async () => {
    const l = await newLead(c, a, { tip: 'dream' });
    const b = (await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: l.id, scheduled_at: inDays(1) }).expect(201)).body;
    await c.http().post(`${P}/bookings/${b.id}/complete`).set(bearer(a.doulat)).send({ connection_id: 'X' }).expect(404);
    await c.http().post(`${P}/bookings/${b.id}/complete`).set(bearer(a.dsa1)).send({ connection_id: 'X' }).expect(403);
    await c.http().post(`${P}/bookings/${b.id}/complete`).set(bearer(a.dream)).send({}).expect(400);
    await c.http().post(`${P}/bookings/${b.id}/complete`).set(bearer(a.admin)).send({ connection_id: 'ADMIN-DONE' }).expect(200);
  });
  it('changing the payout / fee in settings affects the next installation only', async () => {
    const before = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
    await c.http().put(`${P}/settings/dsa_payout_per_lead`).set(bearer(a.admin)).send({ value: '450' }).expect(200);
    await c.http().put(`${P}/settings/tip_install_fee`).set(bearer(a.admin)).send({ value: '1000' }).expect(200);
    const { result } = await install(c, a.dream, before.id);
    expect(result.commission.amount).toBe(450);
    expect(result.charge).toMatchObject({ base_amount: 1000, total_amount: 1180 });
    await c.http().put(`${P}/settings/dsa_payout_per_lead`).set(bearer(a.admin)).send({ value: '300' }).expect(200);
    await c.http().put(`${P}/settings/tip_install_fee`).set(bearer(a.admin)).send({ value: '500' }).expect(200);
  });

  it('visibility: TIP sees own bookings, DSA sees bookings of own leads, others see none', async () => {
    const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
    const b = (await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: l.id, scheduled_at: inDays(1) }).expect(201)).body;
    const ids = async (t: string) => (await c.http().get(`${P}/bookings?limit=200`).set(bearer(t)).expect(200)).body.items.map((x: any) => x.id);
    expect(await ids(a.dream)).toContain(b.id);
    expect(await ids(a.dsa1)).toContain(b.id);
    expect(await ids(a.admin)).toContain(b.id);
    expect(await ids(a.doulat)).not.toContain(b.id);
    expect(await ids(a.dsa2)).not.toContain(b.id);
  });
});
