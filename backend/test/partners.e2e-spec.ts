import { actors, bearer, createCtx, Ctx, makeCustomer, P, rzpSig, uniquePhone } from './helpers';

const partner = (role: 'dsa' | 'tip', over: object = {}) => ({
  role, name: 'Ravi Kumar', phone: uniquePhone(), address: '12 MG Road, Indore', pincode: '452001',
  aadhaar: '9999 1111 2222', pan: 'ABCDE1234F', bank_name: 'SBI', bank_account: '123456789012', bank_ifsc: 'SBIN0001234',
  ...(role === 'tip' ? { business_name: 'RK Networks', gst_number: '23ABCDE1234F1Z5', service_pincodes: ['452001', '452002'] } : {}),
  ...over,
});

describe('partner registration & approval', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  it('DSA signs up for free: pending, with a partner code, no charge', async () => {
    const r = await c.http().post(`${P}/partners/register`).send(partner('dsa')).expect(201);
    expect(r.body.user).toMatchObject({ role: 'dsa', partner_status: 'pending' });
    expect(r.body.user.partner_code).toMatch(/^MP09DSA\d+$/);
    expect(r.body.charge).toBeNull();
    expect(r.body.payment_token).toBeNull();
  });

  it('never returns or stores sensitive numbers in plain text', async () => {
    const body = partner('dsa');
    const r = await c.http().post(`${P}/partners/register`).send(body).expect(201);
    const txt = JSON.stringify(r.body);
    expect(txt).not.toContain('123456789012');
    expect(txt).not.toContain('ABCDE1234F');
    expect(r.body.user).toMatchObject({ aadhaar_last4: '2222', pan_last4: '234F', bank_account_last4: '9012' });
    const row = await c.prisma.user.findUniqueOrThrow({ where: { id: r.body.user.id } });
    expect(Buffer.from(row.pan_enc!).toString()).not.toContain('ABCDE');
    const detail = await c.http().get(`${P}/users/${r.body.user.id}`).set(bearer(a.admin)).expect(200);
    expect(detail.body.aadhaar_enc).toBeUndefined();
    expect(detail.body.password_hash).toBeUndefined();
  });

  it('validates the form', async () => {
    await c.http().post(`${P}/partners/register`).send(partner('dsa', { pan: 'bad' })).expect(400);
    await c.http().post(`${P}/partners/register`).send(partner('dsa', { aadhaar: '123' })).expect(400);
    await c.http().post(`${P}/partners/register`).send(partner('dsa', { bank_ifsc: 'nope' })).expect(400);
    await c.http().post(`${P}/partners/register`).send(partner('dsa', { phone: '123' })).expect(400);
    await c.http().post(`${P}/partners/register`).send(partner('tip', { gst_number: 'WRONG' })).expect(400);
    await c.http().post(`${P}/partners/register`).send(partner('tip', { business_name: undefined })).expect(400);
    await c.http().post(`${P}/partners/register`).send(partner('admin' as any)).expect(400);
    await c.http().post(`${P}/partners/register`).send({ ...partner('dsa'), role: 'dsa', is_internal: true }).expect(400); // unknown field
  });
  it('rejects a duplicate mobile number for the same role', async () => {
    const b = partner('dsa');
    await c.http().post(`${P}/partners/register`).send(b).expect(201);
    await c.http().post(`${P}/partners/register`).send(b).expect(409);
  });

  it('TIP signup creates an onboarding charge with GST (CGST+SGST for MP)', async () => {
    const r = await c.http().post(`${P}/partners/register`).send(partner('tip')).expect(201);
    expect(r.body.user.partner_code).toMatch(/^MP09TIP\d+$/);
    expect(r.body.charge).toMatchObject({ kind: 'tip_onboarding', status: 'pending', base_amount: 1000, cgst_amount: 90 * 1, sgst_amount: 90, igst_amount: 0, total_amount: 1180 });
    expect(r.body.charge.cgst_amount).toBe(90);
    expect(r.body.payment_token).toBeTruthy();
    // service pincodes are stored but inactive until approval
    const maps = await c.prisma.tipPincodeMapping.findMany({ where: { tip_user_id: r.body.user.id } });
    expect(maps).toHaveLength(2);
    expect(maps.every((m) => !m.is_active)).toBe(true);
  });
  it('TIP from another state is charged IGST', async () => {
    const r = await c.http().post(`${P}/partners/register`).send(partner('tip', { gst_number: '27ABCDE1234F1Z5' })).expect(201);
    expect(r.body.charge).toMatchObject({ cgst_amount: 0, sgst_amount: 0, igst_amount: 180, total_amount: 1180 });
  });

  it('full TIP onboarding: cannot be approved before paying; pays with the token; then approved and can log in', async () => {
    const reg = await c.http().post(`${P}/partners/register`).send(partner('tip')).expect(201);
    const { user, charge, payment_token } = reg.body;
    const approve = (status: string) => c.http().patch(`${P}/users/${user.id}/partner-status`).set(bearer(a.admin)).send({ status });
    expect((await approve('approved')).status).toBe(400);

    await c.http().post(`${P}/charges/${charge.id}/pay`).send({}).expect(403); // no token, not logged in
    await c.http().post(`${P}/charges/${charge.id}/pay`).send({ payment_token: 'junk' }).expect(403);
    const order = await c.http().post(`${P}/charges/${charge.id}/pay`).send({ payment_token }).expect(200);
    expect(order.body).toMatchObject({ amount: 118000, currency: 'INR', mock: true });
    await c.http().post(`${P}/charges/${charge.id}/verify`).send({ payment_token, razorpay_payment_id: 'pay_1', razorpay_signature: 'bad' }).expect(400);
    const paid = await c.http().post(`${P}/charges/${charge.id}/verify`).send({ payment_token, razorpay_payment_id: 'pay_1', razorpay_signature: rzpSig(order.body.order_id, 'pay_1') }).expect(200);
    expect(paid.body).toMatchObject({ status: 'paid', pay_mode: 'razorpay' });
    expect(paid.body.invoice_no).toMatch(/^CB-INV-/);
    expect(paid.body.session.user).toMatchObject({ role: 'tip' });   // paying the fee logs the TIP in right away
    await c.http().get(`${P}/users/me`).set(bearer(paid.body.session.access_token)).expect(200);
    // token for charge A cannot pay charge B
    const other = await c.http().post(`${P}/partners/register`).send(partner('tip')).expect(201);
    await c.http().post(`${P}/charges/${other.body.charge.id}/pay`).send({ payment_token }).expect(403);

    await c.http().post(`${P}/auth/otp/request`).send({ phone: user.phone, role: 'tip' }).expect(200); // fee paid: can log in while admin approves
    const ok = await approve('approved').expect(200);
    expect(ok.body.partner_status).toBe('approved');
    expect((await c.prisma.tipPincodeMapping.findMany({ where: { tip_user_id: user.id } })).every((m) => m.is_active)).toBe(true);
    await c.http().post(`${P}/auth/otp/request`).send({ phone: user.phone, role: 'tip' }).expect(200);
    const login = await c.http().post(`${P}/auth/otp/verify`).send({ phone: user.phone, role: 'tip', code: '123456' }).expect(200);
    expect(login.body.user.partner_code).toBe(user.partner_code);
  });
  it('admin can waive the onboarding charge, then approve', async () => {
    const reg = await c.http().post(`${P}/partners/register`).send(partner('tip')).expect(201);
    await c.http().post(`${P}/charges/${reg.body.charge.id}/waive`).set(bearer(a.admin)).expect(200);
    await c.http().patch(`${P}/users/${reg.body.user.id}/partner-status`).set(bearer(a.admin)).send({ status: 'approved' }).expect(200);
  });
  it('reject / suspend, and an approved DSA needs no payment', async () => {
    const dsa = (await c.http().post(`${P}/partners/register`).send(partner('dsa')).expect(201)).body.user;
    await c.http().patch(`${P}/users/${dsa.id}/partner-status`).set(bearer(a.admin)).send({ status: 'approved' }).expect(200);
    await c.http().patch(`${P}/users/${dsa.id}/partner-status`).set(bearer(a.admin)).send({ status: 'suspended', reason: 'fraud' }).expect(200);
    await c.http().post(`${P}/auth/otp/request`).send({ phone: dsa.phone, role: 'dsa' }).expect(401);
    await c.http().patch(`${P}/users/${dsa.id}/partner-status`).set(bearer(a.admin)).send({ status: 'bogus' }).expect(400);
    const cust = await makeCustomer(c);
    await c.http().patch(`${P}/users/${cust.user.id}/partner-status`).set(bearer(a.admin)).send({ status: 'approved' }).expect(404);
  });

  it('admin lists and filters users; non-admins cannot', async () => {
    const pending = await c.http().get(`${P}/users?partner_status=pending&role=tip`).set(bearer(a.admin)).expect(200);
    expect(pending.body.items.every((u: any) => u.partner_status === 'pending' && u.role === 'tip')).toBe(true);
    expect(pending.body.items[0].password_hash).toBeUndefined();
    const q = await c.http().get(`${P}/users?q=MP09DSA01`).set(bearer(a.admin)).expect(200);
    expect(q.body.total).toBeGreaterThan(0);
    await c.http().get(`${P}/users`).set(bearer(a.dsa1)).expect(403);
    await c.http().get(`${P}/users`).expect(401);
    await c.http().get(`${P}/users/999999`).set(bearer(a.admin)).expect(404);
  });
  it('users update their own profile only', async () => {
    const cust = await makeCustomer(c);
    const r = await c.http().patch(`${P}/users/me`).set(bearer(cust.token)).send({ name: 'New Name', address: 'Somewhere', pincode: '452010' }).expect(200);
    expect(r.body).toMatchObject({ name: 'New Name', pincode: '452010' });
    await c.http().patch(`${P}/users/me`).set(bearer(cust.token)).send({ role: 'admin' }).expect(400); // privilege escalation blocked
    await c.http().patch(`${P}/users/me`).set(bearer(cust.token)).send({ pincode: 'x' }).expect(400);
  });
  it('admin can create another admin and deactivate users', async () => {
    const phone = uniquePhone();
    await c.http().post(`${P}/users/admins`).set(bearer(a.admin)).send({ name: 'Second Admin', phone, password: 'Str0ngPass!' }).expect(201);
    await c.http().post(`${P}/auth/login`).send({ phone, password: 'Str0ngPass!', role: 'admin' }).expect(200);
    await c.http().post(`${P}/users/admins`).set(bearer(a.admin)).send({ name: 'X', phone: uniquePhone(), password: 'short' }).expect(400);
    const u = await c.prisma.user.findFirstOrThrow({ where: { role: 'admin', phone } });
    await c.http().patch(`${P}/users/${u.id}/active`).set(bearer(a.admin)).send({ is_active: false }).expect(200);
    await c.http().post(`${P}/auth/login`).send({ phone, password: 'Str0ngPass!', role: 'admin' }).expect(401);
  });

  describe('deleting an application', () => {
    it('admin can delete a pending application that has no history; its unpaid fee goes with it', async () => {
      const reg = await c.http().post(`${P}/partners/register`).send(partner('tip')).expect(201);
      const id = reg.body.user.id;
      await c.http().delete(`${P}/users/${id}`).set(bearer(a.dsa1)).expect(403);
      await c.http().delete(`${P}/users/${id}`).expect(401);
      const r = await c.http().delete(`${P}/users/${id}`).set(bearer(a.admin)).expect(200);
      expect(r.body).toMatchObject({ deleted: true, id });
      expect(await c.prisma.user.findUnique({ where: { id } })).toBeNull();
      expect(await c.prisma.charge.count({ where: { payer_user_id: id } })).toBe(0);
      await c.http().delete(`${P}/users/${id}`).set(bearer(a.admin)).expect(404);
    });
    it('refuses an approved partner, a customer, and an application that already paid', async () => {
      await c.http().delete(`${P}/users/${a.ids.dream}`).set(bearer(a.admin)).expect(409);          // approved
      const cust = await makeCustomer(c);
      await c.http().delete(`${P}/users/${cust.user.id}`).set(bearer(a.admin)).expect(404);          // not a DSA / TIP
      const reg = await c.http().post(`${P}/partners/register`).send(partner('tip')).expect(201);
      await c.prisma.charge.update({ where: { id: reg.body.charge.id }, data: { status: 'paid', paid_at: new Date() } });
      await c.http().delete(`${P}/users/${reg.body.user.id}`).set(bearer(a.admin)).expect(409);      // money was paid
      expect(await c.prisma.user.findUnique({ where: { id: reg.body.user.id } })).not.toBeNull();
    });
  });
});
