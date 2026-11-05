import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { PageQuery, pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

class CommissionQuery extends PageQuery {
  @IsOptional() @IsIn(['pending', 'approved', 'paid', 'cancelled']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() dsa_user_id?: number;
}
class PayDto {
  @IsIn(['upi', 'bank', 'cash', 'other']) mode: 'upi' | 'bank' | 'cash' | 'other';
  @IsString() @MaxLength(80) reference: string;
}
class NoteDto { @IsOptional() @IsString() @MaxLength(255) notes?: string; }

@ApiTags('commissions') @ApiBearerAuth() @Controller('commissions')
export class CommissionsController {
  constructor(private prisma: PrismaService, private notify: NotificationsService) {}

  /** DSA sees their own payouts (flat per installed lead); admin sees all. */
  @Roles('dsa', 'admin') @Get()
  async list(@Query() q: CommissionQuery, @CurrentUser() u: AuthUser) {
    const where: Prisma.CommissionWhereInput = { status: q.status as any, dsa_user_id: u.role === 'dsa' ? u.id : q.dsa_user_id };
    const [items, total, sums] = await Promise.all([
      this.prisma.commission.findMany({ where, orderBy: { id: 'desc' }, include: { lead: { select: { ref_code: true, customer_name: true, pincode: true } }, dsa: { select: { id: true, name: true, partner_code: true } } }, ...pageArgs(q) }),
      this.prisma.commission.count({ where }),
      this.prisma.commission.groupBy({ by: ['status'], where: { dsa_user_id: where.dsa_user_id }, _sum: { amount: true } }),
    ]);
    const totals = Object.fromEntries(sums.map((s) => [s.status, Number(s._sum.amount ?? 0)]));
    return { ...paged(items, total, q), totals: { pending: 0, approved: 0, paid: 0, cancelled: 0, ...totals } };
  }

  @Roles('admin') @Post(':id/approve') @HttpCode(200)
  async approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    const r = await this.prisma.commission.updateMany({ where: { id, status: 'pending' }, data: { status: 'approved', approved_by: u.id, approved_at: new Date() } });
    if (!r.count) throw new BadRequestException('Only pending payouts can be approved');
    return this.prisma.commission.findUniqueOrThrow({ where: { id } });
  }

  @Roles('admin') @Post(':id/pay') @HttpCode(200)
  async pay(@Param('id', ParseIntPipe) id: number, @Body() d: PayDto, @CurrentUser() u: AuthUser) {
    const r = await this.prisma.commission.updateMany({ where: { id, status: 'approved' }, data: { status: 'paid', paid_at: new Date(), paid_mode: d.mode, paid_reference: d.reference, paid_by: u.id } });
    if (!r.count) throw new BadRequestException('Only approved payouts can be marked paid');
    const c = await this.prisma.commission.findUniqueOrThrow({ where: { id }, include: { dsa: true } });
    await this.notify.send({ user_id: c.dsa_user_id, phone: c.dsa.phone, template: 'dsa_paid', payload: { amount: Number(c.amount), reference: d.reference } });
    const { dsa, ...rest } = c;
    return rest;
  }

  @Roles('admin') @Post(':id/cancel') @HttpCode(200)
  async cancel(@Param('id', ParseIntPipe) id: number, @Body() d: NoteDto) {
    const r = await this.prisma.commission.updateMany({ where: { id, status: { in: ['pending', 'approved'] } }, data: { status: 'cancelled', notes: d.notes } });
    if (!r.count) throw new BadRequestException('Only pending or approved payouts can be cancelled');
    return this.prisma.commission.findUniqueOrThrow({ where: { id } });
  }
}
