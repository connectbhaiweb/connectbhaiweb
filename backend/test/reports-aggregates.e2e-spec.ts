import { actors, bearer, createCtx, Ctx, P } from './helpers';

describe('dashboard aggregates and paging params', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());
  const get = (path: string, who: string = 'admin') => c.http().get(`${P}${path}`).set(bearer((a as any)[who]));

  describe('GET /reports/payables', () => {
    it('is admin only', async () => {
      for (const who of ['dsa1', 'dream']) expect((await get('/reports/payables', who)).status).toBe(403);
      expect((await c.http().get(`${P}/reports/payables`)).status).toBe(401);
    });
    it('groups approved commissions per DSA and matches the database', async () => {
      const r = await get('/reports/payables').expect(200);
      const db = await c.prisma.commission.aggregate({ where: { status: 'approved' }, _sum: { amount: true }, _count: { _all: true } });
      expect(r.body.reduce((n: number, x: any) => n + x.total, 0)).toBeCloseTo(Number(db._sum.amount ?? 0), 2);
      expect(r.body.reduce((n: number, x: any) => n + x.count, 0)).toBe(db._count._all);
      for (const x of r.body) { expect(x.ids).toHaveLength(x.count); expect(typeof x.name).toBe('string'); }
    });
  });

  describe('GET /reports/money', () => {
    it('is admin only', async () => {
      for (const who of ['dsa1', 'dream']) expect((await get('/reports/money', who)).status).toBe(403);
    });
    it('rejects months outside 1..24', async () => {
      for (const q of ['months=0', 'months=25', 'months=x']) expect((await get(`/reports/money?${q}`)).status).toBe(400);
    });
    it('due and per-kind totals match the database', async () => {
      const r = await get('/reports/money?months=24').expect(200);
      const due = await c.prisma.charge.aggregate({ where: { status: { in: ['pending', 'failed'] } }, _sum: { total_amount: true } });
      expect(r.body.due).toBeCloseTo(Number(due._sum.total_amount ?? 0), 2);
      const paid = await c.prisma.charge.aggregate({ where: { status: 'paid' }, _sum: { total_amount: true } });
      expect(Object.values<number>(r.body.by_kind).reduce((n, v) => n + v, 0)).toBeCloseTo(Number(paid._sum.total_amount ?? 0), 2);
      for (const k of Object.keys(r.body.collected)) expect(k).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('monthly buckets use IST', () => {
    it('this month\'s lead count equals leads created since IST midnight on the 1st', async () => {
      const ist = new Date(Date.now() + 330 * 60_000);
      const key = ist.getUTCFullYear() + '-' + String(ist.getUTCMonth() + 1).padStart(2, '0');
      const start = new Date(Date.parse(key + '-01T00:00:00.000Z') - 330 * 60_000);
      // a lead at 00:10 IST on the 1st (= previous day in UTC) must count in this month
      const edge = await c.prisma.lead.findFirst({ orderBy: { id: 'desc' } });
      if (edge) await c.prisma.lead.update({ where: { id: edge.id }, data: { created_at: new Date(start.getTime() + 10 * 60_000) } });
      const r = await get('/reports/dashboard?months=1').expect(200);
      const row = r.body.by_month.find((m: any) => m.month === key);
      expect(row.leads).toBe(await c.prisma.lead.count({ where: { created_at: { gte: start } } }));
    });
  });

  describe('leads query params', () => {
    it('unassigned=1 returns only leads with no DSA and no TIP', async () => {
      const r = await get('/leads?unassigned=1&limit=200').expect(200);
      for (const l of r.body.items) { expect(l.brought_by_user_id ?? null).toBeNull(); expect(l.tip_user_id ?? null).toBeNull(); }
      expect((await get('/leads?unassigned=maybe')).status).toBe(400);
    });
    it('sort=followup orders by follow-up date, earliest first', async () => {
      const r = await get('/leads?sort=followup&limit=200').expect(200);
      const d = r.body.items.map((l: any) => l.followup_at).filter(Boolean).map((x: string) => +new Date(x));
      expect([...d].sort((x, y) => x - y)).toEqual(d);
    });
    it('page totals add up across statuses', async () => {
      const all = (await get('/leads?limit=1').expect(200)).body.total;
      const sts = await c.prisma.lead.groupBy({ by: ['status'], _count: { _all: true } });
      expect(sts.reduce((n, s) => n + s._count._all, 0)).toBe(all);
      for (const s of sts) expect((await get(`/leads?status=${s.status}&limit=1`).expect(200)).body.total).toBe(s._count._all);
    });
  });

  describe('GET /reports/dashboard', () => {
    it('is scoped: a DSA sees only their leads, admin sees all', async () => {
      const adm = (await get('/reports/dashboard').expect(200)).body, dsa = (await get('/reports/dashboard', 'dsa1').expect(200)).body;
      expect(adm.leads_total).toBe(await c.prisma.lead.count());
      expect(dsa.leads_total).toBeLessThanOrEqual(adm.leads_total);
    });
  });

  describe('care plan summary and modem filter', () => {
    it('summary is scoped and consistent; DSA gets 403', async () => {
      expect((await get('/care-plan/summary', 'dsa1')).status).toBe(403);
      const adm = (await get('/care-plan/summary').expect(200)).body;
      expect(adm.installed).toBe(await c.prisma.booking.count({ where: { status: 'completed' } }));
      expect(adm.unlinked).toBe(adm.installed - adm.linked);
      expect(adm.zones.reduce((n: number, z: any) => n + z.n, 0)).toBeLessThanOrEqual(adm.installed);
      const tip = (await get('/care-plan/summary', 'dream').expect(200)).body;
      expect(tip.installed).toBeLessThanOrEqual(adm.installed);
    });
    it('bookings device=offline|weak|unlinked narrows the list and rejects other values', async () => {
      const adm = (await get('/care-plan/summary').expect(200)).body;
      for (const d of ['offline', 'weak', 'unlinked']) {
        const r = await get(`/bookings?status=completed&device=${d}&limit=1`).expect(200);
        expect(r.body.total).toBe(d === 'unlinked' ? adm.unlinked : (adm as any)[d === 'offline' ? 'offline' : 'weak']);
      }
      expect((await get('/bookings?device=bogus')).status).toBe(400);
    });
  });
});
