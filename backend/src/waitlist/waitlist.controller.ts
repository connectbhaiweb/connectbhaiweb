import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Public, Roles } from '../common/decorators';
import { PageQuery, pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { normalizePhone } from '../common/utils/phone';
import { NotificationsService } from '../notifications/notifications.service';

class JoinDto {
  @Type(() => Number) @IsInt() city_id: number;
  @IsString() phone: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
}

@ApiTags('waitlist') @Controller('waitlist')
export class WaitlistController {
  constructor(private prisma: PrismaService, private notify: NotificationsService) {}

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post() @HttpCode(200)
  async join(@Body() d: JoinDto) {
    const phone = normalizePhone(d.phone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');
    const city = await this.prisma.city.findUnique({ where: { id: d.city_id } });
    if (!city || city.status === 'hidden') throw new BadRequestException('City not found');
    if (city.status === 'live') throw new BadRequestException('This city is already live - request a connection instead');
    await this.prisma.waitlist.upsert({ where: { city_id_phone: { city_id: city.id, phone } }, update: { name: d.name }, create: { city_id: city.id, phone, name: d.name } });
    return { joined: true, city: city.name };
  }

  @ApiBearerAuth() @Roles('admin') @Get()
  async list(@Query() q: PageQuery) {
    const [items, total] = await Promise.all([this.prisma.waitlist.findMany({ orderBy: { id: 'desc' }, include: { city: { select: { name: true } } }, ...pageArgs(q) }), this.prisma.waitlist.count()]);
    return paged(items, total, q);
  }

  /** Counts per city (waiting / notified) without sending every row to the dashboard. */
  @ApiBearerAuth() @Roles('admin') @Get('summary')
  async summary() {
    const rows = await this.prisma.waitlist.groupBy({ by: ['city_id'], _count: { _all: true, notified_at: true } });
    return rows.map((r) => ({ city_id: Number(r.city_id), total: r._count._all, notified: r._count.notified_at, waiting: r._count._all - r._count.notified_at }));
  }

  /** When a city goes live: tell everyone on its waitlist. */
  @ApiBearerAuth() @Roles('admin') @Post('notify/:cityId') @HttpCode(200)
  async notifyCity(@Param('cityId', ParseIntPipe) cityId: number) {
    const city = await this.prisma.city.findUniqueOrThrow({ where: { id: cityId } });
    if (city.status !== 'live') throw new BadRequestException('Set the city to live first');
    const rows = await this.prisma.waitlist.findMany({ where: { city_id: cityId, notified_at: null } });
    for (const r of rows) await this.notify.send({ phone: r.phone, template: 'city_live', payload: { city: city.name, name: r.name } });
    await this.prisma.waitlist.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { notified_at: new Date() } });
    return { notified: rows.length };
  }
}
