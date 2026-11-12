import { actors, bearer, createCtx, Ctx, install, newLead, P } from './helpers';

describe('care plan (modem monitoring)', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  let dev: number; let leadId: number; let custToken: string;
  beforeAll(async () => {
    c = await createCtx(); a = await actors(c);
    // installed lead with Care Plan on (set the flag as the webhook would) + a customer account for it
    const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
    leadId = l.id;
    const cust = await c.prisma.user.create({ data: { role: 'customer', name: 'CP Customer', phone: l.customer_phone } });
    await c.prisma.lead.update({ where: { id: l.id }, data: { care_plan: true, care_plan_at: new Date(), customer_user_id: cust.id } });
    await install(c, a.dream, l.id, `SN-CPE-${Date.now()}`);
    dev = Number((await c.prisma.carePlanDevice.findUniqueOrThrow({ where: { lead_id: l.id } })).id);
    custToken = await c.jwt.signAsync({ sub: Number(cust.id), role: 'customer', phone: cust.phone, typ: 'access' }, { secret: process.env.JWT_SECRET, expiresIn: '10m' });
  });
  afterAll(() => c.app.close());

  it('devices are scoped: TIP / customer / admin see it, other TIP and DSA do not', async () => {
    const ids = async (t: string) => (await c.http().get(`${P}/care-plan/devices?limit=200`).set(bearer(t)).expect(200)).body.items.map((x: any) => x.id);
    expect(await ids(a.dream)).toContain(dev);
    expect(await ids(custToken)).toEqual([dev]);
    expect(await ids(a.admin)).toContain(dev);
    expect(await ids(a.doulat)).not.toContain(dev);
    expect(await ids(a.dsa1)).toEqual([]);
    await c.http().get(`${P}/care-plan/devices/${dev}`).set(bearer(a.doulat)).expect(404);
    await c.http().get(`${P}/care-plan/devices/${dev}`).set(bearer(a.dsa1)).expect(404);
    await c.http().get(`${P}/care-plan/devices`).expect(401);
  });
  it('refresh pulls live status from the modem (mock ACS)', async () => {
    const r = await c.http().post(`${P}/care-plan/devices/${dev}/refresh`).set(bearer(a.dream)).expect(200);
    expect(r.body.online).not.toBeNull();
    expect(r.body.last_seen_at).toBeTruthy();
    expect(r.body.connected_clients).toBeGreaterThan(0);
    const detail = await c.http().get(`${P}/care-plan/devices/${dev}`).set(bearer(custToken)).expect(200);
    expect(detail.body.wifi_ssid).toMatch(/^ConnectBhai-/);
    expect(detail.body.lead.ref_code).toBeDefined();
  });
  it('customer can reboot and change Wi-Fi; the password is never stored', async () => {
    await c.prisma.carePlanDevice.update({ where: { id: dev }, data: { online: true } }); // the mock ACS reports ~1 in 7 serials offline
    const reboot = await c.http().post(`${P}/care-plan/devices/${dev}/actions`).set(bearer(custToken)).send({ action: 'reboot' }).expect(202);   // accepted: the modem runs it at its next check-in (mock ACS answers at once, so it is already done)
    expect(reboot.body).toMatchObject({ action: 'reboot', status: 'done' });
    const wifi = await c.http().post(`${P}/care-plan/devices/${dev}/actions`).set(bearer(custToken)).send({ action: 'change_wifi', params: { ssid: 'MyHome', password: 'SuperSecret123' } }).expect(202);
    expect(wifi.body.status).toBe('done');
    const row = await c.prisma.deviceAction.findUniqueOrThrow({ where: { id: wifi.body.id } });
    expect(JSON.stringify(row.params)).toContain('MyHome');
    expect(JSON.stringify(row)).not.toContain('SuperSecret123');
    await c.http().post(`${P}/care-plan/devices/${dev}/actions`).set(bearer(custToken)).send({ action: 'change_wifi' }).expect(400);
    await c.http().post(`${P}/care-plan/devices/${dev}/actions`).set(bearer(custToken)).send({ action: 'format_disk' }).expect(400);
    await c.http().post(`${P}/care-plan/devices/${dev}/actions`).set(bearer(a.doulat)).send({ action: 'reboot' }).expect(404);
    const detail = await c.http().get(`${P}/care-plan/devices/${dev}`).set(bearer(a.dream)).expect(200);
    expect(detail.body.actions.length).toBe(2);
  });
  it('speed tests are stored and listed with the device', async () => {
    const t = await c.http().post(`${P}/care-plan/devices/${dev}/speed-test`).set(bearer(a.dream)).expect(202);   // accepted: the job runs in the background (inline in tests, so it is already done)
    expect(t.body.status).toBe('done');
    expect(Number(t.body.download_mbps)).toBeGreaterThan(0);
    expect((await c.http().get(`${P}/care-plan/devices/${dev}`).set(bearer(a.dream))).body.speed_tests).toHaveLength(1);
  });
  it('only TIP / admin can edit modem identity', async () => {
    await c.http().patch(`${P}/care-plan/devices/${dev}`).set(bearer(custToken)).send({ model: 'x' }).expect(403);
    const r = await c.http().patch(`${P}/care-plan/devices/${dev}`).set(bearer(a.dream)).send({ model: 'Huawei HG8145', mac_address: 'AA:BB:CC:DD:EE:FF' }).expect(200);
    expect(r.body.model).toBe('Huawei HG8145');
    await c.http().patch(`${P}/care-plan/devices/${dev}`).set(bearer(a.dream)).send({ is_active: false }).expect(400); // cannot self-deactivate
  });
  it('poll only touches ACTIVE Care Plan devices (admin only)', async () => {
    await c.http().post(`${P}/care-plan/poll`).set(bearer(a.dream)).expect(403);
    const before = await c.prisma.carePlanDevice.findUniqueOrThrow({ where: { id: dev } });
    const inactive = await newLead(c, a, { tip: 'dream' });
    await c.prisma.lead.update({ where: { id: inactive.id }, data: { care_plan: true } });
    const off = await c.prisma.carePlanDevice.create({ data: { lead_id: inactive.id, tip_user_id: a.ids.dream, serial_number: `OFF-${Date.now()}`, is_active: false } });
    const noCare = await newLead(c, a, { tip: 'dream' });
    const nc = await c.prisma.carePlanDevice.create({ data: { lead_id: noCare.id, tip_user_id: a.ids.dream, serial_number: `NC-${Date.now()}` } }); // lead.care_plan = false
    const r = await c.http().post(`${P}/care-plan/poll`).set(bearer(a.admin)).expect(200);
    expect(r.body.polled).toBeGreaterThanOrEqual(1);
    expect(r.body.failed).toBe(0);
    expect((await c.prisma.carePlanDevice.findUniqueOrThrow({ where: { id: dev } })).updated_at.getTime()).toBeGreaterThanOrEqual(before.updated_at.getTime());
    expect((await c.prisma.carePlanDevice.findUniqueOrThrow({ where: { id: off.id } })).last_seen_at).toBeNull();
    expect((await c.prisma.carePlanDevice.findUniqueOrThrow({ where: { id: nc.id } })).last_seen_at).toBeNull();
  });
  it('modem commands are refused when the router is offline or not linked; refresh still works', async () => {
    await c.prisma.carePlanDevice.update({ where: { id: dev }, data: { online: false } });
    await c.http().post(`${P}/care-plan/devices/${dev}/actions`).set(bearer(custToken)).send({ action: 'reboot' }).expect(400);
    await c.http().post(`${P}/care-plan/devices/${dev}/actions`).set(bearer(custToken)).send({ action: 'refresh' }).expect(202);
    const l = await newLead(c, a, { tip: 'dream' });
    const nl = await c.prisma.carePlanDevice.create({ data: { lead_id: l.id, tip_user_id: a.ids.dream, is_active: true } }); // no serial, no GenieACS id
    await c.http().post(`${P}/care-plan/devices/${nl.id}/actions`).set(bearer(a.dream)).send({ action: 'reboot' }).expect(400);
    await c.prisma.carePlanDevice.update({ where: { id: dev }, data: { online: true } }); // leave it as the next tests expect
  });
  it('actions are refused on a deactivated device', async () => {
    const l = await newLead(c, a, { tip: 'dream' });
    const d = await c.prisma.carePlanDevice.create({ data: { lead_id: l.id, tip_user_id: a.ids.dream, serial_number: `DEAD-${Date.now()}`, is_active: false } });
    await c.http().post(`${P}/care-plan/devices/${d.id}/actions`).set(bearer(a.dream)).send({ action: 'reboot' }).expect(400);
    await c.http().post(`${P}/care-plan/devices/${d.id}/speed-test`).set(bearer(a.dream)).expect(400);
  });
  it('the lead flag matches', async () => {
    expect((await c.http().get(`${P}/leads/${leadId}`).set(bearer(a.dream))).body.care_plan).toBe(true);
  });
});
