import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { TtlCache } from '../common/utils/ttl-cache';
import { Public, Roles } from '../common/decorators';
import { pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CategoryDto, CreatePlanDto, OttDto, PlanQuery, SetPincodePlansDto, SetPlanOttDto, UpdatePlanDto } from './catalogue.dto';

const planInclude = { category: true, otts: { include: { ott: true } } } satisfies Prisma.PlanInclude;
/** `price` is stored GST-inclusive (what the customer pays); price_ex_gst is derived, and is what budget filters compare against. */
const shapePlan = (p: any, gstPct = 18) => {
  const { otts, ...rest } = p;
  return { ...rest, price_ex_gst: Math.round((Number(p.price) * 100) / (100 + gstPct)), ott_apps: (otts ?? []).map((o: any) => ({ id: o.ott.id, name: o.ott.name, logo_url: o.ott.logo_url })) };
};

@ApiTags('catalogue') @Controller()
export class CatalogueController {
  /** Public catalogue reads are the same for every visitor: kept 60 s, and dropped as soon as an admin edits anything here. */
  private cache = new TtlCache(process.env.APP_ENV === 'test' ? 0 : 60_000);
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  // ---------- public ----------
  @Public() @Get('plan-categories')
  categories() { return this.cache.get('cats', () => this.prisma.planCategory.findMany({ where: { is_active: true }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] })); }

  @Public() @Get('ott-apps')
  ottApps() { return this.cache.get('otts', () => this.prisma.ottApp.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } })); }

  /** Plans, optionally for one PIN code (uses the pincode -> plan mapping). Cheapest first by default. */
  @Public() @Get('plans')
  plans(@Query() q: PlanQuery) {
    if (q.include_inactive) return this.loadPlans(q);   // admin view: always fresh
    return this.cache.get('plans:' + JSON.stringify(q), () => this.loadPlans(q));
  }
  private async loadPlans(q: PlanQuery) {
    const where: Prisma.PlanWhereInput = { is_active: q.include_inactive ? undefined : true, AND: [] };
    const and = where.AND as Prisma.PlanWhereInput[];
    if (q.pincode) and.push({ pincodes: { some: { pincode: q.pincode, is_available: true } } });
    if (q.type) and.push({ category: { type: q.type } });
    if (q.category_id) and.push({ category_id: q.category_id });
    if (q.brand) and.push({ category: { name: q.brand } });
    const gst = await this.settings.getNumber('gst_percent');
    const incl = (ex?: number) => (ex == null ? undefined : Math.round((ex * (100 + gst)) / 100));   // min_price / max_price are BEFORE GST
    if (q.min_price != null || q.max_price != null) and.push({ price: { gte: incl(q.min_price), lte: incl(q.max_price) } });
    if (q.min_speed) and.push({ speed_mbps: { gte: q.min_speed } });
    if (q.ott) and.push({ otts: { some: { ott: { name: { contains: q.ott } } } } });
    if (q.q) and.push({ OR: [{ name: { contains: q.q } }, { plan_code: { contains: q.q } }] });
    const orderBy: Prisma.PlanOrderByWithRelationInput[] =
      q.sort === 'price_desc' ? [{ price: 'desc' }] : q.sort === 'speed_desc' ? [{ speed_mbps: 'desc' }, { price: 'asc' }] : [{ price: 'asc' }, { id: 'asc' }];
    const [items, total] = await Promise.all([
      this.prisma.plan.findMany({ where, orderBy, include: planInclude, ...pageArgs(q) }),
      this.prisma.plan.count({ where }),
    ]);
    return paged(items.map((x) => shapePlan(x, gst)), total, q);
  }

  @Public() @Get('plans/:code')
  async plan(@Param('code') code: string) {
    const p = await this.prisma.plan.findUnique({ where: { plan_code: code }, include: planInclude });
    if (!p) throw new NotFoundException('Plan not found');
    return shapePlan(p);
  }

  // ---------- admin ----------
  @ApiBearerAuth() @Roles('admin') @Post('plan-categories')
  createCategory(@Body() d: CategoryDto) { this.cache.clear(); return this.prisma.planCategory.create({ data: d }); }

  @ApiBearerAuth() @Roles('admin') @Patch('plan-categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() d: CategoryDto) { this.cache.clear(); return this.prisma.planCategory.update({ where: { id }, data: d }); }

  @ApiBearerAuth() @Roles('admin') @Post('ott-apps')
  createOtt(@Body() d: OttDto) { this.cache.clear(); return this.prisma.ottApp.create({ data: d }); }

  @ApiBearerAuth() @Roles('admin') @Patch('ott-apps/:id')
  updateOtt(@Param('id', ParseIntPipe) id: number, @Body() d: OttDto) { this.cache.clear(); return this.prisma.ottApp.update({ where: { id }, data: d }); }

  @ApiBearerAuth() @Roles('admin') @Post('plans')
  async createPlan(@Body() d: CreatePlanDto) { this.cache.clear();
    const { benefits, ...rest } = d;
    return shapePlan(await this.prisma.plan.create({ data: { ...rest, benefits: benefits as Prisma.InputJsonValue | undefined }, include: planInclude }));
  }

  @ApiBearerAuth() @Roles('admin') @Patch('plans/:id')
  async updatePlan(@Param('id', ParseIntPipe) id: number, @Body() d: UpdatePlanDto) { this.cache.clear();
    const { benefits, ...rest } = d;
    return shapePlan(await this.prisma.plan.update({ where: { id }, data: { ...rest, benefits: benefits as Prisma.InputJsonValue | undefined }, include: planInclude }));
  }

  @ApiBearerAuth() @Roles('admin') @Put('plans/:id/ott-apps')
  async setPlanOtts(@Param('id', ParseIntPipe) id: number, @Body() d: SetPlanOttDto) { this.cache.clear();
    await this.prisma.$transaction([
      this.prisma.planOttApp.deleteMany({ where: { plan_id: id } }),
      this.prisma.planOttApp.createMany({ data: d.ott_app_ids.map((ott_app_id) => ({ plan_id: id, ott_app_id })) }),
    ]);
    return shapePlan(await this.prisma.plan.findUniqueOrThrow({ where: { id }, include: planInclude }));
  }

  /** Replace the list of plans sold in one PIN code. */
  @ApiBearerAuth() @Roles('admin') @Put('pincodes/:pincode/plans')
  async setPincodePlans(@Param('pincode') pincode: string, @Body() d: SetPincodePlansDto) { this.cache.clear();
    if (!/^[1-9]\d{5}$/.test(pincode)) throw new BadRequestException('Invalid PIN code');
    const found = await this.prisma.plan.count({ where: { id: { in: d.plan_ids } } });
    if (found !== d.plan_ids.length) throw new BadRequestException('One or more plan_ids do not exist');
    await this.prisma.$transaction([
      this.prisma.pincodePlanMapping.deleteMany({ where: { pincode } }),
      this.prisma.pincodePlanMapping.createMany({ data: d.plan_ids.map((plan_id) => ({ pincode, plan_id })) }),
    ]);
    return { pincode, plan_count: d.plan_ids.length };
  }
}
