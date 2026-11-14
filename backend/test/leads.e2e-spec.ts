import { actors, bearer, createCtx, Ctx, inDays, makeCustomer, newLead, P, PIN, planId, uniquePhone } from './helpers';

describe('leads', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>; let pid: number;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); pid = await planId(c); });
  afterAll(() => c.app.close());
  const body = (o: object = {}) => ({ customer_name: 'Neha Singh', customer_phone: uniquePhone(), pincode: PIN, plan_id: pid, ...o });

  describe('creating', () => {
    it('website visitor creates a lead: ref code, auto-assigned to a TIP serving the PIN, event logged', async () => {
      const r = await c.http().post(`${P}/leads`).send(body()).expect(201);
      expect(r.body).toMatchObject({ source: 'website', status: 'new', brought_by_user_id: null, care_plan: false });
      expect(r.body.ref_code).toBe(`CB-${String(r.body.id).padStart(6, '0')}`);
      expect(r.body.tip_user_id).toBeTruthy();
      expect(r.body.plan.plan_code).toBe('BSNL-01');
      const ev = await c.http().get(`${P}/leads/${r.body.id}/events`).set(bearer(a.admin)).expect(200);
      expect(ev.body.map((e: any) => e.event_type)).toEqual(['created', 'assigned']);
    });
    it('auto-assign can be turned off in settings', async () => {
      await c.http().put(`${P}/settings/auto_assign`).set(bearer(a.admin)).send({ value: '0' }).expect(200);
      const r = await c.http().post(`${P}/leads`).send(body()).expect(201);
      expect(r.body.tip_user_id).toBeNull();
      await c.http().put(`${P}/settings/auto_assign`).set(bearer(a.admin)).send({ value: '1' }).expect(200);
    });
    it('falls back to the internal Connect Bhai TIP when no TIP maps the PIN', async () => {
      const pin = '999555';
      const indore = await c.prisma.city.findUniqueOrThrow({ where: { name: 'Indore' } });
      await c.prisma.area.create({ data: { city_id: indore.id, name: 'Lonely Colony', pincode: pin } });
      const r = await c.http().post(`${P}/leads`).send(body({ pincode: pin, plan_id: undefined })).expect(201);
      expect(r.body.tip_user_id).toBe(a.ids.internal);
    });
    it('a DSA-created lead records that DSA; nobody can name a DSA on a lead (admin or DSA)', async () => {
      const r = await c.http().post(`${P}/leads`).set(bearer(a.dsa1)).send(body()).expect(201);
      expect(r.body).toMatchObject({ source: 'dsa', brought_by_user_id: a.ids.dsa1 });
      await c.http().post(`${P}/leads`).set(bearer(a.dsa1)).send(body({ brought_by_user_id: a.ids.dsa2 })).expect(400);   // a DSA cannot hand a lead to another DSA
      await c.http().post(`${P}/leads`).set(bearer(a.admin)).send(body({ brought_by_user_id: a.ids.dsa2 })).expect(400);   // admin cannot attribute a lead to a DSA
    });
    it('an admin-created lead has no DSA', async () => {
      const r = await c.http().post(`${P}/leads`).set(bearer(a.admin)).send(body()).expect(201);
      expect(r.body).toMatchObject({ source: 'admin', brought_by_user_id: null });
    });
    it('customer-created lead is linked to the customer account', async () => {
      const cust = await makeCustomer(c);
      const r = await c.http().post(`${P}/leads`).set(bearer(cust.token)).send(body({ customer_phone: cust.phone })).expect(201);
      expect(r.body.customer_user_id).toBe(Number(cust.user.id));
    });
    it('normalises the phone number and blocks duplicate open requests for the same PIN', async () => {
      const phone = uniquePhone();
      const first = await c.http().post(`${P}/leads`).send(body({ customer_phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` })).expect(201);
      expect(first.body.customer_phone).toBe(phone);
      const dup = await c.http().post(`${P}/leads`).send(body({ customer_phone: phone })).expect(409);
      expect(dup.body.message).toContain(first.body.ref_code);
      await c.http().post(`${P}/leads`).send(body({ customer_phone: phone, pincode: '452001', plan_id: undefined })).expect(201); // different PIN is fine
    });
    it('validates input', async () => {
      await c.http().post(`${P}/leads`).send(body({ customer_phone: '123' })).expect(400);
      await c.http().post(`${P}/leads`).send(body({ customer_name: 'A' })).expect(400);
      await c.http().post(`${P}/leads`).send(body({ pincode: '12' })).expect(400);
      await c.http().post(`${P}/leads`).send(body({ status: 'installed' })).expect(400); // cannot inject fields
      await c.http().post(`${P}/leads`).send(body({ pincode: '999888' })).expect(400); // not served
      await c.http().post(`${P}/leads`).send(body({ plan_id: 999999 })).expect(400);
      await c.http().post(`${P}/leads`).send(body({ customer_email: 'not-an-email' })).expect(400);
      await c.http().post(`${P}/leads`).send(body({ source: 'dsa' })).expect(400);
    });
    it('refuses a plan that is not sold in the PIN', async () => {
      const plan = await c.prisma.plan.findFirstOrThrow({ where: { pincodes: { none: { pincode: PIN } } } });
      const r = await c.http().post(`${P}/leads`).send(body({ plan_id: Number(plan.id) })).expect(400);
      expect(r.body.message).toMatch(/not available/);
    });
  });

  describe('visibility', () => {
    it('a DSA sees only the leads they brought, and cannot open other leads', async () => {
      const mine = await newLead(c, a, { by: 'dsa1' });
      const theirs = await newLead(c, a, { by: 'dsa2' });
      const list = await c.http().get(`${P}/leads?limit=200`).set(bearer(a.dsa1)).expect(200);
      const ids = list.body.items.map((l: any) => l.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
      expect(list.body.items.every((l: any) => l.brought_by_user_id === a.ids.dsa1)).toBe(true);
      await c.http().get(`${P}/leads/${mine.id}`).set(bearer(a.dsa1)).expect(200);
      await c.http().get(`${P}/leads/${theirs.id}`).set(bearer(a.dsa1)).expect(404);
      await c.http().get(`${P}/leads/${mine.id}/events`).set(bearer(a.dsa2)).expect(404);
    });
    it('a TIP sees only leads assigned to them; admin sees all and can filter', async () => {
      const l = await newLead(c, a, { tip: 'dream' });
      const other = await newLead(c, a, { tip: 'doulat' });
      const dream = await c.http().get(`${P}/leads?limit=200`).set(bearer(a.dream)).expect(200);
      expect(dream.body.items.map((x: any) => x.id)).toContain(l.id);
      expect(dream.body.items.map((x: any) => x.id)).not.toContain(other.id);
      await c.http().get(`${P}/leads/${other.id}`).set(bearer(a.dream)).expect(404);
      const admin = await c.http().get(`${P}/leads?tip_user_id=${a.ids.doulat}&limit=200`).set(bearer(a.admin)).expect(200);
      expect(admin.body.items.map((x: any) => x.id)).toContain(other.id);
      expect(admin.body.items.every((x: any) => x.tip_user_id === a.ids.doulat)).toBe(true);
    });
    it('a customer sees only their own requests (by account or by phone)', async () => {
      const cust = await makeCustomer(c);
      const mine = (await c.http().post(`${P}/leads`).send(body({ customer_phone: cust.phone })).expect(201)).body; // created anonymously, matched by phone
      const other = await newLead(c, a);
      const list = await c.http().get(`${P}/leads`).set(bearer(cust.token)).expect(200);
      expect(list.body.items.map((x: any) => x.id)).toEqual([mine.id]);
      await c.http().get(`${P}/leads/${other.id}`).set(bearer(cust.token)).expect(404);
    });
    it('filters by status, text search and pincode; requires login', async () => {
      const l = await newLead(c, a);
      const q = await c.http().get(`${P}/leads?q=${l.ref_code}&status=new&pincode=${PIN}`).set(bearer(a.admin)).expect(200);
      expect(q.body.items.map((x: any) => x.id)).toEqual([l.id]);
      await c.http().get(`${P}/leads?status=weird`).set(bearer(a.admin)).expect(400);
      await c.http().get(`${P}/leads`).expect(401);
    });
    it('public tracking needs both the ref code and the phone', async () => {
      const l = await newLead(c, a);
      const ok = await c.http().get(`${P}/leads/track?ref_code=${l.ref_code}&phone=${l.customer_phone}`).expect(200);
      expect(ok.body).toMatchObject({ ref_code: l.ref_code, status: 'new' });
      expect(ok.body.customer_phone).toBeUndefined();
      await c.http().get(`${P}/leads/track?ref_code=${l.ref_code}&phone=9000000000`).expect(404);
      await c.http().get(`${P}/leads/track?ref_code=${l.ref_code}`).expect(400);
    });
  });

  describe('working a lead', () => {
    it('TIP moves a lead through the pipeline with the required details', async () => {
      const l = await newLead(c, a, { tip: 'dream' });
      const st = (s: object, who = a.dream) => c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(who)).send(s);
      expect((await st({ status: 'contacted', note: 'called' }).expect(200)).body.status).toBe('contacted');
      await st({ status: 'followup' }).expect(400); // needs followup_at
      const fu = await st({ status: 'followup', followup_at: inDays(2) }).expect(200);
      expect(fu.body.followup_at).toBeTruthy();
      await st({ status: 'lost' }).expect(400); // needs reason
      const lost = await st({ status: 'lost', lost_reason: 'Not interested' }).expect(200);
      expect(lost.body.lost_reason).toBe('Not interested');
      await st({ status: 'contacted' }).expect(400); // lost can only reopen to followup
      await st({ status: 'followup', followup_at: inDays(1) }).expect(200);
      const ev = await c.http().get(`${P}/leads/${l.id}/events`).set(bearer(a.dsa1)).expect(200);
      const changes = ev.body.filter((e: any) => e.event_type === 'status_changed').map((e: any) => `${e.from_status}>${e.to_status}`);
      expect(changes).toEqual(['new>contacted', 'contacted>followup', 'followup>lost', 'lost>followup']);
    });
    it('installed / scheduled cannot be set by hand', async () => {
      const l = await newLead(c, a, { tip: 'dream' });
      await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(a.dream)).send({ status: 'installed' }).expect(400);
      await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(a.dream)).send({ status: 'scheduled' }).expect(400);
    });
    it('a DSA can see status but cannot change it', async () => {
      const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
      await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(a.dsa1)).send({ status: 'contacted' }).expect(403);
    });
    it('a TIP cannot touch another TIP\'s lead', async () => {
      const l = await newLead(c, a, { tip: 'doulat' });
      await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(a.dream)).send({ status: 'contacted' }).expect(404);
    });
    it('a customer can only cancel their own request', async () => {
      const cust = await makeCustomer(c);
      const l = (await c.http().post(`${P}/leads`).set(bearer(cust.token)).send(body({ customer_phone: cust.phone })).expect(201)).body;
      await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(cust.token)).send({ status: 'contacted' }).expect(403);
      const r = await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(cust.token)).send({ status: 'cancelled' }).expect(200);
      expect(r.body.status).toBe('cancelled');
      await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(cust.token)).send({ status: 'cancelled' }).expect(400); // terminal
    });
    it('admin reassigns to an approved TIP only', async () => {
      const l = await newLead(c, a, { tip: 'dream' });
      const r = await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ tip_user_id: a.ids.doulat }).expect(200);
      expect(r.body.tip.id).toBe(a.ids.doulat);
      await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ tip_user_id: a.ids.dsa1 }).expect(400);
      await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.dream)).send({ tip_user_id: a.ids.dream }).expect(403);
      await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.dsa1)).send({ tip_user_id: a.ids.dream }).expect(403);
    });
    it('a lead can never be assigned to a DSA: no DSA field, a DSA id is refused, and the DSA on a lead never changes', async () => {
      const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
      await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({}).expect(400);
      await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ dsa_user_id: a.ids.dsa2 }).expect(400);                        // no DSA assignment
      await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ dsa_user_id: null }).expect(400);                              // and no clearing either
      await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ dsa_user_id: a.ids.dsa2, tip_user_id: a.ids.doulat }).expect(400);
      await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ tip_user_id: a.ids.dsa2 }).expect(400);                       // a DSA is not a TIP
      const r = await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ tip_user_id: a.ids.doulat }).expect(200);
      expect(r.body.tip.id).toBe(a.ids.doulat);
      expect(r.body.dsa.id).toBe(a.ids.dsa1);   // the DSA who brought it keeps it, untouched
      await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.dsa2)).expect(404);   // another DSA never sees it
      const ev = await c.http().get(`${P}/leads/${l.id}/events`).set(bearer(a.admin)).expect(200);
      expect(ev.body.filter((e: any) => e.event_type === 'assigned' && /dsa/i.test(e.note)).length).toBe(0);
    });
    it('a website lead is assigned to a TIP only and has no DSA', async () => {
      const l = await newLead(c, a, { by: 'web', tip: 'dream' });
      expect(l.brought_by_user_id).toBeNull();
      expect(l.tip_user_id).toBe(a.ids.dream);
      expect(l.dsa ?? null).toBeNull();
    });
    it('the TIP cannot change while a booking is open, and the lead returns contact details for both partners', async () => {
      const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
      const got = (await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.admin)).expect(200)).body;
      expect(got.dsa.phone).toBeTruthy();
      expect(got.tip.phone).toBeTruthy();
      expect(got.plan === null || 'speed_mbps' in got.plan).toBe(true);
      await c.http().post(`${P}/bookings`).set(bearer(a.dream)).send({ lead_id: l.id, scheduled_at: inDays(2) }).expect(201);
      await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ tip_user_id: a.ids.doulat }).expect(400);
      await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ tip_user_id: a.ids.dream }).expect(200); // same TIP = no change
    });
    it('"assigned" and "unassigned" filters split new leads in every portal', async () => {
      const mine = await newLead(c, a, { by: 'dsa1' });
      const ids = (r: any) => r.body.items.map((x: any) => x.id);
      const asg = await c.http().get(`${P}/leads?status=new&assigned=1&limit=100`).set(bearer(a.admin)).expect(200);
      expect(ids(asg)).toContain(mine.id);
      const un = await c.http().get(`${P}/leads?status=new&unassigned=1&limit=100`).set(bearer(a.admin)).expect(200);
      expect(ids(un)).not.toContain(mine.id);
      const dsaUn = await c.http().get(`${P}/leads?unassigned=1`).set(bearer(a.dsa1)).expect(200);
      expect(dsaUn.body.items.length).toBe(0);
    });
    it('participants can add notes to the timeline', async () => {
      const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
      await c.http().post(`${P}/leads/${l.id}/notes`).set(bearer(a.dsa1)).send({ note: 'Customer prefers evening' }).expect(201);
      await c.http().post(`${P}/leads/${l.id}/notes`).set(bearer(a.dream)).send({ note: 'Will call at 6' }).expect(201);
      await c.http().post(`${P}/leads/${l.id}/notes`).set(bearer(a.doulat)).send({ note: 'intruder' }).expect(404);
      await c.http().post(`${P}/leads/${l.id}/notes`).set(bearer(a.dsa1)).send({ note: '' }).expect(400);
      const ev = await c.http().get(`${P}/leads/${l.id}/events`).set(bearer(a.admin)).expect(200);
      expect(ev.body.filter((e: any) => e.event_type === 'note')).toHaveLength(2);
    });
  });
});
