/**
 * Money settings that live in the `app_settings` table and are edited by the admin in the app (Admin > Billing).
 * There are NO environment variables for these. The default below is used only until the admin saves a value
 * (the seed writes it as a row on a fresh database; the service falls back to it if a row is ever missing).
 */
export const SETTING_DEFS: Record<string, { default: string; description: string }> = {
  tip_onboarding_fee: { default: '1000', description: 'TIP pays this (before GST) when filling the registration form' },
  tip_install_fee: { default: '500', description: 'TIP pays this (before GST) for each installed lead' },
  care_plan_fee_per_lead: { default: '199', description: 'TIP pays this (before GST) per lead to enable Care Plan' },
  dsa_payout_per_lead: { default: '300', description: 'Paid to DSA only when the lead is installed' },
  tip_job_earning: { default: '0', description: 'Amount shown in the "job completed" WhatsApp to the TIP (rupees per installed job)' },
  gst_percent: { default: '18', description: 'GST on all TIP charges' },
  auto_assign: { default: '1', description: '1/true = assign new leads to a TIP by pincode automatically' },
};
