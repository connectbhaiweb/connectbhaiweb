/* The shapes the screens use (the same field names as the website's data layer). All ids are strings. */
import type { Role } from './base';

export type User = {
  id: string; role: Role; full_name: string; name: string; phone: string; email: string; partner_id: string | null;
  partner_code: string | null; disabled: boolean; must_change: boolean; has_password: boolean; partner_status: string | null;
};
export type Person = { id: string; name: string; firm: string; phone: string; email: string; type: string; partner_code?: string | null };
export type Provider = { id: string; name: string; brand: string; kind: string; logo_url: string | null; is_demo: boolean; is_active: boolean; website: string };
export type Plan = {
  id: string; plan_code: string; name: string; category: string; provider_id: string; provider: Provider; speed_mbps: number | null;
  price_monthly: number; price_ex_gst: number | null; install_charge: number; router_charge: number; validity_days: number;
  data_limit: string | null; data_limit_gb: number | null; data_per_day_gb?: number | null; voice?: string | null; sms_per_day?: number | null;
  ott_apps: string[]; tv_channels: number; is_active: boolean; status: string; verified_at?: string; source_url: string; notes: string;
  benefits: unknown; technology: string; is_demo: boolean;
};
export type Booking = {
  id: string; status: string; scheduled_date: string | null; installed_at: string | null; connection_ref: string | null; ont_serial: string | null;
};
export type Payment = { id: string; amount: number; paid_at: string; via: string; invoice_no: string | null };
export type Lead = {
  id: string; ref_code: string; customer_id: string; name: string; phone: string; email: string; pincode: string; area: string | null; area_id: string | null;
  address: string; plan_id: string; plan: Plan | null; preferred_date: null; source: string; product: string; status: string; assigned_dsa_id: string;
  assigned_tip_id: string; dsa: Person | null; tip: Person | null; next_follow_up: string | null; lost_reason: string | null; notes: string | null;
  telephone_no: string; order_no: string; care_plan: boolean; payment: Payment | null; consent: boolean; created_at: string; updated_at: string;
  installed_at: string | null; booking: Booking | null;
};
export type LeadEvent = { id: string; lead_id: string; from_status: string; to_status: string; note: string; created_at: string; actor_name?: string };
export type Device = {
  id: string; booking_id: string | null; lead_id: string; state: 'online' | 'offline' | 'unknown'; last_seen: string | null; rx_dbm: number | null;
  ssid: string | null; clients: number | null; acs: string | null; active: boolean; make: string; model: string; firmware: string; wan: string;
  uptime_h: null; reboots_7d: number; reboots_30d: number; is_simulated: boolean; source: string; status_only: boolean; serial: string;
};
export type FullBooking = Booking & {
  ref_code: string; lead_id: string; customer_id: string; plan_id: string; plan: Plan | null; tip_partner_id: string; dsa_partner_id: string;
  authorized: boolean; created_at: string; care_plan: boolean;
  lead: { id: string; ref_code: string; name: string; phone: string; email: string; address: string; pincode: string; status: string; telephone_no: string; order_no: string };
  tip: Person | null; dsa: null; device: Device | null;
};
export type Charge = {
  id: string; ref_code: string; kind: string; partner_id: string | null; customer_id: string | null; payer_user_id: string; lead_id: string; booking_id: null;
  description: string; base_amount: number; gst_amount: number; amount: number; status: string; gateway: string; gateway_order_id: string | null;
  gateway_payment_id: string | null; paid_via: string | null; paid_at: string | null; created_at: string; invoice_no: string | null;
  partner: Person | null; customer: User | null;
};
export type Settings = {
  registration_fee_tip: number; gst_percent: number; tip_install_fee: number; care_plan_fee_per_lead: number; dsa_payout_per_lead: number;
  tip_job_earning: number; auto_assign: number; lead_target_default: number; tip_share_percent: number;
};
export type City = { id: string; name: string; district: string; tier: number; status: string };
export type Upload = { public_id: string; version: number; signature: string; format: string; resource_type: string; bytes: number };
/** A file picked on the phone. */
export type PickedFile = { uri: string; name: string; size: number; type: string };
export type Page<T> = { items: T[]; total: number; page: number; limit: number };
export type PageFilter = {
  page?: number; limit?: number; status?: string; q?: string; unassigned?: boolean | number; sort?: string; pincode?: string; device?: string;
  from?: string; to?: string; devices?: boolean; kind?: string; lead_ids?: string; role?: string; type?: string;
};
export type SpeedRecord = {
  id: string; booking_id: string | null; user_id?: string; kind: string; status: string; error?: string | null; download_mbps: number; upload_mbps: number;
  ping_ms: number; jitter_ms: number | null; is_simulated: boolean; created_at: string;
};
