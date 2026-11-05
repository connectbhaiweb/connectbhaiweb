/**
 * Common AiSensy WhatsApp sender. Every feature that needs a WhatsApp message calls
 * `sendAisensyCampaign` with its campaign name (defined below, in code) and parameters.
 */
export const AISENSY_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';

/** Campaign names as created in AiSensy (Campaigns -> API Campaign). Add new ones here. */
export const AISENSY_CAMPAIGNS = {
  otp: 'connectbhai_otp_login',
} as const;

export interface AisensyMessage {
  apiKey: string;
  campaignName: string;
  /** 10-digit Indian mobile number (91 is added automatically). */
  phone: string;
  params?: string[];
  /** Authentication (OTP) templates: value for the copy-code button. */
  copyCode?: string;
  userName?: string;
}

export async function sendAisensyCampaign(m: AisensyMessage): Promise<{ ok: boolean; error?: string }> {
  const body: Record<string, any> = {
    apiKey: m.apiKey,
    campaignName: m.campaignName,
    destination: `91${m.phone}`,
    userName: m.userName ?? 'ConnectBhai',
    templateParams: m.params ?? [],
  };
  if (m.copyCode) body.buttons = [{ type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: m.copyCode }] }];
  try {
    const r = await fetch(AISENSY_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.ok ? { ok: true } : { ok: false, error: `aisensy ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 250) };
  }
}
