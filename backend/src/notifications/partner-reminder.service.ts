import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { dateIST } from './whatsapp-campaigns';

const DAY = 86_400_000;

/**
 * Three WhatsApp nudges for partners, each sent ONCE per lead / booking:
 *  - dsa_lead_reminder: a DSA's lead has not been updated for DSA_LEAD_REMINDER_DAYS (default 2) and is still open.
 *  - tip_job_reminder: a TIP's installation is still "scheduled" TIP_JOB_REMINDER_HOURS (default 24) after its visit date.
 *  - partner_agreement_pending: a DSA / TIP who registered and is still awaiting approval gets the "agreement is ready, please review" message PARTNER_AGREEMENT_DELAY_MINUTES (default 60) after registering.
 * Runs every 30 minutes.
 */
@Injectable()
export class PartnerReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PartnerReminderService.name);
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private notify: NotificationsService, private cfg: ConfigService) {}

  onModuleInit() {
    if (this.cfg.get('APP_ENV') === 'test') return;   // tests call run() directly
    this.timer = setInterval(() => this.run().catch((e) => this.logger.error(e?.message)), 30 * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** Returns how many reminders were sent. */
  async run(now: Date = new Date()): Promise<number> {
    return (await this.dsaLeads(now)) + (await this.tipJobs(now)) + (await this.agreements(now));
  }

  private async dsaLeads(now: Date): Promise<number> {
    const days = Number(this.cfg.get('DSA_LEAD_REMINDER_DAYS') ?? 2);
    if (!(days > 0)) return 0;
    const leads = await this.prisma.lead.findMany({
      where: { brought_by_user_id: { not: null }, status: { in: ['new', 'contacted', 'followup'] }, updated_at: { lte: new Date(now.getTime() - days * DAY) }, dsa: { is: { is_active: true, partner_status: 'approved' } } },
      include: { dsa: { select: { id: true, name: true, phone: true } } },
      orderBy: { updated_at: 'asc' }, take: 50,
    });
    let sent = 0;
    for (const l of leads) {
      if (!l.dsa) continue;
      const done = await this.prisma.notification.findFirst({ where: { template: 'dsa_lead_reminder', user_id: l.dsa.id, payload: { path: '$.ref_code', equals: l.ref_code } }, select: { id: true } });
      if (done) continue;
      const waited = Math.max(days, Math.floor((now.getTime() - l.updated_at.getTime()) / DAY));
      await this.notify.send({ user_id: l.dsa.id, phone: l.dsa.phone, template: 'dsa_lead_reminder', payload: { name: l.dsa.name, ref_code: l.ref_code, customer: l.customer_name, since: `${waited} days` } });
      sent++;
    }
    if (sent) this.logger.log(`DSA lead reminder sent for ${sent} leads`);
    return sent;
  }

  private async tipJobs(now: Date): Promise<number> {
    const hours = Number(this.cfg.get('TIP_JOB_REMINDER_HOURS') ?? 24);
    if (!(hours > 0)) return 0;
    const bookings = await this.prisma.booking.findMany({
      where: { status: 'scheduled', scheduled_at: { lte: new Date(now.getTime() - hours * 3_600_000) } },
      include: { lead: { select: { ref_code: true, customer_name: true } }, tip: { select: { id: true, name: true, phone: true, is_active: true } } },
      orderBy: { scheduled_at: 'asc' }, take: 50,
    });
    let sent = 0;
    for (const b of bookings) {
      if (!b.tip?.is_active) continue;
      const done = await this.prisma.notification.findFirst({ where: { template: 'tip_job_reminder', user_id: b.tip.id, payload: { path: '$.ref_code', equals: b.lead.ref_code } }, select: { id: true } });
      if (done) continue;
      await this.notify.send({ user_id: b.tip.id, phone: b.tip.phone, template: 'tip_job_reminder', payload: { name: b.tip.name, ref_code: b.lead.ref_code, customer: b.lead.customer_name, when: dateIST(b.scheduled_at) } });
      sent++;
    }
    if (sent) this.logger.log(`TIP job reminder sent for ${sent} bookings`);
    return sent;
  }

  private async agreements(now: Date): Promise<number> {
    const minutes = Number(this.cfg.get('PARTNER_AGREEMENT_DELAY_MINUTES') ?? 60);
    if (!(minutes >= 0)) return 0;
    const partners = await this.prisma.user.findMany({
      where: { role: { in: ['dsa', 'tip'] }, partner_status: 'pending', is_active: true, created_at: { lte: new Date(now.getTime() - minutes * 60_000), gte: new Date(now.getTime() - 7 * DAY) } },
      select: { id: true, name: true, phone: true, role: true, partner_code: true },
      orderBy: { created_at: 'asc' }, take: 50,
    });
    let sent = 0;
    for (const u of partners) {
      const done = await this.prisma.notification.findFirst({ where: { template: 'partner_agreement_pending', user_id: u.id }, select: { id: true } });
      if (done) continue;
      await this.notify.send({ user_id: u.id, phone: u.phone, template: 'partner_agreement_pending', payload: { name: u.name, role: u.role, partner_code: u.partner_code } });
      sent++;
    }
    if (sent) this.logger.log(`agreement reminder sent to ${sent} partners`);
    return sent;
  }
}
