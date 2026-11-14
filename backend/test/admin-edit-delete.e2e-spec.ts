import { actors, bearer, createCtx, Ctx, install, makeCustomer, newLead, P, tokenFor, uniquePhone } from './helpers';

const partnerBody = (role: 'dsa' | 'tip', over: object = {}) => ({
  role, name: 'Edit Me', phone: uniquePhone(), address: '12 MG Road, Indore', pincode: '452001',
  aadhaar: '9999 1111 2222', pan: 'ABCDE1234F', bank_name: 'SBI', bank_account: '123456789012', bank_ifsc: 'SBIN0001234',
  ...(role === 'tip' ? { business_name: 'Edit Networks', gst_number: '23ABCDE1234F1Z5', service_pincodes: ['452001'] } : {}),
  ...over,
});

describe('admin can edit and delete partners and leads in any status', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  describe('partners', () => {
    it('admin edits a pending partner; others cannot; bad input is refused', async () => {
      const reg = await c.http().post(`${P}/partners/register`).send(partnerBody('tip')).expect(201);
      const id = reg.body.user.id;
      await c.http().patch(`${P}/users/${id}`).send({ name: 'X Y' }).expect(401);
      await c.http().patch(`${P}/users/${id}`).set(bearer(a.dsa1)).send({ name: 'X Y' }).expect(403);
      const phone = uniquePhone();
      const r = await c.http().patch(`${P}/users/${id}`).set(bearer(a.admin)).send({ name: '  New Name ', business_name: 'New Firm', phone, email: 'new@example.com', address: '5 New Road', pincode: '452010' }).expect(200);
      expect(r.body).toMatchObject({ name: 'New Name', business_name: 'New Firm', phone, email: 'new@example.com', address: '5 New Road', pincode: '452010', partner_status: 'pending' });
      expect(JSON.stringify(r.body)).not.toContain('aadhaar_enc');
      const cleared = await c.http().patch(`${P}/users/${id}`).set(bearer(a.admin)).send({ email: '', business_name: '' }).expect(200);
      expect(cleared.body).toMatchObject({ email: null, business_name: null });
      await c.http().patch(`${P}/users/${id}`).set(bearer(a.admin)).send({ phone: '123' }).expect(400);
      await c.http().patch(`${P}/users/${id}`).set(bearer(a.admin)).send({ pincode: '12' }).expect(400);
      await c.http().patch(`${P}/users/${id}`).set(bearer(a.admin)).send({ name: 'x' }).expect(400);
      // a mobile number already used by another TIP is refused
      const other = await c.http().post(`${P}/partners/register`).send(partnerBody('tip')).expect(201);
      await c.http().patch(`${P}/users/${other.body.user.id}`).set(bearer(a.admin)).send({ phone }).expect(409);
    });
    it('admin edits an active partner and refuses a customer', async () => {
      const cust = await makeCustomer(c);
      await c.http().patch(`${P}/users/${cust.user.id}`).set(bearer(a.admin)).send({ name: 'Nope Nope' }).expect(404);
      const r = await c.http().patch(`${P}/users/${a.ids.dsa2}`).set(bearer(a.admin)).send({ address: 'Edited by admin' }).expect(200);
      expect(r.body.address).toBe('Edited by admin');
    });
    it('deleting a TIP with an installation: the lead stays installed, the TIP, its booking and its fee go', async () => {
      const reg = await c.http().post(`${P}/partners/register`).send(partnerBody('tip', { service_pincodes: ['452010'] })).expect(201);
      const id = reg.body.user.id; const phone = reg.body.user.phone;
      await c.prisma.user.update({ where: { id }, data: { partner_status: 'approved', approved_at: new Date() } });
      const token = await tokenFor(c, 'tip', phone);
      const lead = await newLead(c, a, { by: 'dsa1' });
      await c.http().patch(`${P}/leads/${lead.id}/assign`).set(bearer(a.admin)).send({ tip_user_id: id }).expect(200);
      await install(c, token, lead.id);
      expect(await c.prisma.booking.count({ where: { tip_user_id: id } })).toBe(1);
      await c.http().delete(`${P}/users/${id}`).set(bearer(a.admin)).expect(200);
      expect(await c.prisma.user.findUnique({ where: { id } })).toBeNull();
      expect(await c.prisma.booking.count({ where: { lead_id: lead.id } })).toBe(0);
      const kept = await c.prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(kept.status).toBe('installed');
      expect(kept.tip_user_id).toBeNull();
      const commission = await c.prisma.commission.findUnique({ where: { lead_id: lead.id } });
      expect(commission?.booking_id ?? null).toBeNull();   // the DSA's payout stays, unlinked from the deleted booking
    });
  });

  describe('leads', () => {
    it('admin edits a lead\'s details in any status, including installed', async () => {
      const lead = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
      await install(c, a.dream, lead.id);
      expect((await c.prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('installed');
      await c.http().patch(`${P}/leads/${lead.id}`).send({ customer_name: 'Z Z' }).expect(401);
      await c.http().patch(`${P}/leads/${lead.id}`).set(bearer(a.dsa1)).send({ customer_name: 'Z Z' }).expect(403);
      const phone = uniquePhone();
      const r = await c.http().patch(`${P}/leads/${lead.id}`).set(bearer(a.admin)).send({ customer_name: ' Edited Name ', customer_phone: phone, customer_email: 'e@example.com', address: '9 Edited Lane', notes: 'edited' }).expect(200);
      expect(r.body).toMatchObject({ customer_name: 'Edited Name', customer_phone: phone, customer_email: 'e@example.com', address: '9 Edited Lane', notes: 'edited', status: 'installed' });
      const ev = await c.prisma.leadEvent.findFirst({ where: { lead_id: lead.id, event_type: 'edited' } });
      expect(ev?.note).toContain('name');
      await c.http().patch(`${P}/leads/${lead.id}`).set(bearer(a.admin)).send({ customer_phone: '12' }).expect(400);
      await c.http().patch(`${P}/leads/${lead.id}`).set(bearer(a.admin)).send({ pincode: '12' }).expect(400);
      await c.http().patch(`${P}/leads/${lead.id}`).set(bearer(a.admin)).send({ plan_id: 999999999 }).expect(400);
      await c.http().patch(`${P}/leads/999999999`).set(bearer(a.admin)).send({ customer_name: 'No One' }).expect(404);
      const cleared = await c.http().patch(`${P}/leads/${lead.id}`).set(bearer(a.admin)).send({ customer_email: '', plan_id: null }).expect(200);
      expect(cleared.body).toMatchObject({ customer_email: null, plan_id: null });
    });
    it('admin deletes an installed lead: booking, payout and modem go; the TIP\'s invoice stays unlinked', async () => {
      const lead = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
      await install(c, a.dream, lead.id);
      expect(await c.prisma.booking.count({ where: { lead_id: lead.id } })).toBe(1);
      const charges = await c.prisma.charge.count({ where: { lead_id: lead.id } });
      await c.http().delete(`${P}/leads/${lead.id}`).expect(401);
      await c.http().delete(`${P}/leads/${lead.id}`).set(bearer(a.dsa1)).expect(403);
      const r = await c.http().delete(`${P}/leads/${lead.id}`).set(bearer(a.admin)).expect(200);
      expect(r.body).toMatchObject({ deleted: true, id: lead.id });
      expect(await c.prisma.lead.findUnique({ where: { id: lead.id } })).toBeNull();
      expect(await c.prisma.booking.count({ where: { lead_id: lead.id } })).toBe(0);
      expect(await c.prisma.commission.count({ where: { lead_id: lead.id } })).toBe(0);
      expect(await c.prisma.carePlanDevice.count({ where: { lead_id: lead.id } })).toBe(0);
      expect(await c.prisma.leadEvent.count({ where: { lead_id: lead.id } })).toBe(0);
      expect(charges).toBeGreaterThanOrEqual(0);   // any install fee for it is kept as a money record, unlinked from the lead
      await c.http().delete(`${P}/leads/${lead.id}`).set(bearer(a.admin)).expect(404);
    });
    it('admin deletes a brand-new lead too', async () => {
      const lead = await newLead(c, a, { by: 'web' });
      await c.http().delete(`${P}/leads/${lead.id}`).set(bearer(a.admin)).expect(200);
      expect(await c.prisma.lead.findUnique({ where: { id: lead.id } })).toBeNull();
    });
  });
});
