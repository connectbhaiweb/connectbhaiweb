import { leadTextWhere } from '../common/utils/fulltext';
import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthUser, CurrentUser } from '../common/decorators';
import { PageQuery, pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { leadScope } from '../common/utils/scope';

class CreateTicketDto {
  @IsOptional() @Type(() => Number) @IsInt() lead_id?: number;
  @IsOptional() @IsIn(['no_internet', 'slow_speed', 'billing', 'shifting', 'other']) category?: string;
  @IsString() @MinLength(3) @MaxLength(160) subject: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsIn(['low', 'normal', 'high']) priority?: string;
}
class UpdateTicketDto {
  @IsOptional() @IsIn(['open', 'in_progress', 'resolved', 'closed']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() assigned_to?: number;
  @IsOptional() @IsIn(['low', 'normal', 'high']) priority?: string;
}
class TicketQuery extends PageQuery {
  @IsOptional() @IsIn(['open', 'in_progress', 'resolved', 'closed']) status?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(['1', 'true']) open?: string;
}

export const ticketScope = (u: AuthUser): Prisma.TicketWhereInput =>
  u.role === 'admin' ? {} : u.role === 'tip' ? { OR: [{ assigned_to: u.id }, { lead: { tip_user_id: u.id } }] } : { raised_by: u.id };

@ApiTags('tickets') @ApiBearerAuth() @Controller('tickets')
export class TicketsController {
  constructor(private prisma: PrismaService, private notify: NotificationsService) {}

  @Post() async create(@Body() d: CreateTicketDto, @CurrentUser() u: AuthUser) {
    let assigned_to: bigint | null = null;
    if (d.lead_id) {
      const lead = await this.prisma.lead.findFirst({ where: { id: d.lead_id, ...(u.role === 'admin' ? {} : leadScope(u)) } });
      if (!lead) throw new BadRequestException('Lead not found');
      assigned_to = lead.tip_user_id;
    }
    const t = await this.prisma.ticket.create({
      data: { ticket_code: `TMP-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, lead_id: d.lead_id, raised_by: u.id, assigned_to, category: d.category as any, subject: d.subject, description: d.description, priority: d.priority as any },
    });
    const ticket = await this.prisma.ticket.update({ where: { id: t.id }, data: { ticket_code: `TK-${String(t.id).padStart(6, '0')}` } });
    const raiser = await this.prisma.user.findUnique({ where: { id: u.id }, select: { name: true, phone: true } });
    if (u.role === 'customer' && raiser?.phone) await this.notify.send({ user_id: u.id, phone: raiser.phone, template: 'complaint_registered', payload: { name: raiser.name, topic: ticket.subject, ticket_code: ticket.ticket_code, expected: 'within 24 hours' } });
    return ticket;
  }

  @Get() async list(@Query() q: TicketQuery, @CurrentUser() u: AuthUser) {
    const s = q.q?.trim();
    const where: Prisma.TicketWhereInput = { AND: [ticketScope(u), q.status ? { status: q.status as any } : q.open ? { status: { in: ['open', 'in_progress'] } } : {}, ...(s ? [{ OR: [{ ticket_code: { contains: s } }, { subject: { contains: s } }, { lead: await leadTextWhere(this.prisma, s) }] }] : [])] };
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({ where, orderBy: { id: 'desc' }, relationLoadStrategy: 'join', include: { lead: { select: { id: true, ref_code: true, customer_name: true, customer_phone: true, pincode: true, plan: { select: { name: true, category: { select: { name: true, type: true, logo_url: true } } } } } }, raiser: { select: { id: true, name: true, phone: true } } }, ...pageArgs(q) }),
      this.prisma.ticket.count({ where }),
    ]);
    return paged(items, total, q);
  }

  @Get(':id') async one(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    const t = await this.prisma.ticket.findFirst({ where: { AND: [{ id }, ticketScope(u)] }, include: { lead: { select: { ref_code: true, customer_name: true } } } });
    if (!t) throw new NotFoundException('Ticket not found');
    return t;
  }

  @Patch(':id') async update(@Param('id', ParseIntPipe) id: number, @Body() d: UpdateTicketDto, @CurrentUser() u: AuthUser) {
    const t = await this.prisma.ticket.findFirst({ where: { AND: [{ id }, ticketScope(u)] } });
    if (!t) throw new NotFoundException('Ticket not found');
    const staff = u.role === 'admin' || u.role === 'tip';
    if (!staff && (d.assigned_to != null || d.priority || (d.status && d.status !== 'closed'))) throw new ForbiddenException('You can only close your own ticket');
    if (d.assigned_to != null && u.role !== 'admin') throw new ForbiddenException('Only admin can reassign tickets');
    const done = d.status === 'resolved' || d.status === 'closed';
    return this.prisma.ticket.update({ where: { id }, data: { status: d.status as any, assigned_to: d.assigned_to, priority: d.priority as any, resolved_at: done ? new Date() : d.status ? null : undefined } });
  }
}
