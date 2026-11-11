import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { PINCODE_RE } from './locations.dto';

export interface PinInfo {
  pincode: string; valid: boolean; state: string | null; district: string | null; city: string | null;
  areas: string[]; serviceable: boolean; source: 'india_post' | 'local';
}
type Post = { state: string; district: string; areas: string[] } | null;

/**
 * PIN code directory. India Post (api.postalpincode.in, configurable with PINCODE_API_URL) is the source of truth for "does this PIN
 * exist in India, and what are its post offices"; our own tables say whether we serve it. Results are cached for 24 h
 * (negative results too), and if India Post is down we fall back to our own areas.
 */
@Injectable()
export class PincodeService {
  private cache = new Map<string, { value: Post; until: number }>();
  private down = 0;   // until when India Post is treated as unreachable
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  /** @internal for tests */
  clearCache() { this.cache.clear(); this.down = 0; }

  private async fromIndiaPost(pin: string): Promise<Post | undefined> {
    const hit = this.cache.get(pin);
    if (hit && hit.until > Date.now()) return hit.value;
    if (this.down > Date.now()) return undefined;
    try {
      const base = this.cfg.getOrThrow<string>('PINCODE_API_URL').replace(/\/$/, '');
      const r = await fetch(`${base}/${pin}`, { headers: { 'user-agent': this.cfg.getOrThrow<string>('GEOCODER_USER_AGENT') }, signal: AbortSignal.timeout(Number(this.cfg.get('GEOCODER_TIMEOUT_MS')) || 5000) });
      if (!r.ok) throw new Error(String(r.status));
      const body: any = await r.json();
      const offices: any[] = body?.[0]?.Status === 'Success' ? body[0].PostOffice ?? [] : [];
      const value: Post = offices.length ? { state: offices[0].State, district: offices[0].District, areas: [...new Set<string>(offices.map((o) => String(o.Name).trim()))] } : null;
      if (this.cache.size > 5000) this.cache.clear();
      this.cache.set(pin, { value, until: Date.now() + 24 * 3_600_000 });
      return value;
    } catch {
      this.down = Date.now() + 60_000;   // India Post unreachable: skip it for a minute so requests do not each wait for the timeout
      return undefined;   // caller falls back to local data
    }
  }

  async lookup(pincode: string): Promise<PinInfo> {
    if (!PINCODE_RE.test(pincode)) throw new BadRequestException('Enter a valid 6-digit PIN code');
    const [post, ours] = await Promise.all([   // independent: run side by side
      this.fromIndiaPost(pincode),
      this.prisma.area.findMany({ where: { pincode }, include: { city: true }, take: 50 }),
    ]);
    if (post === undefined && !ours.length) throw new ServiceUnavailableException('PIN lookup is unavailable right now. You can still type the area yourself.');
    return {
      pincode,
      valid: post ? true : post === null ? false : ours.length > 0,
      state: post?.state ?? (ours.length ? 'Madhya Pradesh' : null),
      district: post?.district ?? ours[0]?.city?.name ?? null,
      city: ours[0]?.city?.name ?? post?.district ?? null,
      areas: post?.areas ?? ours.map((a) => a.name.split(',')[0]),
      serviceable: ours.length > 0 && ours[0].city?.status === 'live',
      source: post ? 'india_post' : 'local',
    };
  }

  /** Several PINs at once ("452010, 452016, 453001"). Duplicates are collapsed; malformed ones are reported, not thrown. */
  async lookupMany(raw: string[]) {
    const pins = [...new Set(raw.map((p) => p.trim()).filter(Boolean))];
    if (!pins.length) throw new BadRequestException('Enter at least one PIN code');
    if (pins.length > 10) throw new BadRequestException('At most 10 PIN codes at a time');
    return Promise.all(pins.map(async (p) => {
      if (!PINCODE_RE.test(p)) return { pincode: p, valid: false, error: 'Not a 6-digit PIN code', areas: [], state: null, district: null, city: null, serviceable: false, source: 'local' as const };
      try { return await this.lookup(p); } catch { return { pincode: p, valid: false, error: 'Lookup unavailable', areas: [], state: null, district: null, city: null, serviceable: false, source: 'local' as const }; }
    }));
  }
}
