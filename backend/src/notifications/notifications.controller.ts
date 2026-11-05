import { Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { PageQuery, pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('notifications') @ApiBearerAuth() @Controller('notifications')
export class NotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get('me') async mine(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    const where = { user_id: u.id };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { id: 'desc' }, ...pageArgs(q) }),
      this.prisma.notification.count({ where }),
    ]);
    return { ...paged(items, total, q), unread: await this.prisma.notification.count({ where: { ...where, read_at: null } }) };
  }
  @Patch(':id/read') async read(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    await this.prisma.notification.updateMany({ where: { id, user_id: u.id, read_at: null }, data: { read_at: new Date() } });
    return { ok: true };
  }
  /** Admin: full WhatsApp / message log. */
  @Roles('admin') @Get() async all(@Query() q: PageQuery) {
    const [items, total] = await Promise.all([this.prisma.notification.findMany({ orderBy: { id: 'desc' }, ...pageArgs(q) }), this.prisma.notification.count()]);
    return paged(items, total, q);
  }
}
