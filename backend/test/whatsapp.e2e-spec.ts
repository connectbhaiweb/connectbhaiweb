import { actors, bearer, createCtx, Ctx, inDays, newLead, P, uniquePhone } from './helpers';

/** Which WhatsApp messages the app records at each step (nothing is really sent in tests: AISENSY_API_KEY is empty). */
describe('WhatsApp messages at each step', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());
  const sent = (phone: string, template: string) => c.prisma.notification.findMany({ where: { phone, template }, orderBy: { id: 'asc' } });

  it('new request: customer gets "lead_received" with product and executive filled in', async () => {
    const lead = await newLead(c, a, { tip: 'dream' });
    const [n] = await sent(lead.customer_phone, 'lead_received');
    expect(n).toBeTruthy();
    expect(n.payload).toMatchObject({ ref_code: lead.ref_code, name: 'Lead Person' });
    expect((n.payload as any).product).toBeTruthy();
    expect((n.payload as any).executive).toBeTruthy();
  });

  it('follow-up status sends "lead_followup" to the customer', async () => {
    const lead = await newLead(c, a, { tip: 'dream' });
    await c.http().patch(`${P}/leads/${lead.id}/status`).set(bearer(a.admin)).send({ status: 'followup', followup_at: inDays(1) }).expect(200);
    expect(await sent(lead.customer_phone, 'lead_followup')).toHaveLength(1);
  });

  it('technician start: tells the customer once, only the assigned TIP (or admin) can do it', async () => {
    const lead = await newLead(c, a, { tip: 'dream' });
    const b = await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: lead.id, scheduled_at: inDays(1) }).expect(201);
    await c.http().post(`${P}/bookings/${b.body.id}/start`).set(bearer(a.doulat)).expect(404);   // another TIP cannot even see this booking
    await c.http().post(`${P}/bookings/${b.body.id}/start`).set(bearer(a.dsa1)).expect(403);
    const r1 = await c.http().post(`${P}/bookings/${b.body.id}/start`).set(bearer(a.dream)).expect(200);
    expect(r1.body).toEqual({ started: true, notified: true });
    const r2 = await c.http().post(`${P}/bookings/${b.body.id}/start`).set(bearer(a.dream)).expect(200);
    expect(r2.body).toEqual({ started: true, notified: false });
    const n = await sent(lead.customer_phone, 'installation_in_progress');
    expect(n).toHaveLength(1);
    expect(n[0].payload).toMatchObject({ ref_code: lead.ref_code });
    expect((n[0].payload as any).technician).toBeTruthy();
  });

  it('installation done: customer gets "installed" (activation) and "welcome"; the TIP gets "install_fee_due" with a due date', async () => {
    const lead = await newLead(c, a, { tip: 'dream' });
    const b = await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: lead.id, scheduled_at: inDays(1) }).expect(201);
    await c.http().post(`${P}/bookings/${b.body.id}/complete`).set(bearer(a.dream)).send({ connection_id: 'CID-77', router_serial: `SN-${Date.now()}` }).expect(200);
    const [inst] = await sent(lead.customer_phone, 'installed');
    expect(inst.payload).toMatchObject({ name: 'Lead Person', connection_id: 'CID-77', ref_code: lead.ref_code });
    expect((inst.payload as any).date).toMatch(/^\d{2} \w{3} \d{4}$/);
    expect((inst.payload as any).plan).toBeTruthy();
    expect(await sent(lead.customer_phone, 'welcome')).toHaveLength(1);
    const dream = await c.prisma.user.findFirstOrThrow({ where: { id: a.ids.dream } });
    const fees = await c.prisma.notification.findMany({ where: { phone: dream.phone, template: 'install_fee_due' }, orderBy: { id: 'desc' }, take: 1 });
    expect(fees[0].payload).toMatchObject({ what: `install fee for ${lead.ref_code}` });
    expect((fees[0].payload as any).due).toMatch(/^\d{2} \w{3} \d{4}$/);
  });

  it('raising a ticket sends "complaint_registered" with the ticket code', async () => {
    const phone = uniquePhone();
    await c.http().post(`${P}/auth/otp/request`).send({ phone }).expect(200);
    const login = await c.http().post(`${P}/auth/otp/verify`).send({ phone, code: '123456', name: 'Complainer' }).expect(200);
    const t = await c.http().post(`${P}/tickets`).set(bearer(login.body.access_token)).send({ category: 'no_internet', subject: 'No internet since morning' }).expect(201);
    const [n] = await sent(phone, 'complaint_registered');
    expect(n.payload).toMatchObject({ name: 'Complainer', topic: 'No internet since morning', ticket_code: t.body.ticket_code, expected: 'within 24 hours' });
  });
});
