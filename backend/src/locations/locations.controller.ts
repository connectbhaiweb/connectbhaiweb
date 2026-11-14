import { Body, ConflictException, Controller, Delete, Get, NotFoundException, ServiceUnavailableException, Param, ParseIntPipe, Patch, Post, Query, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TtlCache } from '../common/utils/ttl-cache';
import { Public, Roles } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ReverseQuery } from './locations.dto';
import { PincodeService } from './pincode.service';
import { BulkAreasDto, CreateAreaDto, CreateCityDto, PINCODE_RE, TipPincodeDto, TipPincodeQuery, TipPincodeUpdateDto, UpdateAreaDto, UpdateCityDto } from './locations.dto';

@ApiTags('locations') @Controller()
export class LocationsController {
  private cache = new TtlCache(process.env.APP_ENV === 'test' ? 0 : 60_000);   // cities and areas barely change
  private geoCache = new TtlCache(process.env.APP_ENV === 'test' ? 0 : 3_600_000, 2000);
  constructor(private prisma: PrismaService, private cfg: ConfigService, private pins: PincodeService) {}

  // ---------- public ----------
  @Public() @Get('cities')
  cities() {
    return this.cache.get('cities', () => this.prisma.city.findMany({ where: { status: { in: ['live', 'soon'] } }, orderBy: [{ status: 'asc' }, { name: 'asc' }] }));
  }

  @Public() @Get('cities/:id/areas')
  async areas(@Param('id', ParseIntPipe) id: number) {
    return this.cache.get('areas:' + id, () => this.prisma.area.findMany({ where: { city_id: id }, orderBy: [{ pincode: 'asc' }, { name: 'asc' }] }));
  }

  /** PIN code lookup for forms (India Post directory + whether we serve it). Cached 24 h. */
  @Public() @Throttle({ default: { limit: 40, ttl: 60_000 } }) @Get('locations/pincode/:pincode')
  lookup(@Param('pincode') pincode: string) { return this.pins.lookup(pincode); }

  /** Several PINs in one call: GET /locations/pincodes?codes=452010,452016 */
  @Public() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @Get('locations/pincodes')
  lookupMany(@Query('codes') codes?: string) { return this.pins.lookupMany((codes ?? '').split(/[,\s]+/)); }

  /** "Use my current location": GPS coordinates -> PIN code (+ area, city) through the configured geocoder. */
  @Public() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @Get('locations/reverse')
  async reverse(@Query() q: ReverseQuery) {
    const url = new URL(this.cfg.getOrThrow<string>('GEOCODER_URL'));
    url.search = new URLSearchParams({ format: 'jsonv2', lat: String(q.lat), lon: String(q.lng), addressdetails: '1', zoom: '18' }).toString();
    let body: any;
    try {
      // the same spot (about 100 m) gives the same answer: keep it for an hour instead of asking the geocoder again
      body = await this.geoCache.get(`${Number(q.lat).toFixed(3)},${Number(q.lng).toFixed(3)}`, async () => {
        const r = await fetch(url, { headers: { 'user-agent': this.cfg.getOrThrow<string>('GEOCODER_USER_AGENT'), 'accept-language': 'en' }, signal: AbortSignal.timeout(Number(this.cfg.get('GEOCODER_TIMEOUT_MS')) || 5000) });
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      });
    } catch {
      throw new ServiceUnavailableException('Could not look up your location right now. Please type your PIN code.');
    }
    const a = body?.address ?? {};
    const pincode = String(a.postcode ?? '').replace(/\s/g, '');
    if (!PINCODE_RE.test(pincode)) throw new NotFoundException('Could not find a PIN code for this location. Please type it.');
    const area = [a.suburb ?? a.neighbourhood ?? a.village ?? a.road].filter(Boolean)[0] ?? null;
    return { pincode, area, city: a.city ?? a.town ?? a.state_district ?? null, state: a.state ?? null, source: 'geocoder' };
  }

  /** Customer enters a PIN: is it serviceable and how many plans are available there? */
  @Public() @Get('pincodes/:pincode')
  async pincode(@Param('pincode') pincode: string) {
    if (!PINCODE_RE.test(pincode)) throw new BadRequestException('Enter a valid 6-digit PIN code');
    const areas = await this.prisma.area.findMany({ where: { pincode }, include: { city: true } });
    const plan_count = await this.prisma.pincodePlanMapping.count({ where: { pincode, is_available: true, plan: { is_active: true } } });
    const city = areas[0]?.city ?? null;
    return {
      pincode,
      serviceable: areas.length > 0 && city?.status === 'live',
      city: city ? { id: city.id, name: city.name, status: city.status } : null,
      areas: areas.map((a) => ({ id: a.id, name: a.name })),
      plan_count,
    };
  }

  // ---------- admin: cities / areas ----------
  @ApiBearerAuth() @Roles('admin') @Post('cities')
  createCity(@Body() d: CreateCityDto) { this.cache.clear(); return this.prisma.city.create({ data: { name: d.name.trim(), status: d.status ?? 'soon' } }); }

  @ApiBearerAuth() @Roles('admin') @Patch('cities/:id')
  updateCity(@Param('id', ParseIntPipe) id: number, @Body() d: UpdateCityDto) { this.cache.clear(); return this.prisma.city.update({ where: { id }, data: d }); }

  @ApiBearerAuth() @Roles('admin') @Post('cities/:id/areas')
  async createArea(@Param('id', ParseIntPipe) id: number, @Body() d: CreateAreaDto) { this.cache.clear();
    if (!(await this.prisma.city.findUnique({ where: { id } }))) throw new NotFoundException('City not found');
    return this.prisma.area.create({ data: { city_id: id, name: d.name.trim(), pincode: d.pincode } });
  }

  /** Admin: add many PIN / area rows at once (from a sheet). Rows that already exist are skipped, not an error. */
  @ApiBearerAuth() @Roles('admin') @Post('cities/:id/areas/bulk')
  async createAreas(@Param('id', ParseIntPipe) id: number, @Body() d: BulkAreasDto) {
    if (!(await this.prisma.city.findUnique({ where: { id } }))) throw new NotFoundException('City not found');
    const data = d.areas.map((a) => ({ city_id: id, name: a.name.trim(), pincode: a.pincode })).filter((a) => a.name.length >= 2);
    const r = await this.prisma.area.createMany({ data, skipDuplicates: true });
    this.cache.clear();
    return { added: r.count, skipped: d.areas.length - r.count };
  }

  /** Admin: rename an area. Leads link to the area by id, so every place that shows a lead's area picks up the new name. */
  @ApiBearerAuth() @Roles('admin') @Patch('areas/:id')
  async updateArea(@Param('id', ParseIntPipe) id: number, @Body() d: UpdateAreaDto) {
    const area = await this.prisma.area.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Area not found');
    const name = d.name.trim();
    if (name.length < 2) throw new BadRequestException('Enter the area name');
    const clash = await this.prisma.area.findFirst({ where: { city_id: area.city_id, pincode: area.pincode, name, NOT: { id } } });
    if (clash) throw new ConflictException('This PIN code already has an area with that name');
    this.cache.clear();
    return this.prisma.area.update({ where: { id }, data: { name } });
  }

  @ApiBearerAuth() @Roles('admin') @Delete('areas/:id')
  async deleteArea(@Param('id', ParseIntPipe) id: number) { this.cache.clear(); await this.prisma.area.delete({ where: { id } }); return { ok: true }; }

  // ---------- admin: which TIP serves which PIN ----------
  @ApiBearerAuth() @Roles('admin') @Get('admin/tip-pincodes')
  tipPincodes(@Query() q: TipPincodeQuery) {
    return this.prisma.tipPincodeMapping.findMany({
      where: { pincode: q.pincode, tip_user_id: q.tip_user_id },
      include: { tip: { select: { id: true, name: true, partner_code: true, is_internal: true } } },
      orderBy: [{ pincode: 'asc' }, { id: 'asc' }], take: 1000,
    });
  }

  @ApiBearerAuth() @Roles('admin') @Post('admin/tip-pincodes')
  async addTipPincode(@Body() d: TipPincodeDto) { this.cache.clear();
    const tip = await this.prisma.user.findFirst({ where: { id: d.tip_user_id, role: 'tip' } });
    if (!tip) throw new BadRequestException('tip_user_id is not a TIP');
    return this.prisma.tipPincodeMapping.upsert({
      where: { pincode_tip_user_id: { pincode: d.pincode, tip_user_id: d.tip_user_id } },
      update: { is_active: true }, create: { pincode: d.pincode, tip_user_id: d.tip_user_id },
    });
  }

  @ApiBearerAuth() @Roles('admin') @Patch('admin/tip-pincodes/:id')
  setTipPincodeActive(@Param('id', ParseIntPipe) id: number, @Body() d: TipPincodeUpdateDto) { this.cache.clear();
    return this.prisma.tipPincodeMapping.update({ where: { id }, data: { is_active: d.is_active } });
  }

  @ApiBearerAuth() @Roles('admin') @Delete('admin/tip-pincodes/:id')
  async removeTipPincode(@Param('id', ParseIntPipe) id: number) { this.cache.clear(); await this.prisma.tipPincodeMapping.delete({ where: { id } }); return { ok: true }; }
}
