import { Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, ParseEnumPipe, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, ThreadType } from '@prisma/client';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthUser, CurrentUser } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';
import { leadScope } from '../common/utils/scope';
import { ticketScope } from '../tickets/tickets.controller';

class SendDto {
  @IsOptional() @IsString() @MaxLength(4000) body?: string;
  @IsOptional() @IsString() @MaxLength(255) attachment_url?: string;
}
class AfterQuery { @IsOptional() @Type(() => Number) @IsInt() after?: number; }

@ApiTags('chat') @ApiBearerAuth() @Controller('chat')
export class ChatController {
  constructor(private prisma: PrismaService) {}

  /** lead thread: everyone on the lead; support thread: that user + admin; ticket thread: ticket participants. */
  private async assertAccess(type: ThreadType, id: number, u: AuthUser) {
    let ok = false;
    if (type === 'support') ok = u.role === 'admin' || id === u.id;
    else if (type === 'lead') ok = !!(await this.prisma.lead.findFirst({ where: { AND: [{ id }, leadScope(u)] }, select: { id: true } }));
    else ok = !!(await this.prisma.ticket.findFirst({ where: { AND: [{ id }, ticketScope(u)] }, select: { id: true } }));
    if (!ok) throw new ForbiddenException('You are not part of this conversation');
  }

  /** Inbox: one row per conversation the user can see (lead threads + support), with last message and unread count. */
  @Get('threads')
  async threads(@CurrentUser() u: AuthUser) {
    const leads = await this.prisma.lead.findMany({
      where: leadScope(u), orderBy: { updated_at: 'desc' }, take: 100,
      select: { id: true, ref_code: true, status: true, customer_name: true, customer_phone: true, customer_email: true, plan: { select: { name: true, category: { select: { name: true } } } },
        tip: { select: { id: true, name: true, phone: true } }, dsa: { select: { id: true, name: true, phone: true } } },
    });
    const supportIds = u.role === 'admin'
      ? (await this.prisma.chatMessage.findMany({ where: { thread_type: 'support' }, distinct: ['thread_id'], select: { thread_id: true }, take: 100 })).map((r) => Number(r.thread_id))
      : [u.id];
    const supportUsers = supportIds.length ? await this.prisma.user.findMany({ where: { id: { in: supportIds } }, select: { id: true, name: true, role: true, phone: true } }) : [];
    const rows: { type: 'lead' | 'support'; id: number }[] = [...leads.map((l) => ({ type: 'lead' as const, id: Number(l.id) })), ...supportIds.map((id) => ({ type: 'support' as const, id }))];
    const lastBy = new Map<string, any>(), unreadBy = new Map<string, number>();
    for (const type of ['lead', 'support'] as const) {
      const ids = rows.filter((r) => r.type === type).map((r) => r.id);
      if (!ids.length) continue;
      const last: any[] = await this.prisma.$queryRaw`
        SELECT m.id, m.thread_id, m.sender_user_id, m.body, m.created_at, us.name AS sender_name, us.role AS sender_role
        FROM chat_messages m JOIN users us ON us.id = m.sender_user_id
        WHERE m.thread_type = ${type} AND m.thread_id IN (${Prisma.join(ids)})
          AND m.id = (SELECT MAX(x.id) FROM chat_messages x WHERE x.thread_type = m.thread_type AND x.thread_id = m.thread_id)`;
      last.forEach((m) => lastBy.set(`${type}:${m.thread_id}`, m));
      const unread: any[] = await this.prisma.$queryRaw`
        SELECT m.thread_id, COUNT(*) AS c FROM chat_messages m
        LEFT JOIN chat_reads r ON r.user_id = ${u.id} AND r.thread_type = m.thread_type AND r.thread_id = m.thread_id
        WHERE m.thread_type = ${type} AND m.thread_id IN (${Prisma.join(ids)}) AND m.sender_user_id <> ${u.id} AND m.id > COALESCE(r.last_read_message_id, 0)
        GROUP BY m.thread_id`;
      unread.forEach((r) => unreadBy.set(`${type}:${r.thread_id}`, Number(r.c)));
    }
    const lastOut = (m: any) => m && { id: Number(m.id), body: m.body, created_at: m.created_at, sender_user_id: Number(m.sender_user_id), sender_name: m.sender_name, sender_role: m.sender_role };
    const out = [
      ...leads.map((l) => ({ type: 'lead', id: Number(l.id), title: `${l.customer_name} · ${l.ref_code}`, sub: l.plan ? `${l.plan.category.name} · ${l.plan.name}` : 'Callback request', lead: l, last: lastOut(lastBy.get(`lead:${l.id}`)) ?? null, unread: unreadBy.get(`lead:${l.id}`) ?? 0 })),
      ...supportIds.map((id) => {
        const su = supportUsers.find((x) => Number(x.id) === id);
        return { type: 'support', id, title: u.role === 'admin' ? `${su?.name ?? 'User'} · support` : 'Connect Bhai Admin', sub: u.role === 'admin' ? su?.role ?? '' : 'Support chat · any time', user: su ?? null, last: lastOut(lastBy.get(`support:${id}`)) ?? null, unread: unreadBy.get(`support:${id}`) ?? 0 };
      }),
    ];
    return out.sort((a: any, b: any) => String(b.last?.created_at ?? '').localeCompare(String(a.last?.created_at ?? '')));
  }

  @Get(':type/:id/messages')
  async messages(@Param('type', new ParseEnumPipe(ThreadType)) type: ThreadType, @Param('id', ParseIntPipe) id: number, @Query() q: AfterQuery, @CurrentUser() u: AuthUser) {
    await this.assertAccess(type, id, u);
    return this.prisma.chatMessage.findMany({
      where: { thread_type: type, thread_id: id, id: q.after ? { gt: q.after } : undefined },
      orderBy: { id: 'asc' }, take: 200, include: { sender: { select: { id: true, name: true, role: true } } },
    });
  }

  @Post(':type/:id/messages')
  async send(@Param('type', new ParseEnumPipe(ThreadType)) type: ThreadType, @Param('id', ParseIntPipe) id: number, @Body() d: SendDto, @CurrentUser() u: AuthUser) {
    if (!d.body?.trim() && !d.attachment_url) throw new NotFoundException('Message is empty');
    await this.assertAccess(type, id, u);
    return this.prisma.chatMessage.create({ data: { thread_type: type, thread_id: id, sender_user_id: u.id, body: d.body?.trim(), attachment_url: d.attachment_url } });
  }

  @Post(':type/:id/read') @HttpCode(200)
  async read(@Param('type', new ParseEnumPipe(ThreadType)) type: ThreadType, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    await this.assertAccess(type, id, u);
    const last = await this.prisma.chatMessage.findFirst({ where: { thread_type: type, thread_id: id }, orderBy: { id: 'desc' }, select: { id: true } });
    const last_read_message_id = last?.id ?? 0;
    await this.prisma.chatRead.upsert({
      where: { user_id_thread_type_thread_id: { user_id: u.id, thread_type: type, thread_id: id } },
      update: { last_read_message_id }, create: { user_id: u.id, thread_type: type, thread_id: id, last_read_message_id },
    });
    return { last_read_message_id };
  }

  @Get(':type/:id/unread')
  async unread(@Param('type', new ParseEnumPipe(ThreadType)) type: ThreadType, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    await this.assertAccess(type, id, u);
    const r = await this.prisma.chatRead.findUnique({ where: { user_id_thread_type_thread_id: { user_id: u.id, thread_type: type, thread_id: id } } });
    const unread = await this.prisma.chatMessage.count({ where: { thread_type: type, thread_id: id, id: { gt: r?.last_read_message_id ?? 0 }, sender_user_id: { not: u.id } } });
    return { unread };
  }
}
