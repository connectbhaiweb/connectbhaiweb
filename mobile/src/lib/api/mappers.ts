/* API shapes → screen shapes. Port of the "mappers" part of frontend/src/lib/connectbhai/rest.js. */
import type { Booking, Charge, City, Device, FullBooking, Lead, Person, Plan, Provider, Settings, User } from './types';

type Raw = any;
export const S = (v: Raw): any => (v == null ? v : String(v));
export const N = (v: Raw) => (v == null || v === '' ? undefined : Number(v));
export const num = (v: Raw): any => (v == null ? v : Number(v));

export type Rates = { dsa: number; tip: number };

export const mapUser = (u: Raw): User => ({
  id: S(u.id), role: u.role, full_name: u.name, name: u.name, phone: u.phone, email: u.email || '', partner_id: ['dsa', 'tip'].includes(u.role) ? S(u.id) : null,
  partner_code: u.partner_code || null, disabled: u.is_active === false, must_change: false, has_password: u.role === 'admin', partner_status: u.partner_status || null,
});

const PSTATUS: Record<string, string> = { approved: 'active', pending: 'pending', rejected: 'suspended', suspended: 'suspended' };
export const mapPartner = (u: Raw, rates: Rates) =>
  u && {
    id: S(u.id), type: u.role, role: u.role, name: u.name, firm: u.business_name || '', phone: u.phone, email: u.email || '', partner_code: u.partner_code, city_id: S(u.city_id),
    address: u.address || '', pincode: u.pincode || '', service_pincodes: Array.isArray(u.service_pincodes) ? u.service_pincodes.join(', ') : u.pincode || '',
    status: PSTATUS[u.partner_status] || 'pending', kyc_verified: !!u.approved_at, approved_at: u.approved_at, fee_paid_at: u.approved_at,
    commission_per_install: rates[u.role as keyof Rates] || 0, created_at: u.created_at, is_internal: !!u.is_internal, acs_mode: 'connectbhai', acs_key_set: true, acs_agreement: true,
    aadhaar_last4: u.aadhaar_last4, pan_last4: u.pan_last4, bank_name: u.bank_name || '', bank_ifsc: u.bank_ifsc || '', bank_account_last4: u.bank_account_last4 || '', upi_id: u.upi_id || '',
  };
export type Partner = ReturnType<typeof mapPartner>;

export const pc = (u: Raw): Person | null =>
  u ? { id: S(u.id), name: u.name, firm: u.business_name || '', phone: u.phone || '', email: u.email || '', type: u.role || 'partner', partner_code: u.partner_code } : null;

/* The official provider logos are bundled with the app (see ui/ProviderLogo). */
const BRAND_LOGO: Record<string, string> = { bsnl: '/logos/bsnl.png', jio: '/logos/jio.svg', airtel: '/logos/airtel.svg' };
const CAT: Record<string, string> = { fiber: 'fiber', airfiber: 'air_fiber', tv: 'tv', ott: 'ott' };
export const CATBACK: Record<string, string> = { fiber: 'fiber', air_fiber: 'airfiber', tv: 'tv', ott: 'ott' };

export const providerOf = (c: Raw): Provider | null =>
  c
    ? {
        id: S(c.id), name: c.type && c.type !== 'fiber' ? `${c.name} · ${({ airfiber: 'Air Fiber', tv: 'TV', ott: 'OTT' } as Record<string, string>)[c.type] || c.type}` : c.name,
        brand: c.name, kind: 'local_isp', logo_url: c.logo_url || BRAND_LOGO[String(c.name || '').toLowerCase()] || null, is_demo: false, is_active: c.is_active !== false, website: '',
      }
    : null;

export const mapPlan = (p: Raw): Plan => ({
  id: S(p.id), plan_code: p.plan_code, name: p.name, category: p.category ? CAT[p.category.type] || p.category.type : 'fiber',
  provider_id: S(p.category_id || (p.category && p.category.id)), provider: providerOf(p.category || { id: p.category_id, name: 'Plan' })!,
  speed_mbps: p.speed_mbps, price_monthly: num(p.price), price_ex_gst: p.price_ex_gst != null ? num(p.price_ex_gst) : null, install_charge: num(p.install_charge) || 0,
  router_charge: num(p.router_charge) || 0, validity_days: p.validity_days || 30, data_limit: p.data_limit, data_limit_gb: null,
  ott_apps: (p.ott_apps || []).map((o: Raw) => (typeof o === 'string' ? o : o.name)), tv_channels: p.tv_channels || 0, is_active: p.is_active !== false, status: 'live',
  verified_at: p.created_at, source_url: '', notes: '', benefits: p.benefits || null, technology: 'ftth', is_demo: false,
});

const LS: Record<string, string> = { new: 'new', contacted: 'contacted', followup: 'follow_up', scheduled: 'booked', installed: 'installed', lost: 'lost', cancelled: 'lost' };
export const LSBACK: Record<string, string> = { follow_up: 'followup' };
export const uiLeadStatus = (s: string) => LS[s] || s;
/* UI status -> /leads query. "new" = nobody assigned yet; "assigned" = still new on the server but has a DSA or TIP. */
export const leadStatusQuery = (st: string): Record<string, string | number> =>
  st === 'assigned' ? { status: 'new', assigned: 1 } : st === 'new' ? { status: 'new', unassigned: 1 } : { status: LSBACK[st] || (st === 'booked' ? 'scheduled' : st) };
/* server notes "dsa_user_id=5 (was 3)", "dsa removed (was 3)", "tip_user_id=7" -> words a customer can read */
export const assignNote = (n?: string | null) =>
  /^dsa removed/.test(n || '') ? { to: null, note: 'Agent removed' } : /^dsa_user_id=/.test(n || '') ? { to: 'assigned', note: 'Agent assigned' } : { to: 'assigned', note: 'Installer assigned' };

const BS: Record<string, string> = { scheduled: 'scheduled', rescheduled: 'scheduled', completed: 'installed', cancelled: 'cancelled' };

export const mapLead = (l: Raw): Lead => {
  const bk = Array.isArray(l.bookings) && l.bookings[0] ? l.bookings[0] : null; // the latest booking, sent with every lead
  const b: Booking | null = bk
    ? { id: S(bk.id), status: BS[bk.status] || bk.status, scheduled_date: bk.scheduled_at ? String(bk.scheduled_at).slice(0, 10) : null, installed_at: bk.completed_at, connection_ref: bk.connection_id, ont_serial: bk.router_serial || null }
    : l.booking || null;
  return {
    id: S(l.id), ref_code: l.ref_code, customer_id: S(l.customer_user_id), name: l.customer_name, phone: l.customer_phone, email: l.customer_email || '', pincode: l.pincode,
    area: l.area ? l.area.name : null, area_id: l.area ? S(l.area.id) : null, address: l.address, plan_id: S(l.plan_id),
    plan: l.plan ? mapPlan({ ...l.plan, category: l.plan.category }) : null, preferred_date: null, source: l.source,
    product: l.plan && l.plan.category && ['ott'].includes(l.plan.category.type) ? 'ott' : 'broadband',
    /* the API has no "assigned" status: a new lead with a DSA (or, on an old lead, a TIP) is shown as Assigned */
    status: l.status === 'new' && (l.brought_by_user_id || l.tip_user_id) ? 'assigned' : LS[l.status] || l.status,
    assigned_dsa_id: S(l.brought_by_user_id), assigned_tip_id: S(l.tip_user_id), dsa: pc(l.dsa), tip: pc(l.tip), next_follow_up: l.followup_at ? String(l.followup_at).slice(0, 10) : null,
    lost_reason: l.lost_reason, notes: l.notes, telephone_no: l.telephone_no || '', order_no: l.order_no || '', care_plan: !!l.care_plan,
    payment: l.charges && l.charges[0] ? { id: S(l.charges[0].id), amount: num(l.charges[0].total_amount), paid_at: l.charges[0].paid_at, via: l.charges[0].pay_mode, invoice_no: l.charges[0].invoice_no } : null,
    consent: true, created_at: l.created_at, updated_at: l.updated_at, installed_at: l.installed_at, booking: b,
  };
};

export const mapDevice = (d: Raw): Device => ({
  id: S(d.id), booking_id: null, lead_id: S(d.lead_id), state: d.online == null ? 'unknown' : d.online ? 'online' : 'offline', last_seen: d.last_seen_at, rx_dbm: num(d.rx_power_dbm),
  ssid: d.wifi_ssid, clients: d.connected_clients, acs: d.genieacs_device_id || d.serial_number ? 'connectbhai' : null, active: d.is_active !== false, make: '', model: d.model || '', firmware: '',
  wan: d.online ? 'Connected' : d.online === false ? 'Down' : '—', uptime_h: null, reboots_7d: 0, reboots_30d: 0,
  is_simulated: d.source !== 'zabbix' && !(d.genieacs_device_id || d.last_seen_at), source: 'acs',
  status_only: d.source === 'zabbix', serial: d.serial_number || '', // a Zabbix ONU: Online / Offline only, no commands
});

export const mapBooking = (b: Raw, devs?: Raw[] | null): FullBooking => {
  const ld = b.lead || {};
  const dv = devs ? devs.find((d) => String(d.lead_id) === String(b.lead_id)) : null;
  return {
    id: S(b.id), ref_code: 'BK-' + String(b.id).padStart(6, '0'), lead_id: S(b.lead_id), customer_id: S(ld.customer_user_id), plan_id: S(ld.plan && ld.plan.id), plan: ld.plan ? mapPlan(ld.plan) : null,
    tip_partner_id: S(b.tip_user_id), dsa_partner_id: S(ld.brought_by_user_id), status: BS[b.status] || b.status, scheduled_date: b.scheduled_at ? String(b.scheduled_at).slice(0, 10) : null,
    installed_at: b.completed_at, connection_ref: b.connection_id, ont_serial: b.router_serial, authorized: b.status === 'completed', created_at: b.created_at, care_plan: !!ld.care_plan,
    lead: { id: S(ld.id || b.lead_id), ref_code: ld.ref_code, name: ld.customer_name, phone: ld.customer_phone, email: '', address: ld.address, pincode: ld.pincode, status: LS[ld.status] || ld.status, telephone_no: ld.telephone_no || '', order_no: ld.order_no || '' },
    tip: pc(b.tip), dsa: null, device: dv ? { ...mapDevice(dv), booking_id: S(b.id) } : null,
  };
};

const CK: Record<string, string> = { tip_onboarding: 'registration_fee', tip_install_fee: 'platform_fee', tip_care_plan_fee: 'care_plan_fee', customer_payment: 'customer_payment', other: 'other' };
export const CKBACK: Record<string, string> = { registration_fee: 'tip_onboarding', platform_fee: 'tip_install_fee', care_plan_fee: 'tip_care_plan_fee', customer_payment: 'customer_payment', other: 'other' };
export const uiChargeKind = (k: string) => CK[k] || k;

export const mapCharge = (c: Raw): Charge => ({
  id: S(c.id), ref_code: c.invoice_no || 'CH-' + String(c.id).padStart(6, '0'), kind: CK[c.kind] || c.kind, partner_id: c.payer && c.payer.role !== 'customer' ? S(c.payer_user_id) : null,
  customer_id: c.payer && c.payer.role === 'customer' ? S(c.payer_user_id) : null, payer_user_id: S(c.payer_user_id), lead_id: S(c.lead_id), booking_id: null, description: c.description,
  base_amount: num(c.base_amount), gst_amount: +(num(c.cgst_amount || 0) + num(c.sgst_amount || 0) + num(c.igst_amount || 0)).toFixed(2), amount: num(c.total_amount),
  status: c.status === 'pending' ? 'due' : c.status, gateway: 'razorpay', gateway_order_id: c.razorpay_order_id, gateway_payment_id: c.razorpay_payment_id, paid_via: c.pay_mode,
  paid_at: c.paid_at, created_at: c.created_at, invoice_no: c.invoice_no,
  partner: c.payer && c.payer.role !== 'customer' ? pc(c.payer) : null, customer: c.payer && c.payer.role === 'customer' ? mapUser(c.payer) : null,
});

export const mapTicket = (t: Raw) => ({
  id: S(t.id), ref_code: t.ticket_code as string, customer_id: S(t.raised_by), booking_id: t.lead ? 'lead:' + t.lead_id : null, lead_id: S(t.lead_id), type: 'complaint',
  category: String(t.category || 'other').replace(/_/g, ' '), subject: t.subject as string, description: (t.description || t.subject) as string, status: t.status as string,
  assigned_tip_id: S(t.assigned_to), resolution_note: null, created_at: t.created_at as string, resolved_at: t.resolved_at as string | null, priority: t.priority,
  booking: t.lead
    ? { ref_code: t.lead.ref_code, lead: { name: t.lead.customer_name, phone: t.lead.customer_phone, ref_code: t.lead.ref_code, pincode: t.lead.pincode }, plan: t.lead.plan ? mapPlan({ ...t.lead.plan, id: 0 }) : null }
    : null,
  customer: t.raiser ? { id: S(t.raiser.id), full_name: t.raiser.name, phone: t.raiser.phone } : null,
});
export type Ticket = ReturnType<typeof mapTicket>;

const CS: Record<string, string> = { pending: 'pending', approved: 'approved', paid: 'paid', cancelled: 'rejected' };
export const mapCommission = (c: Raw) => ({
  id: S(c.id), lead_id: S(c.lead_id), partner_id: S(c.dsa_user_id), booking_id: S(c.booking_id), amount: num(c.amount) as number, status: CS[c.status] || c.status,
  payment_id: c.paid_reference ? 'pay-' + c.id : null, created_at: c.created_at as string, paid_at: c.paid_at as string | null, paid_mode: c.paid_mode, paid_reference: c.paid_reference,
  partner: pc(c.dsa), booking: { id: S(c.booking_id), ref_code: c.lead ? c.lead.ref_code : '', lead: c.lead ? { name: c.lead.customer_name, ref_code: c.lead.ref_code, pincode: c.lead.pincode } : null, plan: null },
});
export type Commission = ReturnType<typeof mapCommission>;

export const mapCity = (c: Raw): City => ({ id: S(c.id), name: c.name, district: c.name, tier: 2, status: c.status });

export const settingsOut = (d: Raw): Settings => ({
  registration_fee_tip: num(d.tip_onboarding_fee), gst_percent: num(d.gst_percent), tip_install_fee: num(d.tip_install_fee), care_plan_fee_per_lead: num(d.care_plan_fee_per_lead),
  dsa_payout_per_lead: num(d.dsa_payout_per_lead), tip_job_earning: num(d.tip_job_earning), auto_assign: num(d.auto_assign), lead_target_default: num(d.lead_target_default) || 20, tip_share_percent: 0,
});
export const kv = (rows: Raw[]) => Object.fromEntries(rows.map((r) => [r.key, r.value]));

/* Area names come from the post-office list ("Indore Kumar khadi, Indore"). Show them tidy: no city prefix/suffix,
   no duplicates, at most 4. */
export const tidyAreas = (list: { name?: string }[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of list) {
    const n = String(a.name || '').split(',')[0].replace(/^indore\s+/i, '').replace(/\s+indore$/i, '').trim();
    const k = n.toLowerCase();
    if (!n || seen.has(k)) continue;
    seen.add(k);
    out.push(n.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  return out.length > 4 ? [...out.slice(0, 4), `+${out.length - 4} more`] : out;
};
