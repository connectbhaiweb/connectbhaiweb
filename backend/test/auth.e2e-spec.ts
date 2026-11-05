import { bearer, createCtx, Ctx, DSA1_PHONE, P, uniquePhone } from './helpers';

describe('auth', () => {
  let c: Ctx;
  beforeAll(async () => { c = await createCtx(); });
  afterAll(() => c.app.close());

  it('rejects invalid phone numbers', async () => {
    await c.http().post(`${P}/auth/otp/request`).send({ phone: '12345' }).expect(400);
    await c.http().post(`${P}/auth/otp/request`).send({}).expect(400);
  });

  it('customer: request OTP -> wrong code -> right code creates the account and returns tokens', async () => {
    const phone = uniquePhone();
    await c.http().post(`${P}/auth/otp/request`).send({ phone }).expect(200);
    await c.http().post(`${P}/auth/otp/verify`).send({ phone, code: '000000' }).expect(401);
    const ok = await c.http().post(`${P}/auth/otp/verify`).send({ phone, code: '123456', name: 'Asha' }).expect(200);
    expect(ok.body.access_token).toBeDefined();
    expect(ok.body.refresh_token).toBeDefined();
    expect(ok.body.user).toMatchObject({ role: 'customer', name: 'Asha', phone });
    expect(ok.body.user.password_hash).toBeUndefined();
    const me = await c.http().get(`${P}/users/me`).set(bearer(ok.body.access_token)).expect(200);
    expect(me.body.phone).toBe(phone);
  });

  it('an OTP can only be used once', async () => {
    const phone = uniquePhone();
    await c.http().post(`${P}/auth/otp/request`).send({ phone }).expect(200);
    await c.http().post(`${P}/auth/otp/verify`).send({ phone, code: '123456' }).expect(200);
    await c.http().post(`${P}/auth/otp/verify`).send({ phone, code: '123456' }).expect(401);
  });

  it('verify without a prior request fails', async () => {
    await c.http().post(`${P}/auth/otp/verify`).send({ phone: uniquePhone(), code: '123456' }).expect(401);
  });

  it('locks the OTP after too many wrong attempts', async () => {
    const phone = uniquePhone();
    await c.http().post(`${P}/auth/otp/request`).send({ phone }).expect(200);
    for (let i = 0; i < 5; i++) await c.http().post(`${P}/auth/otp/verify`).send({ phone, code: '111111' }).expect(401);
    const r = await c.http().post(`${P}/auth/otp/verify`).send({ phone, code: '123456' }).expect(401);
    expect(r.body.message).toMatch(/too many/i);
  });

  it('limits OTP requests per phone', async () => {
    const phone = uniquePhone();
    for (let i = 0; i < 5; i++) await c.http().post(`${P}/auth/otp/request`).send({ phone }).expect(200);
    await c.http().post(`${P}/auth/otp/request`).send({ phone }).expect(429);
  });

  it('seeded DSA can log in with OTP; unknown DSA numbers cannot', async () => {
    await c.http().post(`${P}/auth/otp/request`).send({ phone: DSA1_PHONE, role: 'dsa' }).expect(200);
    const ok = await c.http().post(`${P}/auth/otp/verify`).send({ phone: DSA1_PHONE, role: 'dsa', code: '123456' }).expect(200);
    expect(ok.body.user.role).toBe('dsa');
    await c.http().post(`${P}/auth/otp/request`).send({ phone: uniquePhone(), role: 'dsa' }).expect(401);
  });

  it('pending / suspended partners cannot log in', async () => {
    const phone = uniquePhone();
    await c.prisma.user.create({ data: { role: 'tip', name: 'Pending TIP', phone, partner_status: 'pending' } });
    const r = await c.http().post(`${P}/auth/otp/request`).send({ phone, role: 'tip' }).expect(401);
    expect(r.body.message).toMatch(/approval/i);
    await c.prisma.user.update({ where: { role_phone: { role: 'tip', phone } }, data: { partner_status: 'suspended' } });
    await c.http().post(`${P}/auth/otp/request`).send({ phone, role: 'tip' }).expect(401);
  });

  it('admin password login works; wrong password and wrong role fail', async () => {
    const ok = await c.http().post(`${P}/auth/login`).send({ phone: '9999999999', password: 'Admin@12345', role: 'admin' }).expect(200);
    expect(ok.body.user.role).toBe('admin');
    await c.http().post(`${P}/auth/login`).send({ phone: '9999999999', password: 'wrong-pass', role: 'admin' }).expect(401);
    await c.http().post(`${P}/auth/login`).send({ phone: '9999999999', password: 'Admin@12345', role: 'tip' }).expect(401);
    await c.http().post(`${P}/auth/login`).send({ phone: '9999999999', password: 'Admin@12345', role: 'customer' }).expect(400);
  });

  it('refresh issues new tokens; an access token cannot be used to refresh', async () => {
    const login = await c.http().post(`${P}/auth/login`).send({ phone: '9999999999', password: 'Admin@12345', role: 'admin' }).expect(200);
    const r = await c.http().post(`${P}/auth/refresh`).send({ refresh_token: login.body.refresh_token }).expect(200);
    expect(r.body.access_token).toBeDefined();
    await c.http().post(`${P}/auth/refresh`).send({ refresh_token: login.body.access_token }).expect(401);
    await c.http().post(`${P}/auth/refresh`).send({ refresh_token: 'garbage' }).expect(401);
  });

  it('a refresh token cannot be used as an access token', async () => {
    const login = await c.http().post(`${P}/auth/login`).send({ phone: '9999999999', password: 'Admin@12345', role: 'admin' }).expect(200);
    await c.http().get(`${P}/users/me`).set(bearer(login.body.refresh_token)).expect(401);
  });

  it('a disabled account loses access on refresh', async () => {
    const phone = uniquePhone();
    await c.http().post(`${P}/auth/otp/request`).send({ phone }).expect(200);
    const v = await c.http().post(`${P}/auth/otp/verify`).send({ phone, code: '123456' }).expect(200);
    await c.prisma.user.update({ where: { role_phone: { role: 'customer', phone } }, data: { is_active: false } });
    await c.http().post(`${P}/auth/refresh`).send({ refresh_token: v.body.refresh_token }).expect(401);
  });
});
