import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { dateIST } from './whatsapp-campaigns';

const TEMPLATE = 'registration_fee_due';
const WINDOW_DAYS = 7;       // only registrations newer than this are reminded
const DUE_AFTER_DAYS = 7;    // due date written in the message

/** A TIP who registered but has not paid the registration fee yet gets one WhatsApp reminder, PAYMENT_REMINDER_MINUTES after registering (default 30). */
@Injectable()
export class PaymentReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentReminderService.name);
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private notify: NotificationsService, private cfg: ConfigService) {}

  onModuleInit() {
    if (this.cfg.get('APP_ENV') === 'test') return;   // tests call run() directly
    this.timer = setInterval(() => this.run().catch((e) => this.logger.error(e?.message)), 5 * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** Returns how many TIPs were reminded. */
  async run(now: Date = new Date()): Promise<number> {
    const minutes = Number(this.cfg.get('PAYMENT_REMINDER_MINUTES') ?? 30);
    if (!(minutes >= 0)) return 0;
    const due = new Date(now.getTime() - minutes * 60_000);
    const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
    const charges = await this.prisma.charge.findMany({
      where: { kind: 'tip_onboarding', status: { in: ['pending', 'failed'] }, created_at: { lte: due, gte: since }, payer: { is_active: true, partner_status: { not: 'rejected' } } },
      include: { payer: { select: { id: true, name: true, phone: true } } },
      orderBy: { created_at: 'asc' }, take: 50,
    });
    let sent = 0;
    for (const c of charges) {
      const done = await this.prisma.notification.findFirst({ where: { template: TEMPLATE, user_id: c.payer.id, payload: { path: '$.charge_id', equals: Number(c.id) } }, select: { id: true } });
      if (done) continue;   // one reminder per charge
      await this.notify.send({ user_id: c.payer.id, phone: c.payer.phone, template: TEMPLATE, payload: { charge_id: Number(c.id), name: c.payer.name, what: 'TIP registration fee', amount: Number(c.total_amount), due: dateIST(new Date(c.created_at.getTime() + DUE_AFTER_DAYS * 86_400_000)) } });
      sent++;
    }
    if (sent) this.logger.log(`registration fee reminder sent to ${sent} TIPs`);
    return sent;
  }
}
