/* Connect Bhai API client. Same REST API as the website (see frontend/src/lib/connectbhai/rest.js):
   same endpoints, bodies and token refresh. Nothing here changes the backend. */
import * as SecureStore from 'expo-secure-store';

import { API_URL } from './config';

export type Role = 'customer' | 'dsa' | 'tip' | 'admin';

export interface User { id: number; role: Role; name: string; phone: string; email?: string | null; partner_status?: string | null; partner_code?: string | null }
export interface Plan {
  id: number; name: string; plan_code?: string; price: number | string; price_ex_gst?: number | string | null; speed_mbps?: number | null;
  install_charge?: number | string | null; data_limit?: string | null; validity_days?: number | null; tv_channels?: number | null;
  ott_apps?: (string | { name: string })[]; category?: { name: string; type: string; logo_url?: string | null } | null;
}
export interface Person { id: number; name: string; business_name?: string | null; phone?: string | null }
export interface Lead {
  id: number; ref_code: string; customer_name: string; customer_phone: string; pincode: string; address?: string | null;
  status: string; plan?: Plan | null; area?: { name: string } | null; dsa?: Person | null; tip?: Person | null;
  created_at: string; followup_at?: string | null; booking?: Booking | null; notes?: string | null; lost_reason?: string | null;
}
export interface Booking { id: number; lead_id: number; status: string; scheduled_at?: string | null; completed_at?: string | null; connection_id?: string | null; lead?: Lead }
export interface Ticket { id: number; ticket_code: string; category: string; subject: string; description?: string | null; status: string; created_at: string; lead?: Lead | null }
export interface Charge { id: number; invoice_no?: string | null; kind: string; description: string; total_amount: number | string; status: string; created_at: string; paid_at?: string | null }
export interface Commission { id: number; amount: number | string; status: string; created_at: string; lead?: { customer_name: string; ref_code: string } | null }
export interface Thread { id: number; type: 'lead' | 'support'; title: string; sub?: string; unread: number; last?: { body: string; created_at: string } | null }
export interface Message { id: number; sender_user_id: number; body: string; created_at: string; sender?: { name: string; role: string } }
export interface Device { id: number; lead_id: number; online: boolean | null; wifi_ssid?: string | null; rx_power_dbm?: number | string | null; model?: string | null; connected_clients?: number | null; last_seen_at?: string | null }
export interface LeadEvent { id: number; to_status?: string; event_type?: string; note?: string | null; created_at: string; actor?: { name: string } | null }

export interface City { id: number; name: string; status: string }
export interface PartnerForm {
  role: 'dsa' | 'tip'; name: string; phone: string; email: string; address: string; pincode: string; city_id: number; business_name?: string; gst_number?: string;
  aadhaar: string; pan: string; bank_name: string; bank_account: string; bank_ifsc: string; service_pincodes: string[]; documents?: Record<string, unknown>;
}
export interface PickedFile { uri: string; name: string; mimeType?: string; size?: number }

export class ApiError extends Error {}

const TOKEN_KEY = 'cb-tokens';
interface Tokens { access_token: string; refresh_token: string }
let tokens: Tokens | null = null;

export async function loadTokens() {
  try { tokens = JSON.parse((await SecureStore.getItemAsync(TOKEN_KEY)) || 'null'); } catch { tokens = null; }
  return tokens;
}
async function saveTokens(t: Tokens | null) {
  tokens = t;
  try { if (t) await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(t)); else await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* storage unavailable */ }
}
export const hasTokens = () => !!tokens;

const messageOf = (b: any) => (b && (Array.isArray(b.message) ? b.message.join(' · ') : b.message)) || 'Something went wrong. Please try again.';

async function raw(method: string, path: string, body?: unknown, access?: string | null) {
  let r: Response;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);   // never leave the screen spinning forever
  try {
    r = await fetch(API_URL + path, {
      signal: ctl.signal,
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(access ? { authorization: 'Bearer ' + access } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the Connect Bhai server. Check your internet connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try { data = await r.json(); } catch { /* empty body */ }
  return { r, data };
}

async function refresh() {
  if (!tokens?.refresh_token) return false;
  const { r, data } = await raw('POST', '/auth/refresh', { refresh_token: tokens.refresh_token });
  if (!r.ok) { await saveTokens(null); return false; }
  await saveTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
  return true;
}

let onSignedOut: (() => void) | null = null;
export const setSignedOutHandler = (fn: () => void) => { onSignedOut = fn; };

async function send<T>(method: string, path: string, body?: unknown, anon = false): Promise<T> {
  let { r, data } = await raw(method, path, body, anon ? null : tokens?.access_token);
  if (r.status === 401 && !anon && tokens && (await refresh())) ({ r, data } = await raw(method, path, body, tokens!.access_token));
  if (!r.ok) {
    if (r.status === 401 && !anon) { onSignedOut?.(); throw new ApiError('Please log in again.'); }
    throw new ApiError(r.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : messageOf(data));
  }
  return data as T;
}

const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v != null && v !== '' && p.append(k, String(v)));
  const s = p.toString();
  return s ? '?' + s : '';
};
/* The API pages at 100 items; follow the pages until everything is loaded (same as the website). */
async function all<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T[]> {
  const first = await send<{ items: T[]; total: number }>('GET', path + qs({ ...params, page: 1, limit: 100 }));
  const items = [...(first.items || [])];
  const pages = Math.min(Math.ceil((first.total || 0) / 100), 50);
  for (let p = 2; p <= pages; p++) items.push(...(await send<{ items: T[] }>('GET', path + qs({ ...params, page: p, limit: 100 }))).items);
  return items;
}

export const api = {
  /* auth */
  sendOtp: (phone: string) => send('POST', '/auth/otp/request', { phone }, true),
  async verifyOtp(phone: string, code: string, name?: string) {
    const d = await send<Tokens & { user: User }>('POST', '/auth/otp/verify', { phone, code, name: name || undefined }, true);
    await saveTokens({ access_token: d.access_token, refresh_token: d.refresh_token });
    return d.user;
  },
  async loginPassword(phone: string, password: string) {
    const d = await send<Tokens & { user: User }>('POST', '/auth/login', { phone, password }, true);
    await saveTokens({ access_token: d.access_token, refresh_token: d.refresh_token });
    return d.user;
  },
  me: () => send<User>('GET', '/users/me'),
  signOut: () => saveTokens(null),

  /* leads, bookings */
  leads: () => all<Lead>('/leads'),
  lead: (id: number) => send<Lead>('GET', '/leads/' + id),
  leadEvents: (id: number) => send<LeadEvent[]>('GET', `/leads/${id}/events`),
  updateLeadStatus: (id: number, status: string, note?: string, followupDate?: string) =>
    send('PATCH', `/leads/${id}/status`, { status, note: note || undefined, followup_at: followupDate ? new Date(followupDate + 'T09:00:00').toISOString() : undefined, lost_reason: status === 'lost' ? note || undefined : undefined }),
  addLead: (f: { name: string; phone: string; pincode: string; address?: string }) =>
    send<Lead>('POST', '/leads', { customer_name: f.name.trim(), customer_phone: f.phone, address: f.address || undefined, pincode: f.pincode }),
  bookings: () => all<Booking>('/bookings'),
  createBooking: (leadId: number, date: string) => send('POST', '/bookings', { lead_id: leadId, scheduled_at: new Date(date + 'T18:00:00').toISOString() }),
  completeBooking: (id: number, connectionId: string, routerSerial?: string) =>
    send('POST', `/bookings/${id}/complete`, { connection_id: connectionId.trim(), router_serial: routerSerial?.trim().toUpperCase() || undefined }),
  cancelBooking: (id: number) => send('PATCH', '/bookings/' + id, { status: 'cancelled' }),

  /* public: find plans for a PIN code and request a connection (same calls as the website home page) */
  popularPins: async () => {
    const r = await send<{ pincode: string; name: string }[]>('GET', '/cities/1/areas', undefined, true).catch(() => []);
    const by = new Map<string, { pin: string; area: string }>();
    (Array.isArray(r) ? r : []).forEach(a => { if (!by.has(a.pincode)) by.set(a.pincode, { pin: a.pincode, area: a.name.split(',')[0] }); });
    return [...by.values()].slice(0, 6);
  },
  geoReverse: (lat: number, lng: number) => send<{ pincode: string; area?: string }>('GET', `/locations/reverse${qs({ lat, lng })}`, undefined, true),
  /* plans for a PIN code, by product type: fiber | airfiber | tv | ott (same query as the website) */
  plansForPin: (pin: string, type = 'fiber') => all<Plan>('/plans', { pincode: pin, type }),
  pincode: (pin: string) => send<{ serviceable: boolean; city?: { name: string }; areas?: { name: string }[] }>('GET', '/pincodes/' + pin, undefined, true),
  requestConnection: (f: { name: string; phone: string; pincode: string; address?: string; planId?: number }) =>
    send<Lead>('POST', '/leads', { customer_name: f.name.trim(), customer_phone: f.phone, address: f.address || undefined, pincode: f.pincode, plan_id: f.planId, source: f.planId ? 'website' : 'callback' }),

  /* public: cities, waiting list, DSA / TIP application (same calls as the website) */
  cities: () => send<City[]>('GET', '/cities', undefined, true),
  joinWaitlist: (f: { cityId: number; phone: string; name: string }) => send<{ city: string }>('POST', '/waitlist', { city_id: f.cityId, phone: f.phone, name: f.name }, true),
  applyPartner: (f: PartnerForm) => send<{ user: User; charge?: Charge; payment_token?: string }>('POST', '/partners/register', f, true),
  async payPublicCharge(id: number, token: string) {
    const o = await send<{ mock?: boolean }>('POST', `/charges/${id}/pay`, { payment_token: token }, true);
    if (!o.mock) throw new ApiError('Online payment opens in the next update. Please pay the fee on the Connect Bhai website.');
    await send('POST', `/charges/${id}/mock-pay`, { payment_token: token }, true);
  },
  /* uploads go straight to Cloudinary with a request our server signs (the secret stays on the server) */
  async uploadFile(file: PickedFile, purpose: string, anon = true) {
    const sg = await send<{ upload_url: string; api_key: string; timestamp: number; signature: string; folder: string; type: string; allowed_formats: string; max_bytes: number }>('POST', '/uploads/sign', { purpose }, anon && !tokens);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!sg.allowed_formats.split(',').includes(ext)) throw new ApiError('Allowed file types: ' + sg.allowed_formats.split(',').join(', ').toUpperCase() + '.');
    if (file.size && file.size > sg.max_bytes) throw new ApiError(`${file.name} is too large (maximum ${Math.round(sg.max_bytes / 1048576)} MB).`);
    const fd = new FormData();
    fd.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
    (['api_key', 'timestamp', 'signature', 'folder', 'type', 'allowed_formats'] as const).forEach(k => fd.append(k, String(sg[k])));
    let r: Response;
    try { r = await fetch(sg.upload_url, { method: 'POST', body: fd }); } catch { throw new ApiError('Could not reach the file server. Check your internet and try again.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(j?.error?.message || 'Upload failed. Please try again.');
    return { public_id: j.public_id, version: j.version, signature: j.signature, format: j.format, resource_type: j.resource_type, bytes: j.bytes };
  },

  /* tickets */
  tickets: () => all<Ticket>('/tickets'),
  raiseTicket: (f: { leadId?: number; category: string; description: string }) =>
    send<Ticket>('POST', '/tickets', { lead_id: f.leadId, category: f.category, subject: f.description.trim().slice(0, 150), description: f.description.trim() }),
  updateTicket: (id: number, status: string) => send('PATCH', '/tickets/' + id, { status }),

  /* money */
  charges: () => all<Charge>('/charges'),
  async payCharge(id: number) {
    const o = await send<{ mock?: boolean }>('POST', `/charges/${id}/pay`, {});
    if (!o.mock) throw new ApiError('Online payment opens in the next update. Please pay on the Connect Bhai website for now.');
    await send('POST', `/charges/${id}/mock-pay`, {});
  },
  commissions: () => all<Commission>('/commissions'),

  /* chat */
  threads: () => send<Thread[]>('GET', '/chat/threads'),
  messages: async (type: 'lead' | 'support', id: number) => {
    const m = await send<Message[]>('GET', `/chat/${type}/${id}/messages`);
    send('POST', `/chat/${type}/${id}/read`).catch(() => {});
    return m;
  },
  sendMessage: (type: 'lead' | 'support', id: number, body: string) => send<Message>('POST', `/chat/${type}/${id}/messages`, { body: body.trim() }),

  /* care plan (modem) */
  devices: async () => { try { return await all<Device>('/care-plan/devices'); } catch { return []; } },
  deviceDetail: (id: number) => send<{ speed_tests?: { download_mbps: number | string; created_at: string }[] }>('GET', `/care-plan/devices/${id}`),
  refreshDevice: (id: number) => send('POST', `/care-plan/devices/${id}/refresh`),
  deviceAction: (id: number, action: 'reboot' | 'change_wifi', params?: { ssid?: string; password?: string }) => send('POST', `/care-plan/devices/${id}/actions`, { action, params }),
};
