/**
 * Common AiSensy WhatsApp sender. Every feature that needs a WhatsApp message calls
 * `sendAisensyCampaign` with its campaign name (defined below, in code) and parameters.
 */
export const AISENSY_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';

/** Which campaign sends which message: see ./whatsapp-campaigns.ts (the one place to add or change them). */

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
    // 10 s at most: a hung AiSensy call must never keep an OTP (or the queue) waiting
    const r = await fetch(AISENSY_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    if (r.ok) return { ok: true };
    // keep AiSensy's own reason (e.g. "Campaign does not exist"): "aisensy 400" alone says nothing
    let why = '';
    try { const j: any = await r.json(); why = String(j?.errorMessage ?? j?.message ?? '').slice(0, 150); } catch { /* no body */ }
    return { ok: false, error: why ? `aisensy ${r.status}: ${why}` : `aisensy ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 250) };
  }
}
