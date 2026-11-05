import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AISENSY_CAMPAIGNS, sendAisensyCampaign } from './aisensy';

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
      let status: 'sent' | 'failed' = 'sent';
      let error: string | undefined;
      const url = this.cfg.get<string>('WHATSAPP_API_URL');
      const aisensyKey = this.cfg.get<string>('AISENSY_API_KEY');
      const campaign = (AISENSY_CAMPAIGNS as Record<string, string>)[i.template] ?? i.template;
      if (channel === 'whatsapp' && aisensyKey && i.phone) {
        const code = i.payload?.code != null ? String(i.payload.code) : undefined;
        const res = await sendAisensyCampaign({
          apiKey: aisensyKey, campaignName: campaign, phone: i.phone,
          params: code ? [code] : Object.values(i.payload ?? {}).map(String),
          copyCode: i.template === 'otp' ? code : undefined,
        });
        if (!res.ok) { status = 'failed'; error = res.error; }
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
