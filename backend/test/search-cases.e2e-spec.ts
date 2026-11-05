import cases from './fixtures/search-cases.json';
import { createCtx, Ctx, P } from './helpers';

/**
 * The 12 search test cases from ConnectBhai_Indore_Sample_Plans.xlsx (sheet "Search_Test_Cases").
 * Budgets are BEFORE GST (as in the sheet). Results cover the sheet's plans: fibre + Air Fiber; "wired_only" means fibre only.
 */
describe('plan search: test cases from the plan sheet', () => {
  let c: Ctx;
  beforeAll(async () => { c = await createCtx(); });
  afterAll(() => c.app.close());

  const search = async (pincode: string, query: string, wiredOnly: boolean) => {
    const out: any[] = [];
    for (const type of wiredOnly ? ['fiber'] : ['fiber', 'airfiber']) {
      const r = await c.http().get(`${P}/plans?pincode=${pincode}&type=${type}&limit=100&${query.replace('&wired_only=1', '')}`).expect(200);
      out.push(...r.body.items);
    }
    return out.sort((a, b) => a.price - b.price || a.plan_code.localeCompare(b.plan_code));
  };

  for (const t of cases as any[]) {
    it(`${t.id} ${t.pincode}: ${t.need} -> ${t.expected_count} plan(s)`, async () => {
      const got = await search(t.pincode, t.query, t.query.includes('wired_only'));
      expect(got.map((p) => p.plan_code).sort()).toEqual([...t.expected_plan_codes].sort());
      expect(got).toHaveLength(t.expected_count);
      if (t.expected_count) {   // cheapest first (plans with the same price may come in any order)
        const sheetFirst = got.find((p) => p.plan_code === t.expected_plan_codes[0]);
        expect(got[0].price).toBe(sheetFirst.price);
      }
    });
  }

  it('price_ex_gst is returned and consistent with the stored GST-inclusive price', async () => {
    const r = await c.http().get(`${P}/plans/BSNL-01`).expect(200);
    expect(r.body.price).toBe(471);
    expect(r.body.price_ex_gst).toBe(399);
  });
  it('an unknown / non-Indore PIN returns no plans, a bad PIN is rejected', async () => {
    expect((await c.http().get(`${P}/plans?pincode=999999`).expect(200)).body.total).toBe(0);
    await c.http().get(`${P}/plans?pincode=12`).expect(400);
  });
});
