import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SETTING_DEFS } from './settings.defaults';

function make(rows: Record<string, string> = {}) {
  const store = new Map(Object.entries(rows));
  const prisma: any = { appSetting: {
    findUnique: jest.fn(async ({ where }) => (store.has(where.key) ? { key: where.key, value: store.get(where.key) } : null)),
    findMany: jest.fn(async () => [...store].map(([key, value]) => ({ key, value, updated_at: new Date() }))),
    upsert: jest.fn(async ({ where, update, create }) => { if (store.has(where.key)) { if (update.value !== undefined) store.set(where.key, update.value); } else store.set(where.key, create.value); return { key: where.key }; }),
  } };
  return { svc: new SettingsService(prisma), store, prisma };
}

describe('SettingsService (fees live in the table, not in env)', () => {
  it('has a setting for every fee the app charges or pays', () => {
    expect(Object.keys(SETTING_DEFS)).toEqual(expect.arrayContaining(['tip_onboarding_fee', 'tip_install_fee', 'care_plan_fee_per_lead', 'dsa_payout_per_lead', 'tip_job_earning', 'gst_percent', 'auto_assign', 'lead_target_default']));
  });
  it('reads the value the admin saved', async () => {
    const { svc } = make({ care_plan_fee_per_lead: '249' });
    expect(await svc.getNumber('care_plan_fee_per_lead')).toBe(249);
  });
  it('does not read environment variables at all: a missing row uses the built-in default', async () => {
    process.env.CARE_PLAN_FEE_PER_LEAD = '9999';
    try { expect(await make().svc.getNumber('care_plan_fee_per_lead')).toBe(Number(SETTING_DEFS.care_plan_fee_per_lead.default)); }
    finally { delete process.env.CARE_PLAN_FEE_PER_LEAD; }
  });
  it('a saved change is used straight away and listed as coming from the database', async () => {
    const { svc } = make();
    await svc.set('tip_install_fee', '650', 1);
    expect(await svc.getNumber('tip_install_fee')).toBe(650);
    expect((await svc.list()).find((r) => r.key === 'tip_install_fee')).toMatchObject({ value: '650', from_db: true });
  });
  it('lists every setting, saved or not', async () => {
    expect((await make({ gst_percent: '12' }).svc.list()).map((r) => r.key).sort()).toEqual(Object.keys(SETTING_DEFS).sort());
  });
  it('rejects negative, non-numeric and impossible values', async () => {
    const { svc } = make();
    await expect(svc.set('tip_install_fee', '-5', 1)).rejects.toThrow(BadRequestException);
    await expect(svc.set('tip_install_fee', 'abc', 1)).rejects.toThrow(BadRequestException);
    await expect(svc.set('gst_percent', '150', 1)).rejects.toThrow(/GST/);
    await expect(svc.set('not_a_setting', '1', 1)).rejects.toThrow(/Unknown/);
  });
  it('seeding fills only missing rows and never overwrites what the admin saved', async () => {
    const { svc, store } = make({ gst_percent: '5' });
    await svc.seedDefaults();
    expect(store.get('gst_percent')).toBe('5');
    expect(store.get('tip_onboarding_fee')).toBe(SETTING_DEFS.tip_onboarding_fee.default);
    expect(store.size).toBe(Object.keys(SETTING_DEFS).length);
  });
});
