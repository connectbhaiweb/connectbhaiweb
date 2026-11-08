/**
 * ONE place that says which AiSensy campaign sends which message, and what goes into its {{1}} {{2}} ... variables.
 *
 * To add a message: create the API campaign in AiSensy (Campaigns -> API), add one entry below, then call
 * `notify.send({ template: '<key>', phone, payload: { ... } })` from the feature. Nothing else needs to change.
 * A message key with no entry here is only recorded in the database (status "queued"); it is never sent.
 *
 * Campaign names must match AiSensy exactly (including spaces and capital letters).
 */
type Payload = Record<string, any>;

export interface CampaignDef {
  /** Campaign name as shown in AiSensy. */
  campaign: string;
  /** Values for {{1}}, {{2}}, ... in the template, in order. */
  params: (p: Payload) => unknown[];
  /** Authentication (OTP) template only: text for the copy-code button. */
  copyCode?: (p: Payload) => string | undefined;
  /** What the template says, for people reading this file. */
  about: string;
}

export const WHATSAPP_CAMPAIGNS: Record<string, CampaignDef> = {
  /** Login code. Unchanged. */
  otp: { campaign: 'connectbhai_otp_login', params: (p) => [p.code], copyCode: (p) => (p.code != null ? String(p.code) : undefined), about: 'One-time login code' },

  /** Customer: request received. Template bhai_lead_confirmed: {{1}} name, {{2}} product, {{3}} request ID, {{4}} executive. */
  lead_received: { campaign: 'Lead Confirm', params: (p) => [p.name, p.product, p.ref_code, p.executive], about: 'Customer: we got your request' },

  /** Customer: lead moved to follow-up. Template lead_followup (Yes / Call me / Not now buttons): {{1}} name, {{2}} product. */
  lead_followup: { campaign: 'Connect Bhai_leadfollowup', params: (p) => [p.name, p.product], about: 'Customer: still interested?' },

  /** Customer: technician started. Template installation_in_progress: {{1}} name, {{2}} technician, {{3}} product, {{4}} request ID. */
  installation_in_progress: { campaign: 'Connect Bhai_installation WIP', params: (p) => [p.name, p.technician, p.product, p.ref_code], about: 'Customer: technician started the installation' },

  /** Customer: connection is live. Template connection_activated: {{1}} name, {{2}} product, {{3}} plan, {{4}} user ID, {{5}} activation date. */
  installed: { campaign: 'Connect Bhai_activated', params: (p) => [p.name, p.product, p.plan, p.connection_id, p.date], about: 'Customer: your connection is active' },

  /** Customer: welcome. Defined but NOT sent at the moment (only the activation message goes out at installation). Template welcome_customer: {{1}} name, {{2}} product. */
  welcome: { campaign: 'Connect Bhai _welcome', params: (p) => [p.name, p.product], about: 'Customer: welcome to ConnectBhai' },

  /** Customer: rate the installation (Excellent / Good / Needs improvement buttons). Template installation_feedback: {{1}} name, {{2}} product, {{3}} technician. */
  installation_feedback: { campaign: 'Connect Bhai testing campaign', params: (p) => [p.name, p.product, p.technician], about: 'Customer: how was the installation?' },

  /** TIP: install fee to pay. Template payment_reminder: {{1}} name, {{2}} what the bill is for, {{3}} amount, {{4}} due date. */
  install_fee_due: { campaign: 'Connect Bhai testing_payment', params: (p) => [p.name, p.what, p.amount, p.due], about: 'TIP: install fee is due' },

  /** TIP registered but has not paid the registration fee. Same template as above (payment_reminder): {{1}} name, {{2}} what the bill is for, {{3}} amount, {{4}} due date. */
  registration_fee_due: { campaign: 'Connect Bhai testing_payment', params: (p) => [p.name, p.what, p.amount, p.due], about: 'TIP: registration fee is unpaid' },

  /** Customer: complaint received. Template complaint_registered: {{1}} name, {{2}} complaint about, {{3}} complaint ID, {{4}} expected resolution. */
  complaint_registered: { campaign: 'BSNL Indore_complaint', params: (p) => [p.name, p.topic, p.ticket_code, p.expected], about: 'Customer: complaint registered' },
};

/** AiSensy rejects empty variables, and line breaks are not allowed inside a variable. */
const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim() || '-';

export function buildCampaign(template: string, payload: Payload = {}): { campaign: string; params: string[]; copyCode?: string } | null {
  const d = WHATSAPP_CAMPAIGNS[template];
  if (!d) return null;
  return { campaign: d.campaign, params: d.params(payload).map(clean), copyCode: d.copyCode?.(payload) };
}

/** "Broadband" product wording used in the messages, e.g. "BSNL" or "Airtel". */
export const productName = (plan?: { category?: { name?: string | null } | null } | null) => plan?.category?.name || 'broadband';

/** 07 Nov 2026, in India time. */
export const dateIST = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);
