import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { JobsService } from '../common/jobs/jobs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { sendAisensyCampaign } from './aisensy';
import { buildCampaign } from './whatsapp-campaigns';

export interface NotifyInput { user_id?: number | bigint | null; phone?: string | null; template: string; payload?: Record<string, any>; channel?: 'whatsapp' | 'sms' | 'in_app' }

/** Records every message and sends WhatsApp when a provider is configured (otherwise it is only logged). Never throws. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(private prisma: PrismaService, private cfg: ConfigService, private jobs: JobsService) {}

  /** Returns at once: recording and sending the message happen in the background, so the form the person submitted never waits for WhatsApp. */
  async send(i: NotifyInput): Promise<void> {
    await this.jobs.enqueue(`message:${i.template}`, async () => { await this.deliver(i); }, { retries: 0 });
  }

  /** Runs `fn` (look up whatever the message needs, then call send) in the background, so a form never waits for those queries. Never throws. */
  async defer(name: string, fn: () => Promise<void>): Promise<void> {
    await this.jobs.enqueue(`prepare:${name}`, fn, { retries: 1 });
  }

  private async deliver(i: NotifyInput) {
    const channel = i.channel ?? 'whatsapp';
    try {
      const row = await this.prisma.notification.create({
        data: { user_id: i.user_id ?? null, phone: i.phone ?? null, channel, template: i.template, payload: (i.payload ?? {}) as Prisma.InputJsonValue },
      });
      let status: 'queued' | 'sent' | 'failed' = 'sent';
      let error: string | undefined;
      const url = this.cfg.get<string>('WHATSAPP_API_URL');
      const aisensyKey = this.cfg.get<string>('AISENSY_API_KEY');
      const def = buildCampaign(i.template, i.payload);
      if (channel === 'whatsapp' && aisensyKey && i.phone) {
        if (!def) {
          status = 'queued'; error = 'No AiSensy campaign is set up for this message yet';   // recorded only; add it in whatsapp-campaigns.ts
        } else {
          let res = await sendAisensyCampaign({ apiKey: aisensyKey, campaignName: def.campaign, phone: i.phone, params: def.params, copyCode: def.copyCode });
          // a network problem or a 5xx from AiSensy is tried again twice; a 4xx (bad campaign or number) will not get better
          for (let n = 1; !res.ok && n <= 2 && !/^aisensy 4\d\d/.test(res.error ?? ''); n++) {
            await new Promise((r) => setTimeout(r, this.cfg.get('APP_ENV') === 'test' ? 0 : 1500 * n));
            res = await sendAisensyCampaign({ apiKey: aisensyKey, campaignName: def.campaign, phone: i.phone, params: def.params, copyCode: def.copyCode });
          }
          if (!res.ok) { status = 'failed'; error = res.error; }
        }
      } else if (channel === 'whatsapp' && url && i.phone) {
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.get('WHATSAPP_API_TOKEN')}` },
            body: JSON.stringify({ to: `91${i.phone}`, template: i.template, params: i.payload ?? {} }),
          });
          if (!r.ok) { status = 'failed'; error = `provider ${r.status}`; }
        } catch (e: any) { status = 'failed'; error = String(e?.message ?? e).slice(0, 250); }
      } else {
        this.logger.debug(`[${channel}] ${i.template} -> ${i.phone ?? i.user_id}`);
      }
      await this.prisma.notification.update({ where: { id: row.id }, data: { status, error } });
      return row;
    } catch (e: any) {
      this.logger.error(`notification failed: ${e?.message}`);
      return null;
    }
  }
}
