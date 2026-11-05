import { actors, bearer, createCtx, Ctx, install, makeCustomer, newLead, P, rzpSig } from './helpers';
import { hmacSha256 } from '../src/common/utils/crypto';

describe('payments (charges, Razorpay, Care Plan)', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  const installFee = async (tip: 'dream' | 'doulat' = 'dream') => {
    const l = await newLead(c, a, { tip });
    return { lead: l, charge: (await install(c, a[tip], l.id)).result.charge };
  };
  const webhook = (event: object, secret = process.env.RAZORPAY_WEBHOOK_SECRET!, sig?: string) => {
    const raw = JSON.stringify(event);
    return c.http().post(`${P}/payments/razorpay/webhook`).set('content-type', 'application/json').set('x-razorpay-signature', sig ?? hmacSha256(secret, raw)).send(raw);
  };

  describe('access control', () => {
    it('a TIP sees only their own charges, with the pending total; DSA is not allowed', async () => {
      const { charge } = await installFee('dream');
      const mine = await c.http().get(`${P}/charges?limit=200`).set(bearer(a.dream)).expect(200);
      expect(mine.body.items.map((x: any) => x.id)).toContain(charge.id);
      expect(mine.body.items.every((x: any) => x.payer_user_id === a.ids.dream)).toBe(true);
      expect(mine.body.pending_total).toBeGreaterThanOrEqual(590);
      const theirs = await c.http().get(`${P}/charges?limit=200`).set(bearer(a.doulat)).expect(200);
      expect(theirs.body.items.map((x: any) => x.id)).not.toContain(charge.id);
      await c.http().get(`${P}/charges`).set(bearer(a.dsa1)).expect(403);
      await c.http().get(`${P}/charges/${charge.id}`).set(bearer(a.doulat)).expect(403);
      await c.http().get(`${P}/charges/${charge.id}`).set(bearer(a.dream)).expect(200);
      await c.http().get(`${P}/charges/${charge.id}`).set(bearer(a.admin)).expect(200);
      await c.http().get(`${P}/charges/999999`).set(bearer(a.admin)).expect(404);
    });
    it('another TIP cannot start a payment on your charge', async () => {
      const { charge } = await installFee('dream');
      await c.http().post(`${P}/charges/${charge.id}/pay`).set(bearer(a.doulat)).send({}).expect(403);
      await c.http().post(`${P}/charges/${charge.id}/pay`).send({}).expect(403);
    });
  });

  describe('Razorpay checkout', () => {
    it('pay -> verify with a valid signature marks it paid and issues an invoice', async () => {
      const { charge } = await installFee();
      const order = await c.http().post(`${P}/charges/${charge.id}/pay`).set(bearer(a.dream)).send({}).expect(200);
      expect(order.body).toMatchObject({ amount: 59000, currency: 'INR', charge_id: charge.id });
      const again = await c.http().post(`${P}/charges/${charge.id}/pay`).set(bearer(a.dream)).send({}).expect(200);
      expect(again.body.order_id).toBe(order.body.order_id); // reuses the open order
      await c.http().post(`${P}/charges/${charge.id}/verify`).set(bearer(a.dream)).send({ razorpay_payment_id: 'pay_x', razorpay_signature: 'forged' }).expect(400);
      expect((await c.prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).status).toBe('pending');
      const ok = await c.http().post(`${P}/charges/${charge.id}/verify`).set(bearer(a.dream)).send({ razorpay_payment_id: 'pay_x', razorpay_signature: rzpSig(order.body.order_id, 'pay_x') }).expect(200);
      expect(ok.body).toMatchObject({ status: 'paid', pay_mode: 'razorpay', razorpay_payment_id: 'pay_x' });
      expect(ok.body.invoice_no).toBe(`CB-INV-${String(charge.id).padStart(6, '0')}`);
      // idempotent: verifying twice does not change anything or error
      const twice = await c.http().post(`${P}/charges/${charge.id}/verify`).set(bearer(a.dream)).send({ razorpay_payment_id: 'pay_x', razorpay_signature: rzpSig(order.body.order_id, 'pay_x') }).expect(200);
      expect(twice.body.invoice_no).toBe(ok.body.invoice_no);
      await c.http().post(`${P}/charges/${charge.id}/pay`).set(bearer(a.dream)).send({}).expect(400); // already paid
    });
    it('verify before starting a payment is rejected', async () => {
      const { charge } = await installFee();
      await c.http().post(`${P}/charges/${charge.id}/verify`).set(bearer(a.dream)).send({ razorpay_payment_id: 'p', razorpay_signature: 's' }).expect(400);
    });
    it('a signature for one order cannot pay a different charge', async () => {
      const x = await installFee(); const y = await installFee();
      const ox = (await c.http().post(`${P}/charges/${x.charge.id}/pay`).set(bearer(a.dream)).send({}).expect(200)).body;
      await c.http().post(`${P}/charges/${y.charge.id}/pay`).set(bearer(a.dream)).send({}).expect(200);
      await c.http().post(`${P}/charges/${y.charge.id}/verify`).set(bearer(a.dream)).send({ razorpay_payment_id: 'pay_1', razorpay_signature: rzpSig(ox.order_id, 'pay_1') }).expect(400);
    });
  });

  describe('webhook (source of truth)', () => {
    it('rejects bad / missing signatures', async () => {
      await webhook({ event: 'payment.captured' }, 'wrong-secret').expect(403);
      await webhook({ event: 'payment.captured' }, undefined, '').expect(403);
      await c.http().post(`${P}/payments/razorpay/webhook`).send({ event: 'payment.captured' }).expect(403);
    });
    it('payment.captured settles the charge (even if the browser never returned) and is idempotent', async () => {
      const { charge } = await installFee();
      const order = (await c.http().post(`${P}/charges/${charge.id}/pay`).set(bearer(a.dream)).send({}).expect(200)).body;
      const ev = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_wh1', order_id: order.order_id } } } };
      await webhook(ev).expect(200);
      let row = await c.prisma.charge.findUniqueOrThrow({ where: { id: charge.id } });
      expect(row).toMatchObject({ status: 'paid', razorpay_payment_id: 'pay_wh1' });
      const inv = row.invoice_no;
      await webhook(ev).expect(200);
      row = await c.prisma.charge.findUniqueOrThrow({ where: { id: charge.id } });
      expect(row.invoice_no).toBe(inv);
      expect(await c.prisma.notification.count({ where: { template: 'payment_received', user_id: a.ids.dream, payload: { path: '$.invoice_no', equals: inv as string } } })).toBe(1);
    });
    it('payment.failed marks it failed; unknown orders and events are ignored', async () => {
      const { charge } = await installFee();
      const order = (await c.http().post(`${P}/charges/${charge.id}/pay`).set(bearer(a.dream)).send({}).expect(200)).body;
      await webhook({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f', order_id: order.order_id } } } }).expect(200);
      expect((await c.prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).status).toBe('failed');
      await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: 'p', order_id: 'order_unknown' } } } }).expect(200);
      await webhook({ event: 'something.else' }).expect(200);
    });
  });

  describe('admin tools', () => {
    it('offline payment needs a reference and is admin-only', async () => {
      const { charge } = await installFee();
      await c.http().post(`${P}/charges/${charge.id}/offline`).set(bearer(a.dream)).send({ reference: 'cash' }).expect(403);
      await c.http().post(`${P}/charges/${charge.id}/offline`).set(bearer(a.admin)).send({}).expect(400);
      const r = await c.http().post(`${P}/charges/${charge.id}/offline`).set(bearer(a.admin)).send({ reference: 'NEFT-123' }).expect(200);
      expect(r.body).toMatchObject({ status: 'paid', pay_mode: 'offline', offline_reference: 'NEFT-123' });
      await c.http().post(`${P}/charges/${charge.id}/cancel`).set(bearer(a.admin)).expect(400); // paid can't be cancelled
    });
    it('waive and cancel', async () => {
      const w = (await installFee()).charge;
      expect((await c.http().post(`${P}/charges/${w.id}/waive`).set(bearer(a.admin)).expect(200)).body.status).toBe('waived');
      const x = (await installFee()).charge;
      const r = await c.http().post(`${P}/charges/${x.id}/cancel`).set(bearer(a.admin)).expect(200);
      expect(r.body).toMatchObject({ status: 'cancelled', install_fee_key: null });
      await c.http().post(`${P}/charges/${x.id}/pay`).set(bearer(a.dream)).send({}).expect(400);
    });
    it('the database itself refuses a second live install fee for one lead', async () => {
      const { lead, charge } = await installFee();
      await expect(c.prisma.charge.create({ data: { kind: 'tip_install_fee', payer_user_id: a.ids.dream, lead_id: lead.id, base_amount: 1, total_amount: 1, install_fee_key: lead.id } })).rejects.toThrow();
      expect(charge.install_fee_key).toBe(lead.id);
    });
  });

  describe('Care Plan', () => {
    it('TIP buys Care Plan for several leads with one payment; paying flips every lead flag and creates devices', async () => {
      const installed = await newLead(c, a, { tip: 'dream' });
      await install(c, a.dream, installed.id, 'SN-CP-1');
      const pending = await newLead(c, a, { tip: 'dream' });

      const ch = await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [installed.id, pending.id] }).expect(201);
      expect(ch.body).toMatchObject({ kind: 'tip_care_plan_fee', status: 'pending', base_amount: 398, total_amount: 469.64 });
      expect(ch.body.charge_leads).toHaveLength(2);
      expect((await c.prisma.lead.findUniqueOrThrow({ where: { id: installed.id } })).care_plan).toBe(false); // not before payment

      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [installed.id] }).expect(409); // already pending

      const order = (await c.http().post(`${P}/charges/${ch.body.id}/pay`).set(bearer(a.dream)).send({}).expect(200)).body;
      const ev = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_cp', order_id: order.order_id } } } };
      const raw = JSON.stringify(ev);
      await c.http().post(`${P}/payments/razorpay/webhook`).set('content-type', 'application/json').set('x-razorpay-signature', hmacSha256(process.env.RAZORPAY_WEBHOOK_SECRET!, raw)).send(raw).expect(200);

      const l1 = await c.prisma.lead.findUniqueOrThrow({ where: { id: installed.id } });
      const l2 = await c.prisma.lead.findUniqueOrThrow({ where: { id: pending.id } });
      expect(l1).toMatchObject({ care_plan: true });
      expect(l1.care_plan_at).toBeTruthy();
      expect(l2.care_plan).toBe(true);
      expect(await c.prisma.carePlanDevice.count({ where: { lead_id: installed.id, is_active: true } })).toBe(1); // installed -> device now
      expect(await c.prisma.carePlanDevice.count({ where: { lead_id: pending.id } })).toBe(0); // not installed yet
      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [installed.id] }).expect(409); // already active

      // when the second lead is installed later, its device appears automatically
      await install(c, a.dream, pending.id, 'SN-CP-2');
      const dev = await c.prisma.carePlanDevice.findUniqueOrThrow({ where: { lead_id: pending.id } });
      expect(dev).toMatchObject({ is_active: true, serial_number: 'SN-CP-2' });
    });
    it('guards: others\' leads, lost leads, empty / bad input, DSA role, unconfigured fee', async () => {
      const mine = await newLead(c, a, { tip: 'dream' });
      const theirs = await newLead(c, a, { tip: 'doulat' });
      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [theirs.id] }).expect(400);
      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [] }).expect(400);
      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({}).expect(400);
      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [999999] }).expect(400);
      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dsa1)).send({ lead_ids: [mine.id] }).expect(403);
      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.admin)).send({ lead_ids: [mine.id] }).expect(403);
      await c.http().patch(`${P}/leads/${mine.id}/status`).set(bearer(a.dream)).send({ status: 'cancelled' }).expect(200);
      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [mine.id] }).expect(400);
      const ok = await newLead(c, a, { tip: 'dream' });
      await c.http().put(`${P}/settings/care_plan_fee_per_lead`).set(bearer(a.admin)).send({ value: '0' }).expect(200);
      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [ok.id] }).expect(400);
      await c.http().put(`${P}/settings/care_plan_fee_per_lead`).set(bearer(a.admin)).send({ value: '199' }).expect(200);
    });
    it('a failed Care Plan payment can be retried; cancelling frees the leads', async () => {
      const l = await newLead(c, a, { tip: 'dream' });
      const first = (await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [l.id] }).expect(201)).body;
      const order = (await c.http().post(`${P}/charges/${first.id}/pay`).set(bearer(a.dream)).send({}).expect(200)).body;
      const raw = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'p', order_id: order.order_id } } } });
      await c.http().post(`${P}/payments/razorpay/webhook`).set('content-type', 'application/json').set('x-razorpay-signature', hmacSha256(process.env.RAZORPAY_WEBHOOK_SECRET!, raw)).send(raw).expect(200);
      const retry = await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [l.id] }).expect(201);
      expect(retry.body.id).not.toBe(first.id);
      await c.http().post(`${P}/charges/${retry.body.id}/cancel`).set(bearer(a.admin)).expect(200);
      await c.http().post(`${P}/charges/care-plan`).set(bearer(a.dream)).send({ lead_ids: [l.id] }).expect(201);
    });
    it('customers can see charges they are payer of (none) without errors', async () => {
      const cust = await makeCustomer(c);
      const r = await c.http().get(`${P}/charges`).set(bearer(cust.token)).expect(200);
      expect(r.body.items).toEqual([]);
    });
  });
});
