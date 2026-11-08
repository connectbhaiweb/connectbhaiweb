import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { sendAisensyCampaign } from './aisensy';
import { buildCampaign } from './whatsapp-campaigns';

export interface NotifyInput { user_id?: number | bigint | null; phone?: string | null; template: string; payload?: Record<string, any>; channel?: 'whatsapp' | 'sms' | 'in_app' }

/** Records every message and sends WhatsApp when a provider is configured (otherwise it is only logged). Never throws. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  async send(i: NotifyInput) {
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
          const res = await sendAisensyCampaign({ apiKey: aisensyKey, campaignName: def.campaign, phone: i.phone, params: def.params, copyCode: def.copyCode });
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
