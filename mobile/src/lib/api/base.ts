/* Port of frontend/src/lib/connectbhai/base.js: shared helpers, labels and constants.
   (The web's HTML escape helper is not needed: native text is never parsed as markup.) */

export const inr = (n: number | string | null | undefined) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const fdate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fdt = (d?: string | null) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
export const uuid = () => 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
export const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
export const isPhone = (v: string) => /^[6-9]\d{9}$/.test(v);
export const isPin = (v: string) => /^[1-9]\d{5}$/.test(v);
export const nowISO = () => new Date().toISOString();
export class AppError extends Error {}
export const fail = (m: string): never => {
  throw new AppError(m);
};

type Labels = Record<string, string>;
export const LEAD: Labels = { new: 'New', assigned: 'Assigned', contacted: 'Contacted', follow_up: 'Follow-up', booked: 'Booked', installed: 'Installed', lost: 'Lost' };
export const LEAD_TONE: Labels = { new: 'blue', assigned: 'blue', contacted: 'warn', follow_up: 'warn', booked: 'blue', installed: 'ok', lost: 'bad' };
export const LEAD_NEXT: Record<string, string[]> = { new: ['lost'], assigned: ['contacted', 'follow_up', 'lost'], contacted: ['follow_up', 'lost'], follow_up: ['contacted', 'follow_up', 'lost'], lost: ['follow_up'], booked: [], installed: [] };
export const BOOK: Labels = { scheduled: 'Scheduled', in_progress: 'Installation in progress', installed: 'Installed', cancelled: 'Cancelled' };
export const BOOK_TONE: Labels = { scheduled: 'blue', in_progress: 'warn', installed: 'ok', cancelled: 'bad' };
/* The API goes scheduled → completed directly (the web changes this list when the REST layer starts). */
export const BOOK_NEXT: Record<string, string[]> = { scheduled: ['installed', 'cancelled'], in_progress: ['installed', 'cancelled'], installed: [], cancelled: [] };
export const TICKET: Labels = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
export const TICKET_TONE: Labels = { open: 'bad', in_progress: 'warn', resolved: 'ok', closed: 'grey' };
export const COMM: Labels = { pending: 'Pending', approved: 'Approved', paid: 'Paid', rejected: 'Rejected' };
export const COMM_TONE: Labels = { pending: 'warn', approved: 'blue', paid: 'ok', rejected: 'bad' };

/* Indore district: Indore tehsil = city, split into 5 zones; Sanwer, Depalpur and Mhow tehsils = rural. */
export const ZONES = [
  { id: 'nehru_park', name: 'Nehru Park', kind: 'city' }, { id: 'meghdoot_park', name: 'Meghdoot Park', kind: 'city' },
  { id: 'transport_nagar', name: 'Transport Nagar', kind: 'city' }, { id: 'pologround', name: 'Pologround', kind: 'city' },
  { id: 'bengali_chouraha', name: 'Bengali Chouraha', kind: 'city' },
  { id: 'sanwer', name: 'Sanwer', kind: 'rural' }, { id: 'depalpur', name: 'Depalpur', kind: 'rural' }, { id: 'mhow', name: 'Mhow', kind: 'rural' },
];
export const ZONE_NAME: Labels = Object.fromEntries(ZONES.map((z) => [z.id, z.name]));
export const ZONE_BY_PIN: Labels = {
  '452001': 'nehru_park', '452002': 'nehru_park', '452003': 'nehru_park', '452007': 'nehru_park', '452010': 'meghdoot_park', '452011': 'meghdoot_park',
  '452009': 'transport_nagar', '452018': 'transport_nagar', '452015': 'pologround', '452006': 'pologround', '452016': 'bengali_chouraha',
  '453551': 'sanwer', '453115': 'depalpur', '453441': 'mhow',
};
export const KIND: Labels = { bsnl_tip: 'BSNL TIP (FTTH)', telco: 'Telecom operator', local_isp: 'Local ISP' };

/* Madhya Pradesh: all 55 districts. tier 1 = big cities (shown first). */
export const MP_CITIES: [string, string, number][] = [
  ['indore', 'Indore', 1], ['bhopal', 'Bhopal', 1], ['jabalpur', 'Jabalpur', 1], ['gwalior', 'Gwalior', 1], ['ujjain', 'Ujjain', 1],
  ['sagar', 'Sagar', 2], ['dewas', 'Dewas', 2], ['satna', 'Satna', 2], ['ratlam', 'Ratlam', 2], ['rewa', 'Rewa', 2], ['katni', 'Katni', 2], ['singrauli', 'Singrauli', 2],
  ['burhanpur', 'Burhanpur', 2], ['khandwa', 'Khandwa', 2], ['chhindwara', 'Chhindwara', 2], ['morena', 'Morena', 2], ['bhind', 'Bhind', 2], ['guna', 'Guna', 2],
  ['shivpuri', 'Shivpuri', 2], ['vidisha', 'Vidisha', 2], ['mandsaur', 'Mandsaur', 2], ['neemuch', 'Neemuch', 2], ['khargone', 'Khargone', 2], ['dhar', 'Dhar', 2],
  ['narmadapuram', 'Narmadapuram', 2], ['agar_malwa', 'Agar Malwa', 3], ['alirajpur', 'Alirajpur', 3], ['anuppur', 'Anuppur', 3], ['ashoknagar', 'Ashoknagar', 3],
  ['balaghat', 'Balaghat', 3], ['barwani', 'Barwani', 3], ['betul', 'Betul', 3], ['chhatarpur', 'Chhatarpur', 3], ['damoh', 'Damoh', 3], ['datia', 'Datia', 3],
  ['dindori', 'Dindori', 3], ['harda', 'Harda', 3], ['jhabua', 'Jhabua', 3], ['maihar', 'Maihar', 3], ['mandla', 'Mandla', 3], ['mauganj', 'Mauganj', 3],
  ['narsinghpur', 'Narsinghpur', 3], ['niwari', 'Niwari', 3], ['pandhurna', 'Pandhurna', 3], ['panna', 'Panna', 3], ['raisen', 'Raisen', 3], ['rajgarh', 'Rajgarh', 3],
  ['sehore', 'Sehore', 3], ['seoni', 'Seoni', 3], ['shahdol', 'Shahdol', 3], ['shajapur', 'Shajapur', 3], ['sheopur', 'Sheopur', 3], ['sidhi', 'Sidhi', 3],
  ['tikamgarh', 'Tikamgarh', 3], ['umaria', 'Umaria', 3],
];
export const citySlug = (n?: string | null) => String(n || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
export const cityIdOfLoc = (l: { zone?: string | null; city?: string | null }) => (l.zone ? 'indore' : citySlug(l.city || 'Indore'));
export const CATS: Labels = { fiber: 'Fiber broadband', air_fiber: 'Air Fiber', tv: 'TV', ott: 'OTT pack', sim_prepaid: 'SIM · Prepaid', sim_postpaid: 'SIM · Postpaid' };
export const productOf = (cat?: string | null) => (cat && ['sim_prepaid', 'sim_postpaid'].includes(cat) ? 'sim' : cat === 'fiber' || !cat ? 'broadband' : cat);
export const PRODUCT_NAME: Labels = { broadband: 'Fiber broadband', air_fiber: 'Air Fiber', tv: 'TV', ott: 'OTT', sim: 'SIM' };
export const SHEET_COLS = ['plan_code', 'category', 'provider', 'plan_name', 'speed_mbps', 'price', 'validity_days', 'data_limit_gb', 'data_per_day_gb', 'voice', 'sms_per_day', 'ott_apps', 'tv_channels', 'install_charge', 'source_url', 'verified', 'active', 'notes'];

export function planFromRow(r: Record<string, unknown>, providerId: string) {
  const num = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? null : Number(v));
  const cat = String(r.category || '').trim();
  if (!CATS[cat]) fail(`Unknown category "${r.category}" (${r.plan_code || r.plan_name || 'row'}).`);
  const name = String(r.plan_name || '').trim();
  if (name.length < 2) fail(`Plan name missing (${r.plan_code || 'row'}).`);
  const price = num(r.price);
  if (price === null || !(price >= 0)) fail(`Invalid price (${r.plan_code || name}).`);
  const speed = num(r.speed_mbps);
  if (['fiber', 'air_fiber'].includes(cat) && !(speed! > 0)) fail(`Speed needed for ${cat} (${r.plan_code || name}).`);
  return {
    provider_id: providerId, category: cat, plan_code: String(r.plan_code || '').trim().toUpperCase() || null, name, speed_mbps: speed, price_monthly: price,
    validity_days: num(r.validity_days) || 30, data_limit_gb: num(r.data_limit_gb), data_per_day_gb: num(r.data_per_day_gb), voice: String(r.voice || '').trim() || null,
    sms_per_day: num(r.sms_per_day), ott_apps: String(r.ott_apps || '').split(',').map((x) => x.trim()).filter(Boolean), tv_channels: num(r.tv_channels) || 0,
    install_charge: num(r.install_charge) || 0, source_url: String(r.source_url || '').trim(), notes: String(r.notes || '').trim(),
  };
}

export const PW_RULE = 'At least 8 characters, with a letter and a number.';
export const pwOk = (p: unknown) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

/* From shared.js */
export type Role = 'customer' | 'dsa' | 'tip' | 'admin';
export const ROLE_HOME = { customer: 'my', dsa: 'dsa', tip: 'tip', admin: 'admin' } as const;
export const ROLE_NAME: Record<Role, string> = { customer: 'Customer', dsa: 'DSA', tip: 'TIP', admin: 'Administrator' };
export const ROLE_NAV_LABEL: Record<Role, string> = { customer: 'My dashboard', dsa: 'DSA portal', tip: 'TIP portal', admin: 'Admin portal' };
export const initials = (s?: string | null) => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
