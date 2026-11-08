import { PaymentReminderService } from '../src/notifications/payment-reminder.service';
import { FeedbackRequestService } from '../src/notifications/feedback-request.service';
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

  it('approved and booked: the customer gets "installation in progress" once, when the booking is made', async () => {
    const lead = await newLead(c, a, { tip: 'dream' });
    await c.http().patch(`${P}/leads/${lead.id}/status`).set(bearer(a.admin)).send({ status: 'followup', followup_at: inDays(1) }).expect(200);
    expect(await sent(lead.customer_phone, 'installation_in_progress')).toHaveLength(0);
    const b = await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: lead.id, scheduled_at: inDays(1) }).expect(201);
    const n = await sent(lead.customer_phone, 'installation_in_progress');
    expect(n).toHaveLength(1);
    expect(n[0].payload).toMatchObject({ ref_code: lead.ref_code });
    expect((n[0].payload as any).technician).toBeTruthy();
    // tapping "start" later does not send it again; only the assigned TIP or admin may call it
    await c.http().post(`${P}/bookings/${b.body.id}/start`).set(bearer(a.doulat)).expect(404);
    await c.http().post(`${P}/bookings/${b.body.id}/start`).set(bearer(a.dsa1)).expect(403);
    const r = await c.http().post(`${P}/bookings/${b.body.id}/start`).set(bearer(a.dream)).expect(200);
    expect(r.body).toEqual({ started: true, notified: false });
    expect(await sent(lead.customer_phone, 'installation_in_progress')).toHaveLength(1);
  });

  it('installation done: customer gets "installed" (activation) and NOT the welcome; the TIP gets "install_fee_due" with a due date', async () => {
    const lead = await newLead(c, a, { tip: 'dream' });
    const b = await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: lead.id, scheduled_at: inDays(1) }).expect(201);
    await c.http().post(`${P}/bookings/${b.body.id}/complete`).set(bearer(a.dream)).send({ connection_id: 'CID-77', router_serial: `SN-${Date.now()}` }).expect(200);
    const [inst] = await sent(lead.customer_phone, 'installed');
    expect(inst.payload).toMatchObject({ name: 'Lead Person', connection_id: 'CID-77', ref_code: lead.ref_code });
    expect((inst.payload as any).date).toMatch(/^\d{2} \w{3} \d{4}$/);
    expect((inst.payload as any).plan).toBeTruthy();
    expect(await sent(lead.customer_phone, 'welcome')).toHaveLength(0);   // the welcome message is not sent
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

  it('feedback request goes out 24 hours after installation, once, and never for old installs', async () => {
    const svc = c.app.get(FeedbackRequestService);
    const lead = await newLead(c, a, { tip: 'dream' });
    const b = await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: lead.id, scheduled_at: inDays(1) }).expect(201);
    await c.http().post(`${P}/bookings/${b.body.id}/complete`).set(bearer(a.dream)).send({ connection_id: 'CID-88', router_serial: `SN-${Date.now()}` }).expect(200);
    await svc.run(new Date(Date.now() + 3_600_000));                       // 1 hour later: too early
    expect(await sent(lead.customer_phone, 'installation_feedback')).toHaveLength(0);
    await svc.run(new Date(Date.now() + 25 * 3_600_000));                  // 25 hours later: asked
    const n = await sent(lead.customer_phone, 'installation_feedback');
    expect(n).toHaveLength(1);
    expect(n[0].payload).toMatchObject({ name: 'Lead Person', ref_code: lead.ref_code });
    expect((n[0].payload as any).technician).toBeTruthy();
    await svc.run(new Date(Date.now() + 26 * 3_600_000));                  // again: not asked twice
    expect(await sent(lead.customer_phone, 'installation_feedback')).toHaveLength(1);
    const old = await newLead(c, a, { tip: 'dream' });                     // installed long ago: never asked
    const ob = await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: old.id, scheduled_at: inDays(1) }).expect(201);
    await c.http().post(`${P}/bookings/${ob.body.id}/complete`).set(bearer(a.dream)).send({ connection_id: 'CID-89', router_serial: `SN-${Date.now()}-o` }).expect(200);
    await svc.run(new Date(Date.now() + 10 * 86_400_000));
    expect(await sent(old.customer_phone, 'installation_feedback')).toHaveLength(0);
  });

  it('a ticket raised by a TIP or admin does not send the customer complaint message', async () => {
    const before = await c.prisma.notification.count({ where: { template: 'complaint_registered' } });
    await c.http().post(`${P}/tickets`).set(bearer(a.dream)).send({ category: 'other', subject: 'Question from the TIP' }).expect(201);
    expect(await c.prisma.notification.count({ where: { template: 'complaint_registered' } })).toBe(before);
  });

  it('a cancelled installation puts the lead back in follow-up and sends the follow-up message', async () => {
    const lead = await newLead(c, a, { tip: 'dream' });
    const b = await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: lead.id, scheduled_at: inDays(1) }).expect(201);
    await c.http().patch(`${P}/bookings/${b.body.id}`).set(bearer(a.dream)).send({ status: 'cancelled' }).expect(200);
    expect(await sent(lead.customer_phone, 'lead_followup')).toHaveLength(1);
  });

  describe('TIP registered but fee not paid', () => {
    const tipBody = () => ({
      role: 'tip', name: 'Unpaid Networks', phone: uniquePhone(), address: '12 MG Road, Indore', pincode: '452001',
      aadhaar: '9999 1111 2222', pan: 'ABCDE1234F', bank_name: 'SBI', bank_account: '123456789012', bank_ifsc: 'SBIN0001234',
      business_name: 'Unpaid Networks', gst_number: '23ABCDE1234F1Z5', service_pincodes: ['452001'],
    });
    it('gets one reminder after 30 minutes, not before, never twice', async () => {
      const svc = c.app.get(PaymentReminderService);
      const reg = await c.http().post(`${P}/partners/register`).send(tipBody()).expect(201);
      const phone = reg.body.user.phone;
      await svc.run(new Date(Date.now() + 5 * 60_000));                    // 5 minutes: too early
      expect(await sent(phone, 'registration_fee_due')).toHaveLength(0);
      await svc.run(new Date(Date.now() + 31 * 60_000));                   // 31 minutes: reminded
      const n = await sent(phone, 'registration_fee_due');
      expect(n).toHaveLength(1);
      expect(n[0].payload).toMatchObject({ name: 'Unpaid Networks', what: 'TIP registration fee', charge_id: Number(reg.body.charge.id) });
      expect(Number((n[0].payload as any).amount)).toBeGreaterThan(0);
      expect((n[0].payload as any).due).toMatch(/^\d{2} \w{3} \d{4}$/);
      await svc.run(new Date(Date.now() + 60 * 60_000));                   // later: not twice
      expect(await sent(phone, 'registration_fee_due')).toHaveLength(1);
    });
    it('a TIP who already paid is not reminded', async () => {
      const svc = c.app.get(PaymentReminderService);
      const reg = await c.http().post(`${P}/partners/register`).send(tipBody()).expect(201);
      await c.prisma.charge.update({ where: { id: reg.body.charge.id }, data: { status: 'paid', paid_at: new Date() } });
      await svc.run(new Date(Date.now() + 31 * 60_000));
      expect(await sent(reg.body.user.phone, 'registration_fee_due')).toHaveLength(0);
    });
  });
});
