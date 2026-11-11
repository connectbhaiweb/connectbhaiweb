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

/** Phone number printed in the partner messages ("call us on ..."). Set SUPPORT_PHONE in the environment. */
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || '';
const roleLabel = (r: unknown) => (String(r).toLowerCase() === 'dsa' ? 'DSA' : 'TIP');

export const WHATSAPP_CAMPAIGNS: Record<string, CampaignDef> = {
  /** Login code. Unchanged. */
  otp: { campaign: 'connectbhai_otp_1', params: (p) => [p.code], copyCode: (p) => (p.code != null ? String(p.code) : undefined), about: 'One-time login code' },

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

  /** TIP: install fee to pay. Template payment_reminder (shared by payment_due below): {{1}} name, {{2}} what the bill is for, {{3}} amount, {{4}} due date. */
  install_fee_due: { campaign: 'Connect Bhai testing_payment', params: (p) => [p.name, p.what, p.amount, p.due], about: 'TIP: install fee is due' },

  /** TIP or customer with an unpaid charge (registration fee, Care Plan fee, a bill raised by admin, a payment they started). Same template as above (payment_reminder). */
  payment_due: { campaign: 'Connect Bhai testing_payment', params: (p) => [p.name, p.what, p.amount, p.due], about: 'TIP or customer: a payment is due' },

  /** Customer: complaint received. Template complaint_registered: {{1}} name, {{2}} complaint about, {{3}} complaint ID, {{4}} expected resolution. */
  complaint_registered: { campaign: 'BSNL Indore_complaint', params: (p) => [p.name, p.topic, p.ticket_code, p.expected], about: 'Customer: complaint registered' },

  /** Partner (DSA / TIP): registration received. Template dsa_registration_received: {{1}} name, {{2}} DSA or TIP, {{3}} registration ID, {{4}} help phone. */
  partner_registered: { campaign: 'dsa_registration_received', params: (p) => [p.name, roleLabel(p.role), p.partner_code, SUPPORT_PHONE], about: 'Partner: registration received' },

  /** Partner approved. Template "tip partner approved" (Partner Login button): {{1}} name, {{2}} DSA or TIP, {{3}} partner ID, {{4}} area. */
  partner_approved: { campaign: 'tip partner approved', params: (p) => [p.name, roleLabel(p.role), p.partner_code, p.area], about: 'Partner: registration approved' },

  /** Partner not approved. Template partner_not_approved: {{1}} name, {{2}} registration ID, {{3}} reason, {{4}} help phone. */
  partner_rejected: { campaign: 'partner_not_approved', params: (p) => [p.name, p.partner_code, p.reason, SUPPORT_PHONE], about: 'Partner: registration not approved' },

  /** Partner: agreement ready to accept. Sent by PartnerReminderService some time after registration. Template partner_agreement_pending: {{1}} name, {{2}} DSA or TIP, {{3}} partner ID. */
  partner_agreement_pending: { campaign: 'partner_agreement_pending', params: (p) => [p.name, roleLabel(p.role), p.partner_code], about: 'Partner: agreement waiting for you' },

  /** DSA: a lead was assigned. Sent by LeadsService.assign when admin sets or changes the DSA. Template dsa_lead_assigned: {{1}} name, {{2}} customer, {{3}} customer phone, {{4}} product, {{5}} area, {{6}} lead ID. */
  dsa_lead_assigned: { campaign: 'dsa_lead_assigned', params: (p) => [p.name, p.customer, p.customer_phone, p.product, p.area, p.ref_code], about: 'DSA: new lead assigned' },

  /** DSA: lead not updated. Sent by PartnerReminderService. Template dsa_lead_reminder: {{1}} name, {{2}} lead ID, {{3}} customer, {{4}} how long, e.g. "2 days". */
  dsa_lead_reminder: { campaign: 'dsa_lead_reminder', params: (p) => [p.name, p.ref_code, p.customer, p.since], about: 'DSA: please update this lead' },

  /** DSA: connection active, commission earned. Template dsa_commission_earned: {{1}} name, {{2}} customer, {{3}} lead ID, {{4}} amount, {{5}} payout cycle. */
  dsa_payout_eligible: { campaign: 'dsa_commission_earned', params: (p) => [p.name, p.customer, p.ref_code, p.amount, p.cycle], about: 'DSA: commission earned' },

  /** DSA: payout paid. Template partner_payout_credited: {{1}} name, {{2}} amount, {{3}} last 4 of bank account, {{4}} period, {{5}} transaction reference. */
  dsa_paid: { campaign: 'partner_payout_credited', params: (p) => [p.name, p.amount, p.bank_last4, p.period, p.reference], about: 'Partner: payout credited' },

  /** TIP: installation job assigned (Yes / No buttons). Template tip_job_assigned: {{1}} name, {{2}} job ID, {{3}} customer, {{4}} customer phone, {{5}} product, {{6}} address, {{7}} visit date. */
  tip_job_assigned: { campaign: 'tip_job_assigned', params: (p) => [p.name, p.ref_code, p.customer, p.customer_phone, p.product, p.address, p.when], about: 'TIP: new installation job' },

  /** TIP: job completed, earnings. Sent when the TIP marks the installation done; the amount is the admin setting tip_job_earning. Template tip_job_completed: {{1}} name, {{2}} job ID, {{3}} amount, {{4}} payout cycle. */
  tip_job_completed: { campaign: 'tip_job_completed', params: (p) => [p.name, p.ref_code, p.amount, p.cycle], about: 'TIP: job marked complete' },

  /** TIP: job still pending. Sent by PartnerReminderService. Template tip_job_reminder: {{1}} name, {{2}} job ID, {{3}} customer, {{4}} scheduled date. */
  tip_job_reminder: { campaign: 'tip_job_reminder', params: (p) => [p.name, p.ref_code, p.customer, p.when], about: 'TIP: pending job reminder' },
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
