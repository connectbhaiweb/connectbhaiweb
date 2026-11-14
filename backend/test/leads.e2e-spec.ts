import { actors, bearer, createCtx, Ctx, inDays, makeCustomer, newLead, P, PIN, planId, uniquePhone } from './helpers';

describe('leads', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>; let pid: number;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); pid = await planId(c); });
  afterAll(() => c.app.close());
  const body = (o: object = {}) => ({ customer_name: 'Neha Singh', customer_phone: uniquePhone(), pincode: PIN, plan_id: pid, ...o });

  describe('creating', () => {
    it('website visitor creates a lead: ref code, auto-assigned to the DSA serving the PIN, event logged', async () => {
      const r = await c.http().post(`${P}/leads`).send(body()).expect(201);
      expect(r.body).toMatchObject({ source: 'website', status: 'new', brought_by_user_id: a.ids.dsa1, tip_user_id: null, care_plan: false });   // 452010 is served by DSA Ramesh (dsa1); a TIP comes only after booking
      expect(r.body.ref_code).toBe(`CB-${String(r.body.id).padStart(6, '0')}`);
      expect(r.body.plan.plan_code).toBe('BSNL-01');
      const ev = await c.http().get(`${P}/leads/${r.body.id}/events`).set(bearer(a.admin)).expect(200);
      expect(ev.body.map((e: any) => e.event_type)).toEqual(['created', 'assigned']);
      expect(ev.body[1].note).toBe(`dsa_user_id=${a.ids.dsa1}`);
    });
    it('auto-assign can be turned off in settings: the lead waits for admin', async () => {
      await c.http().put(`${P}/settings/auto_assign`).set(bearer(a.admin)).send({ value: '0' }).expect(200);
      const r = await c.http().post(`${P}/leads`).send(body()).expect(201);
      expect(r.body).toMatchObject({ brought_by_user_id: null, tip_user_id: null });
      await c.http().put(`${P}/settings/auto_assign`).set(bearer(a.admin)).send({ value: '1' }).expect(200);
    });
    it('a PIN code no DSA serves: the lead waits for admin (no DSA, no TIP)', async () => {
      const pin = '999555';
      const indore = await c.prisma.city.findUniqueOrThrow({ where: { name: 'Indore' } });
      await c.prisma.area.create({ data: { city_id: indore.id, name: 'Lonely Colony', pincode: pin } });
      const r = await c.http().post(`${P}/leads`).send(body({ pincode: pin, plan_id: undefined })).expect(201);
      expect(r.body).toMatchObject({ brought_by_user_id: null, tip_user_id: null });
    });
    it('several DSAs serve a PIN: the one with the fewest open leads gets the next lead; inactive coverage is skipped', async () => {
      // two brand-new DSAs, so both start with no open leads (the seeded DSAs carry other tests' leads)
      const indore = await c.prisma.city.findUniqueOrThrow({ where: { name: 'Indore' } });
      const pin = '999556', pinOff = '999557';
      for (const p of [pin, pinOff]) await c.prisma.area.create({ data: { city_id: indore.id, name: `Area ${p}`, pincode: p } });
      const newDsa = async (pins: string[]) => {
        const reg = await c.http().post(`${P}/partners/register`).send({ role: 'dsa', name: 'Fresh Dsa', phone: uniquePhone(), address: '1 Road, Indore', pincode: '452001', aadhaar: '9999 1111 2222', pan: 'ABCDE1234F', bank_name: 'SBI', bank_account: '123456789012', bank_ifsc: 'SBIN0001234', service_pincodes: pins }).expect(201);
        await c.http().patch(`${P}/users/${reg.body.user.id}/partner-status`).set(bearer(a.admin)).send({ status: 'approved' }).expect(200);
        return Number(reg.body.user.id);
      };
      const x = await newDsa([pin, pinOff]), y = await newDsa([pin, pinOff]);
      await c.prisma.dsaPincodeMapping.updateMany({ where: { dsa_user_id: y, pincode: pinOff }, data: { is_active: false } });   // y's coverage of pinOff is switched off
      const owner = async (p: string) => Number((await c.http().post(`${P}/leads`).send(body({ pincode: p, plan_id: undefined })).expect(201)).body.brought_by_user_id);
      const got = [await owner(pin), await owner(pin), await owner(pin), await owner(pin)];
      expect(got[0]).toBe(Math.min(x, y));                                      // a tie goes to the lower id
      expect(got[1]).toBe(Math.max(x, y));                                      // then the one with fewer open leads
      expect(got.filter((d) => d === x)).toHaveLength(2);                       // balanced: two each
      expect(got.filter((d) => d === y)).toHaveLength(2);
      expect(await owner(pinOff)).toBe(x);                                      // y does not serve pinOff any more...
      expect(await owner(pinOff)).toBe(x);                                      // ...so x keeps getting them, however many it has
    });
    it('a DSA-created lead records that DSA; nobody can name a DSA on a lead (admin or DSA)', async () => {
      const r = await c.http().post(`${P}/leads`).set(bearer(a.dsa1)).send(body()).expect(201);
      expect(r.body).toMatchObject({ source: 'dsa', brought_by_user_id: a.ids.dsa1 });
      await c.http().post(`${P}/leads`).set(bearer(a.dsa1)).send(body({ brought_by_user_id: a.ids.dsa2 })).expect(400);   // a DSA cannot hand a lead to another DSA
      await c.http().post(`${P}/leads`).set(bearer(a.admin)).send(body({ brought_by_user_id: a.ids.dsa2 })).expect(400);   // admin cannot attribute a lead to a DSA
    });
    it('an admin-created lead is assigned like any other: to the DSA serving the PIN (a DSA cannot be named on it)', async () => {
      const r = await c.http().post(`${P}/leads`).set(bearer(a.admin)).send(body()).expect(201);
      expect(r.body).toMatchObject({ source: 'admin', brought_by_user_id: a.ids.dsa1, tip_user_id: null });
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
    it('a DSA works their own lead: contact, follow-up, lost; not installed / scheduled; not another DSA\'s lead', async () => {
      const l = await newLead(c, a, { by: 'dsa1' });
      const st = (s: object, who = a.dsa1) => c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(who)).send(s);
      expect((await st({ status: 'contacted', note: 'called' }).expect(200)).body.status).toBe('contacted');
      await st({ status: 'followup' }).expect(400);                       // needs followup_at
      await st({ status: 'followup', followup_at: inDays(2) }).expect(200);
      await st({ status: 'lost' }).expect(400);                           // needs a reason
      await st({ status: 'lost', lost_reason: 'Not interested' }).expect(200);
      await st({ status: 'followup', followup_at: inDays(1) }).expect(200);   // a lost lead can be reopened
      await st({ status: 'installed' }).expect(400);                      // only a booking can do that
      await st({ status: 'scheduled' }).expect(400);
      await st({ status: 'contacted' }, a.dsa2).expect(404);              // not their lead
      const ev = await c.http().get(`${P}/leads/${l.id}/events`).set(bearer(a.dsa1)).expect(200);
      expect(ev.body.filter((e: any) => e.event_type === 'status_changed').map((e: any) => `${e.from_status}>${e.to_status}`)).toEqual(['new>contacted', 'contacted>followup', 'followup>lost', 'lost>followup']);
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
    describe('DSA-first flow: DSA books, then a TIP is assigned, then the TIP installs', () => {
      const tomorrow = () => inDays(1);
      it('end to end: auto-assigned DSA -> contact -> book -> TIP assigned by the DSA -> TIP installs -> DSA is paid', async () => {
        const l = (await c.http().post(`${P}/leads`).send(body()).expect(201)).body;
        expect(l.brought_by_user_id).toBe(a.ids.dsa1);
        await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.dream)).expect(404);                       // no TIP yet: the TIP does not see it
        await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(a.dsa1)).send({ status: 'contacted' }).expect(200);

        // a TIP is assigned to a booked lead only
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.dsa1)).send({ tip_user_id: a.ids.dream }).expect(400);
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ tip_user_id: a.ids.dream }).expect(400);

        // the DSA books it, with no TIP yet
        const bk = (await c.http().post(`${P}/bookings`).set(bearer(a.dsa1)).send({ lead_id: l.id, scheduled_at: tomorrow() }).expect(201)).body;
        expect(bk.tip_user_id).toBeNull();
        const booked = (await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.dsa1)).expect(200)).body;
        expect(booked).toMatchObject({ status: 'scheduled', tip_user_id: null });
        await c.http().post(`${P}/bookings/${bk.id}/complete`).set(bearer(a.admin)).send({ connection_id: 'CID-1' }).expect(400);   // nobody to install it yet
        await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.dream)).expect(404);

        // the lead's DSA assigns the TIP; the booking follows
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.dsa2)).send({ tip_user_id: a.ids.dream }).expect(404);          // another DSA cannot
        const assigned = (await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.dsa1)).send({ tip_user_id: a.ids.dream }).expect(200)).body;
        expect(assigned.tip.id).toBe(a.ids.dream);
        expect(assigned.bookings[0]).toMatchObject({ id: bk.id });
        expect((await c.prisma.booking.findUniqueOrThrow({ where: { id: bk.id } })).tip_user_id).toBe(BigInt(a.ids.dream));
        await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.dream)).expect(200);                     // now the TIP sees it

        // the TIP only installs; the DSA cannot
        await c.http().post(`${P}/bookings/${bk.id}/complete`).set(bearer(a.dsa1)).send({ connection_id: 'CID-1' }).expect(403);
        await c.http().post(`${P}/bookings/${bk.id}/complete`).set(bearer(a.doulat)).send({ connection_id: 'CID-1' }).expect(404);   // another TIP: out of scope
        const done = await c.http().post(`${P}/bookings/${bk.id}/complete`).set(bearer(a.dream)).send({ connection_id: 'CID-1', router_serial: `SN-${Date.now()}` }).expect(200);
        expect(done.body.commission).toMatchObject({ dsa_user_id: a.ids.dsa1, amount: 300 });           // the DSA is paid
        expect((await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.admin)).expect(200)).body.status).toBe('installed');
        const ev = await c.http().get(`${P}/leads/${l.id}/events`).set(bearer(a.admin)).expect(200);
        expect(ev.body.filter((e: any) => e.event_type === 'assigned').map((e: any) => e.note)).toEqual([`dsa_user_id=${a.ids.dsa1}`, `tip_user_id=${a.ids.dream}`]);
      });
      it('only admin assigns a DSA, and only before the lead is booked', async () => {
        const l = await newLead(c, a, { by: 'web' });                       // auto-assigned to dsa1
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({}).expect(400);
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.dsa1)).send({ dsa_user_id: a.ids.dsa2 }).expect(403);   // a DSA cannot hand a lead over
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.dream)).send({ dsa_user_id: a.ids.dsa2 }).expect(403);
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ dsa_user_id: a.ids.dream }).expect(400);   // a TIP is not a DSA
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ dsa_user_id: a.ids.dsa1 }).expect(200);    // same DSA: nothing to do
        const r = await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ dsa_user_id: a.ids.dsa2 }).expect(200);
        expect(r.body.dsa.id).toBe(a.ids.dsa2);
        await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.dsa1)).expect(404);
        await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.dsa2)).expect(200);
        await c.http().post(`${P}/bookings`).set(bearer(a.dsa2)).send({ lead_id: l.id, scheduled_at: tomorrow() }).expect(201);
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ dsa_user_id: a.ids.dsa1 }).expect(400);    // booked: the DSA is final
      });
      it('a lead nobody serves can be assigned a DSA by admin, who then works it', async () => {
        const l = await newLead(c, a, { by: 'web', noDsa: true });
        expect(l.brought_by_user_id).toBeNull();
        await c.http().post(`${P}/bookings`).set(bearer(a.admin)).send({ lead_id: l.id, scheduled_at: tomorrow() }).expect(400);   // book it only once it has a DSA
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ dsa_user_id: a.ids.dsa2 }).expect(200);
        await c.http().patch(`${P}/leads/${l.id}/status`).set(bearer(a.dsa2)).send({ status: 'contacted' }).expect(200);
      });
      it('the TIP can be changed while the booking is open, and the booking follows; not after installation', async () => {
        const l = await newLead(c, a, { by: 'dsa1' });
        const bk = (await c.http().post(`${P}/bookings`).set(bearer(a.dsa1)).send({ lead_id: l.id, scheduled_at: tomorrow() }).expect(201)).body;
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.dsa1)).send({ tip_user_id: a.ids.dsa2 }).expect(400);            // a DSA is not a TIP
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.dsa1)).send({ tip_user_id: a.ids.dream }).expect(200);
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ tip_user_id: a.ids.doulat }).expect(200);          // reassigned
        expect((await c.prisma.booking.findUniqueOrThrow({ where: { id: bk.id } })).tip_user_id).toBe(BigInt(a.ids.doulat));
        await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.dream)).expect(404);                                                      // the first TIP lost it
        await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.doulat)).expect(200);
        const got = (await c.http().get(`${P}/leads/${l.id}`).set(bearer(a.admin)).expect(200)).body;
        expect(got.dsa.phone).toBeTruthy(); expect(got.tip.phone).toBeTruthy();                                                         // contact details for both partners
        await c.http().post(`${P}/bookings/${bk.id}/complete`).set(bearer(a.doulat)).send({ connection_id: 'CID-2' }).expect(200);
        await c.http().patch(`${P}/leads/${l.id}/assign`).set(bearer(a.admin)).send({ tip_user_id: a.ids.dream }).expect(400);          // installed: locked
      });
      it('the TIP picker: admin and the lead\'s DSA see approved TIPs, those covering the PIN first; nobody else can', async () => {
        const l = await newLead(c, a, { by: 'dsa1' });
        const mine = (await c.http().get(`${P}/leads/${l.id}/tip-options`).set(bearer(a.dsa1)).expect(200)).body;
        const admin = (await c.http().get(`${P}/leads/${l.id}/tip-options`).set(bearer(a.admin)).expect(200)).body;
        expect(admin).toEqual(mine);
        expect(mine.length).toBeGreaterThan(2);
        expect(mine[0].covers_pin).toBe(true);                                         // 452010 is covered, so those come first
        expect(mine.find((t: any) => t.id === a.ids.dream)).toMatchObject({ covers_pin: true });
        expect(mine.every((t: any) => t.phone === undefined)).toBe(true);              // only what is needed to choose
        const firstUncovered = mine.findIndex((t: any) => !t.covers_pin);
        if (firstUncovered >= 0) expect(mine.slice(firstUncovered).every((t: any) => !t.covers_pin)).toBe(true);
        await c.http().get(`${P}/leads/${l.id}/tip-options`).set(bearer(a.dsa2)).expect(404);   // not their lead
        await c.http().get(`${P}/leads/${l.id}/tip-options`).set(bearer(a.dream)).expect(403);
        await c.http().get(`${P}/leads/${l.id}/tip-options`).expect(401);
      });
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
