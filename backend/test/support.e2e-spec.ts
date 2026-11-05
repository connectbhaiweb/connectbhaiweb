import { actors, bearer, createCtx, Ctx, makeCustomer, newLead, P } from './helpers';

describe('tickets & chat', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());

  async function leadWithCustomer() {
    const l = await newLead(c, a, { by: 'dsa1', tip: 'dream' });
    const cust = await c.prisma.user.create({ data: { role: 'customer', name: 'Tk Customer', phone: l.customer_phone } });
    await c.prisma.lead.update({ where: { id: l.id }, data: { customer_user_id: cust.id } });
    const token = await c.jwt.signAsync({ sub: Number(cust.id), role: 'customer', phone: cust.phone, typ: 'access' }, { secret: process.env.JWT_SECRET, expiresIn: '10m' });
    return { lead: l, token, id: Number(cust.id) };
  }

  describe('tickets', () => {
    it('customer raises a ticket on their lead: code, auto-assigned to the lead\'s TIP', async () => {
      const { lead, token } = await leadWithCustomer();
      const t = await c.http().post(`${P}/tickets`).set(bearer(token)).send({ lead_id: lead.id, category: 'no_internet', subject: 'Internet down since morning', priority: 'high' }).expect(201);
      expect(t.body.ticket_code).toBe(`TK-${String(t.body.id).padStart(6, '0')}`);
      expect(t.body).toMatchObject({ status: 'open', assigned_to: a.ids.dream, priority: 'high', category: 'no_internet' });
    });
    it('cannot raise a ticket on someone else\'s lead; validates input', async () => {
      const { token } = await leadWithCustomer();
      const other = await newLead(c, a, { tip: 'dream' });
      await c.http().post(`${P}/tickets`).set(bearer(token)).send({ lead_id: other.id, subject: 'hello there' }).expect(400);
      await c.http().post(`${P}/tickets`).set(bearer(token)).send({ subject: 'x' }).expect(400);
      await c.http().post(`${P}/tickets`).set(bearer(token)).send({ subject: 'valid subject', category: 'weird' }).expect(400);
      await c.http().post(`${P}/tickets`).send({ subject: 'valid subject' }).expect(401);
    });
    it('visibility: raiser, assigned TIP and admin see it; other TIP / customer do not', async () => {
      const { lead, token } = await leadWithCustomer();
      const t = (await c.http().post(`${P}/tickets`).set(bearer(token)).send({ lead_id: lead.id, subject: 'Slow speed at night' }).expect(201)).body;
      const ids = async (tok: string) => (await c.http().get(`${P}/tickets?limit=200`).set(bearer(tok)).expect(200)).body.items.map((x: any) => x.id);
      expect(await ids(token)).toEqual([t.id]);
      expect(await ids(a.dream)).toContain(t.id);
      expect(await ids(a.admin)).toContain(t.id);
      expect(await ids(a.doulat)).not.toContain(t.id);
      const stranger = await makeCustomer(c);
      expect(await ids(stranger.token)).toEqual([]);
      await c.http().get(`${P}/tickets/${t.id}`).set(bearer(stranger.token)).expect(404);
      await c.http().get(`${P}/tickets/${t.id}`).set(bearer(a.doulat)).expect(404);
      await c.http().get(`${P}/tickets/${t.id}`).set(bearer(a.dream)).expect(200);
    });
    it('TIP progresses a ticket; customer may only close their own; only admin reassigns', async () => {
      const { lead, token } = await leadWithCustomer();
      const t = (await c.http().post(`${P}/tickets`).set(bearer(token)).send({ lead_id: lead.id, subject: 'Router rebooting' }).expect(201)).body;
      expect((await c.http().patch(`${P}/tickets/${t.id}`).set(bearer(a.dream)).send({ status: 'in_progress' }).expect(200)).body.status).toBe('in_progress');
      const resolved = await c.http().patch(`${P}/tickets/${t.id}`).set(bearer(a.dream)).send({ status: 'resolved' }).expect(200);
      expect(resolved.body.resolved_at).toBeTruthy();
      expect((await c.http().patch(`${P}/tickets/${t.id}`).set(bearer(a.dream)).send({ status: 'open' }).expect(200)).body.resolved_at).toBeNull(); // reopened
      await c.http().patch(`${P}/tickets/${t.id}`).set(bearer(token)).send({ status: 'in_progress' }).expect(403);
      await c.http().patch(`${P}/tickets/${t.id}`).set(bearer(token)).send({ priority: 'low' }).expect(403);
      await c.http().patch(`${P}/tickets/${t.id}`).set(bearer(a.dream)).send({ assigned_to: a.ids.doulat }).expect(403);
      await c.http().patch(`${P}/tickets/${t.id}`).set(bearer(a.admin)).send({ assigned_to: a.ids.doulat }).expect(200);
      await c.http().patch(`${P}/tickets/${t.id}`).set(bearer(token)).send({ status: 'closed' }).expect(200);
      await c.http().patch(`${P}/tickets/${t.id}`).set(bearer(a.doulat)).send({ status: 'closed' }).expect(200); // the newly assigned TIP can act
      const stranger = await makeCustomer(c);
      await c.http().patch(`${P}/tickets/${t.id}`).set(bearer(stranger.token)).send({ status: 'closed' }).expect(404);
    });
    it('filters by status', async () => {
      const r = await c.http().get(`${P}/tickets?status=closed`).set(bearer(a.admin)).expect(200);
      expect(r.body.items.every((x: any) => x.status === 'closed')).toBe(true);
      await c.http().get(`${P}/tickets?status=zzz`).set(bearer(a.admin)).expect(400);
    });
  });

  describe('chat', () => {
    it('lead thread: customer, DSA, TIP and admin can talk; outsiders are blocked', async () => {
      const { lead, token } = await leadWithCustomer();
      const send = (tok: string, body: string) => c.http().post(`${P}/chat/lead/${lead.id}/messages`).set(bearer(tok)).send({ body });
      await send(token, 'When will you come?').expect(201);
      await send(a.dream, 'Tomorrow 11am').expect(201);
      await send(a.dsa1, 'FYI customer is keen').expect(201);
      await send(a.admin, 'Noted').expect(201);
      const msgs = await c.http().get(`${P}/chat/lead/${lead.id}/messages`).set(bearer(a.dsa1)).expect(200);
      expect(msgs.body.map((m: any) => m.body)).toEqual(['When will you come?', 'Tomorrow 11am', 'FYI customer is keen', 'Noted']);
      expect(msgs.body[0].sender).toMatchObject({ role: 'customer' });
      const stranger = await makeCustomer(c);
      for (const tok of [stranger.token, a.doulat, a.dsa2]) {
        await c.http().get(`${P}/chat/lead/${lead.id}/messages`).set(bearer(tok)).expect(403);
        await send(tok, 'hi').expect(403);
      }
      await c.http().get(`${P}/chat/lead/${lead.id}/messages`).expect(401);
    });
    it('rejects empty messages and bad thread types / ids', async () => {
      const { lead, token } = await leadWithCustomer();
      await c.http().post(`${P}/chat/lead/${lead.id}/messages`).set(bearer(token)).send({ body: '   ' }).expect(404);
      await c.http().get(`${P}/chat/galaxy/1/messages`).set(bearer(token)).expect(400);
      await c.http().get(`${P}/chat/lead/abc/messages`).set(bearer(token)).expect(400);
      await c.http().post(`${P}/chat/lead/${lead.id}/messages`).set(bearer(token)).send({ body: 'x'.repeat(5000) }).expect(400);
    });
    it('polling with ?after returns only newer messages', async () => {
      const { lead, token } = await leadWithCustomer();
      const first = (await c.http().post(`${P}/chat/lead/${lead.id}/messages`).set(bearer(token)).send({ body: 'one' }).expect(201)).body;
      await c.http().post(`${P}/chat/lead/${lead.id}/messages`).set(bearer(a.dream)).send({ body: 'two' }).expect(201);
      const r = await c.http().get(`${P}/chat/lead/${lead.id}/messages?after=${first.id}`).set(bearer(token)).expect(200);
      expect(r.body.map((m: any) => m.body)).toEqual(['two']);
    });
    it('unread counts and mark-as-read', async () => {
      const { lead, token } = await leadWithCustomer();
      await c.http().post(`${P}/chat/lead/${lead.id}/messages`).set(bearer(a.dream)).send({ body: 'm1' }).expect(201);
      await c.http().post(`${P}/chat/lead/${lead.id}/messages`).set(bearer(a.dream)).send({ body: 'm2' }).expect(201);
      expect((await c.http().get(`${P}/chat/lead/${lead.id}/unread`).set(bearer(token)).expect(200)).body.unread).toBe(2);
      expect((await c.http().get(`${P}/chat/lead/${lead.id}/unread`).set(bearer(a.dream)).expect(200)).body.unread).toBe(0); // own messages don't count
      await c.http().post(`${P}/chat/lead/${lead.id}/read`).set(bearer(token)).expect(200);
      expect((await c.http().get(`${P}/chat/lead/${lead.id}/unread`).set(bearer(token)).expect(200)).body.unread).toBe(0);
      await c.http().post(`${P}/chat/lead/${lead.id}/messages`).set(bearer(a.dream)).send({ body: 'm3' }).expect(201);
      expect((await c.http().get(`${P}/chat/lead/${lead.id}/unread`).set(bearer(token)).expect(200)).body.unread).toBe(1);
    });
    it('support thread: each user talks to admin privately', async () => {
      const u1 = await makeCustomer(c); const u2 = await makeCustomer(c);
      await c.http().post(`${P}/chat/support/${u1.user.id}/messages`).set(bearer(u1.token)).send({ body: 'Need help with billing' }).expect(201);
      await c.http().post(`${P}/chat/support/${u1.user.id}/messages`).set(bearer(a.admin)).send({ body: 'Sure, tell me more' }).expect(201);
      expect((await c.http().get(`${P}/chat/support/${u1.user.id}/messages`).set(bearer(u1.token)).expect(200)).body).toHaveLength(2);
      await c.http().get(`${P}/chat/support/${u1.user.id}/messages`).set(bearer(u2.token)).expect(403);
      await c.http().get(`${P}/chat/support/${u1.user.id}/messages`).set(bearer(a.dream)).expect(403);
    });
    it('ticket thread follows ticket visibility', async () => {
      const { lead, token } = await leadWithCustomer();
      const t = (await c.http().post(`${P}/tickets`).set(bearer(token)).send({ lead_id: lead.id, subject: 'Need a visit please' }).expect(201)).body;
      await c.http().post(`${P}/chat/ticket/${t.id}/messages`).set(bearer(a.dream)).send({ body: 'On my way' }).expect(201);
      expect((await c.http().get(`${P}/chat/ticket/${t.id}/messages`).set(bearer(token)).expect(200)).body).toHaveLength(1);
      await c.http().get(`${P}/chat/ticket/${t.id}/messages`).set(bearer(a.doulat)).expect(403);
    });
  });
});
