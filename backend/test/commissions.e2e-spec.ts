import { actors, bearer, createCtx, Ctx, install, newLead, P } from './helpers';

describe('DSA commissions', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>; let commissionId: number;
  beforeAll(async () => {
    c = await createCtx(); a = await actors(c);
    const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
    commissionId = (await install(c, a.dream, l.id)).result.commission.id;
  });
  afterAll(() => c.app.close());

  it('DSA sees only their own payouts with totals; TIP and customer cannot use the endpoint', async () => {
    const r = await c.http().get(`${P}/commissions`).set(bearer(a.dsa1)).expect(200);
    expect(r.body.items.every((x: any) => x.dsa_user_id === a.ids.dsa1)).toBe(true);
    expect(r.body.totals.pending).toBeGreaterThanOrEqual(300);
    const other = await c.http().get(`${P}/commissions`).set(bearer(a.dsa2)).expect(200);
    expect(other.body.items.map((x: any) => x.id)).not.toContain(commissionId);
    await c.http().get(`${P}/commissions`).set(bearer(a.dream)).expect(403);
    await c.http().get(`${P}/commissions`).expect(401);
  });
  it('admin approves, then pays; the order is enforced and a DSA cannot self-approve', async () => {
    await c.http().post(`${P}/commissions/${commissionId}/approve`).set(bearer(a.dsa1)).expect(403);
    await c.http().post(`${P}/commissions/${commissionId}/pay`).set(bearer(a.admin)).send({ mode: 'upi', reference: 'UTR1' }).expect(400); // not approved yet
    const ap = await c.http().post(`${P}/commissions/${commissionId}/approve`).set(bearer(a.admin)).expect(200);
    expect(ap.body.status).toBe('approved');
    await c.http().post(`${P}/commissions/${commissionId}/approve`).set(bearer(a.admin)).expect(400);
    await c.http().post(`${P}/commissions/${commissionId}/pay`).set(bearer(a.admin)).send({ mode: 'cheque', reference: 'x' }).expect(400);
    await c.http().post(`${P}/commissions/${commissionId}/pay`).set(bearer(a.admin)).send({ mode: 'upi' }).expect(400);
    const paid = await c.http().post(`${P}/commissions/${commissionId}/pay`).set(bearer(a.admin)).send({ mode: 'upi', reference: 'UTR-998877' }).expect(200);
    expect(paid.body).toMatchObject({ status: 'paid', paid_mode: 'upi', paid_reference: 'UTR-998877' });
    expect(paid.body.paid_at).toBeTruthy();
    await c.http().post(`${P}/commissions/${commissionId}/pay`).set(bearer(a.admin)).send({ mode: 'upi', reference: 'again' }).expect(400); // no double pay
    await c.http().post(`${P}/commissions/${commissionId}/cancel`).set(bearer(a.admin)).send({}).expect(400); // paid can't be cancelled
    const notif = await c.prisma.notification.findFirst({ where: { template: 'dsa_paid', user_id: a.ids.dsa1 }, orderBy: { id: 'desc' } });
    expect(notif).toBeTruthy();
  });
  it('admin can cancel a pending payout', async () => {
    const l = await newLead(c, a, { by: 'dsa2', tip: 'dream' });
    const id = (await install(c, a.dream, l.id)).result.commission.id;
    const r = await c.http().post(`${P}/commissions/${id}/cancel`).set(bearer(a.admin)).send({ notes: 'lead refunded' }).expect(200);
    expect(r.body.status).toBe('cancelled');
    await c.http().post(`${P}/commissions/${id}/approve`).set(bearer(a.admin)).expect(400);
  });
  it('admin filters by status and DSA', async () => {
    const r = await c.http().get(`${P}/commissions?status=paid&dsa_user_id=${a.ids.dsa1}`).set(bearer(a.admin)).expect(200);
    expect(r.body.items.length).toBeGreaterThan(0);
    expect(r.body.items.every((x: any) => x.status === 'paid')).toBe(true);
    await c.http().get(`${P}/commissions?status=zzz`).set(bearer(a.admin)).expect(400);
  });
});
