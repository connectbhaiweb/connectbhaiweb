import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { productName } from './whatsapp-campaigns';

const EVENT = 'feedback_requested';
const WINDOW_DAYS = 3;   // only installs newer than this are asked, so switching this on never messages old customers

/** Asks each customer how the installation went, FEEDBACK_DELAY_HOURS after it was completed (default 24). Once per lead. */
@Injectable()
export class FeedbackRequestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FeedbackRequestService.name);
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private notify: NotificationsService, private cfg: ConfigService) {}

  onModuleInit() {
    if (this.cfg.get('APP_ENV') === 'test') return;   // tests call run() directly
    this.timer = setInterval(() => this.run().catch((e) => this.logger.error(e?.message)), 10 * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** Returns how many customers were asked. */
  async run(now: Date = new Date()): Promise<number> {
    const hours = Number(this.cfg.get('FEEDBACK_DELAY_HOURS') ?? 24);
    if (!(hours >= 0)) return 0;
    const due = new Date(now.getTime() - hours * 3_600_000);
    const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
    const bookings = await this.prisma.booking.findMany({
      where: { status: 'completed', completed_at: { lte: due, gte: since }, lead: { events: { none: { event_type: EVENT } } } },
      take: 50, orderBy: { completed_at: 'asc' },
      include: { tip: { select: { name: true } }, lead: { select: { id: true, customer_name: true, customer_phone: true, customer_user_id: true, ref_code: true, plan: { select: { category: { select: { name: true } } } } } } },
    });
    for (const b of bookings) {
      // record first, so a crash or a second server can never ask the same customer twice
      await this.prisma.leadEvent.create({ data: { lead_id: b.lead.id, actor_user_id: null, event_type: EVENT } });
      await this.notify.send({ user_id: b.lead.customer_user_id, phone: b.lead.customer_phone, template: 'installation_feedback', payload: { name: b.lead.customer_name, product: productName(b.lead.plan), technician: b.tip?.name ?? 'Connect Bhai', ref_code: b.lead.ref_code } });
    }
    if (bookings.length) this.logger.log(`feedback requested from ${bookings.length} customers`);
    return bookings.length;
  }
}
