import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SETTING_DEFS } from './settings.defaults';

export { SETTING_DEFS };

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private defaultOf(key: string): string { return SETTING_DEFS[key]?.default ?? ''; }   // used only until the admin saves a value
  private cache = new Map<string, { v: string; t: number }>();   // settings are read on almost every request; 20s is plenty (writes clear it)
  async get(key: string): Promise<string> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.t < 20_000) return hit.v;
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    const v = row ? row.value : this.defaultOf(key);
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
      value: map.get(key)?.value ?? this.defaultOf(key),
      description: SETTING_DEFS[key].description,
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
      create: { key, value: String(value), description: SETTING_DEFS[key].description, updated_by: userId },
    });
  }
  /** Writes the default for any key missing in the DB (used by the seed). Never overwrites a value the admin saved. */
  async seedDefaults() {
    for (const key of Object.keys(SETTING_DEFS)) {
      await this.prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value: this.defaultOf(key), description: SETTING_DEFS[key].description } });
    }
  }
}
