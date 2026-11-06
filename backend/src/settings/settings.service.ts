import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

/** Setting key -> [env variable, description]. DB value wins; env is the fallback/seed. */
export const SETTING_DEFS: Record<string, [string, string]> = {
  tip_onboarding_fee: ['TIP_ONBOARDING_FEE', 'TIP pays this (before GST) when filling the registration form'],
  tip_install_fee: ['TIP_INSTALL_FEE', 'TIP pays this (before GST) for each installed lead'],
  care_plan_fee_per_lead: ['CARE_PLAN_FEE_PER_LEAD', 'TIP pays this (before GST) per lead to enable Care Plan'],
  dsa_payout_per_lead: ['DSA_PAYOUT_PER_LEAD', 'Paid to DSA only when the lead is installed'],
  gst_percent: ['GST_PERCENT', 'GST on all TIP charges'],
  auto_assign: ['AUTO_ASSIGN', '1/true = assign new leads to a TIP by pincode automatically'],
};

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  private envDefault(key: string): string {
    const def = SETTING_DEFS[key];
    return def ? String(this.cfg.get(def[0]) ?? '0') : '';
  }
  private cache = new Map<string, { v: string; t: number }>();   // settings are read on almost every request; 20s is plenty (writes clear it)
  async get(key: string): Promise<string> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.t < 20_000) return hit.v;
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    const v = row ? row.value : this.envDefault(key);
    this.cache.set(key, { v, t: Date.now() });
    return v;
  }
  async getNumber(key: string): Promise<number> {
    const n = Number(await this.get(key));
    return Number.isFinite(n) ? n : 0;
  }
  async getBool(key: string): Promise<boolean> {
    const v = (await this.get(key)).toLowerCase();
    return v === '1' || v === 'true';
  }
  async list() {
    const rows = await this.prisma.appSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r]));
    return Object.keys(SETTING_DEFS).map((key) => ({
      key,
      value: map.get(key)?.value ?? this.envDefault(key),
      description: SETTING_DEFS[key][1],
      updated_at: map.get(key)?.updated_at ?? null,
      from_db: map.has(key),
    }));
  }
  async set(key: string, value: string, userId: number) {
    if (!SETTING_DEFS[key]) throw new BadRequestException(`Unknown setting: ${key}`);
    if (key !== 'auto_assign') {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new BadRequestException('Value must be a non-negative number');
      if (key === 'gst_percent' && n > 100) throw new BadRequestException('GST cannot exceed 100');
    }
    this.cache.clear();
    return this.prisma.appSetting.upsert({
      where: { key },
      update: { value: String(value), updated_by: userId },
      create: { key, value: String(value), description: SETTING_DEFS[key][1], updated_by: userId },
    });
  }
  /** Writes env defaults for any key missing in the DB (used by the seed). */
  async seedDefaults() {
    for (const key of Object.keys(SETTING_DEFS)) {
      await this.prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value: this.envDefault(key), description: SETTING_DEFS[key][1] } });
    }
  }
}
