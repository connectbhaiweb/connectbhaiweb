/* Connect Bhai · REST data layer. Port of frontend/src/lib/connectbhai/rest.js: the same method names, endpoints,
   bodies, validation, status names and error messages. All ids are handed to the screens as strings and converted
   back to numbers when sent to the API. Native parts (checkout window, saved speed tests, file bytes) are passed in,
   so this file has no native code and can be tested. */
import { SUPPORT } from '../contact';
import { AppError, ROLE_NAME } from './base';
import { checkoutPrefill, type Checkout, type Payer } from './checkout';
import { queryString as qs, type Http, type Query } from './http';
import {
  CATBACK, CKBACK, LSBACK, N, S, assignNote, kv, leadStatusQuery, mapBooking, mapCharge, mapCity, mapCommission, mapDevice, mapLead, mapPartner, mapPlan,
  mapTicket, mapUser, num, pc, providerOf, settingsOut, tidyAreas, uiChargeKind, uiLeadStatus, type Rates,
} from './mappers';
import type { Charge, FullBooking, Lead, LeadEvent, Page, PageFilter, PickedFile, Settings, SpeedRecord, Upload, User } from './types';

type Raw = any;
export type KeyValue = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
export type RestDeps = {
  http: Http;
  checkout: Checkout;
  storage: KeyValue;
  /** turns a picked file into something fetch can send in a form */
  filePart: (file: PickedFile) => unknown;
  fetcher?: typeof fetch;
  wait?: (ms: number) => Promise<unknown>;
};
export type PartnerApplication = {
  type: 'dsa' | 'tip'; name: string; phone: string; email?: string; address: string; pincode: string; city_id: string; firm?: string; gst_number?: string;
  aadhaar: string; pan: string; bank_name: string; bank_account: string; bank_ifsc: string; pincodes?: string; documents?: Record<string, Upload>;
};
export type ConnectionRequest = {
  name: string; phone: string; email?: string; address?: string; pincode: string; plan_id?: string; preferred_date?: string; area?: string; sim?: Record<string, unknown> | null;
};
export type Contact = { role: string; name: string; phone: string; email?: string; firm?: string; id?: string };
export type Thread = { id: string; kind: string; title: string; sub: string; people: Contact[] };
export type ThreadRow = Thread & { last: Raw; unread: number };
export type Message = { id: string; thread: string; sender_id: string; sender_role: string; sender_name: string; body: string; created_at: string };
export type PinInfo = Raw;

const SPEED_KEY = 'cb-speed-tests';

export function createRest(deps: RestDeps) {
  const { http, checkout, storage } = deps;
  const sleep = deps.wait || ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const get = http.get, post = http.post, patch = http.patch, put = http.put, del = http.del;
  const fail = (m: string): never => {
    throw new AppError(m);
  };
  let me: User | null = null;
  const readMark = new Map<string, string>();
  const threadCache = new Map<string, Thread>();
  const bookingCache = new Map<string, FullBooking>();
  const payTokens = new Map<string, string>();
  http.onSignedOut(() => {
    me = null;
  });

  /* A router speed test runs in the background on the server (1-3 min). The POST answers at once with a "running" row;
     this waits by reading the saved row until the server marks it done or failed. */
  const waitSpeedTest = async (deviceId: string | number, row: Raw, maxMs = 6 * 60 * 1000) => {
    let t = row;
    const end = Date.now() + maxMs;
    while (t && t.status === 'running') {
      if (Date.now() > end) fail('The speed test is still running on the server. Check the Care plan screen in a minute.');
      await sleep(4000);
      const x = await get('/care-plan/devices/' + deviceId);
      t = (x.speed_tests || []).find((r: Raw) => String(r.id) === String(row.id)) || t;
      if (t) t = { ...t, simulated: x.simulated };
    }
    if (t && t.status === 'failed') fail(t.error || 'The speed test failed.');
    return t;
  };
  /* follow pagination (limit 100) until everything is loaded */
  async function all(path: string, params?: Query): Promise<{ items: Raw[]; extra: Raw }> {
    const first = await get(path + qs({ ...params, page: 1, limit: 100 }));
    const items = [...(first.items || [])];
    const total = first.total || 0;
    const pages = Math.min(Math.ceil(total / 100), 50);
    if (pages > 1) {
      const more = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => get(path + qs({ ...params, page: i + 2, limit: 100 }))));
      more.forEach((d) => items.push(...(d.items || [])));
    }
    return { items, extra: first };
  }
  const need = (...roles: string[]) => {
    if (!me || !roles.includes(me.role)) fail('You do not have access to this action.');
  };
  /* Per-install amounts come from Admin > Settings (the app_settings table). Nothing is hard-coded here. */
  let rates: Rates = { dsa: 0, tip: 0 };
  let ratesAt = 0;
  const loadRates = async () => {
    if (Date.now() - ratesAt < 30000) return;
    try {
      const d = me && me.role === 'admin' ? kv(await get('/settings')) : await get('/settings/partner');
      rates = { dsa: num(d.dsa_payout_per_lead), tip: num(d.tip_install_fee) };
      ratesAt = Date.now();
    } catch {
      /* keep the last known amounts */
    }
  };
  const startSession = async (d: Raw) => {
    await http.setTokens({ access_token: d.access_token, refresh_token: d.refresh_token });
    me = mapUser(d.user);
    return me;
  };

  /* ---------- Razorpay (the server prices every charge; mock-pay only when the server says "mock") ---------- */
  async function payFlow(id: string | number, tokenForPublic?: string, who?: Payer) {
    const body: Record<string, string> = tokenForPublic ? { payment_token: tokenForPublic } : {};
    const opt = tokenForPublic ? { anon: !me } : undefined;
    const o = await post(`/charges/${id}/pay`, body, opt);
    if (o.mock) {
      await sleep(900);
      return post(`/charges/${id}/mock-pay`, body, opt);
    }
    const res = await checkout({
      key: o.key_id, order_id: o.order_id, amount: o.amount, currency: o.currency, name: 'Connect Bhai', description: 'ConnectBhai fee payment', theme: { color: '#2a55e5' },
      ...checkoutPrefill(who || (me && { name: me.full_name || me.name, phone: me.phone, email: me.email })),
    });
    if (!res?.razorpay_payment_id) fail('Payment failed. Please try again.');
    return post(`/charges/${id}/verify`, { ...body, razorpay_payment_id: res.razorpay_payment_id, razorpay_signature: res.razorpay_signature }, opt); // the paid charge
  }

  const devices = async (): Promise<Raw[]> => {
    try {
      return (await all('/care-plan/devices')).items;
    } catch {
      return [];
    }
  };
  const deviceFor = async (bookingId: string) => {
    const b = bookingCache.get(String(bookingId));
    if (!b) fail('Connection not found.');
    const d = (await devices()).find((x) => String(x.lead_id) === String(b!.lead_id));
    if (!d) fail('This modem is not on the Care plan yet. Ask the installer to enable Care Plan for this connection.');
    return d;
  };
  const localSpeed = async (): Promise<SpeedRecord[]> => {
    try {
      return JSON.parse((await storage.getItem(SPEED_KEY)) || '[]');
    } catch {
      return [];
    }
  };
  const keepBooking = (b: Raw, devs: Raw[]) => {
    const out = mapBooking(b, devs);
    bookingCache.set(out.id, out);
    return out;
  };
  const page = <T>(d: Raw, map: (x: Raw) => T): Page<T> => ({ items: d.items.map(map), total: d.total, page: d.page, limit: d.limit });
  const noPage = (f: PageFilter): Page<never> => ({ items: [], total: 0, page: 1, limit: f.limit || 10 });
  const notice = (n: Raw) => ({ id: n.id, to_phone: n.phone || '', template: n.template, params: n.payload ? Object.values(n.payload).map(String) : [], status: n.status, simulated: n.status !== 'sent', created_at: n.created_at, sent_at: n.created_at });

  const api = {
    mode: 'rest' as const,
    /** The saved login, or null. */
    async init() {
      if (!(await http.loadTokens())) return null;
      try {
        me = mapUser(await get('/users/me'));
      } catch (e) {
        // Forget the login only when the server refused it. With no network the tokens stay for next time.
        if (e instanceof Error && e.message === 'Please log in again.') await http.setTokens(null);
        me = null;
      }
      return me;
    },
    me: () => me,
    async signOut() {
      await http.setTokens(null);
      me = null;
    },

    /* ---- auth ---- */
    async sendOtp(phone: string, role?: string) {
      await post('/auth/otp/request', { phone, role: role || undefined }, { anon: true });
      return { channel: 'whatsapp' };
    },
    /* role "customer" is passed when the OTP is only to confirm a connection request */
    async verifyOtp(phone: string, code: string, name?: string, role?: string) {
      return startSession(await post('/auth/otp/verify', { phone, code, name: name || undefined, role: role || undefined }, { anon: true }));
    },
    async signInPassword(phone: string, password: string) {
      return startSession(await post('/auth/login', { phone, password }, { anon: true }));
    },
    async changePassword() {
      fail('Partners and customers sign in with a WhatsApp OTP. Admin passwords are set by the system owner.');
    },
    async setMyName(n: string) {
      me = { ...me!, ...mapUser(await patch('/users/me', { name: n.trim() })) };
      return me;
    },
    async setMyProfile(f: { name: string; email?: string }) {
      me = { ...me!, ...mapUser(await patch('/users/me', { name: f.name.trim(), email: f.email || undefined })) };
      return me;
    },

    /* ---- public ---- */
    async catalog(category: string) {
      const t = CATBACK[category];
      if (!t) return [];
      return (await all('/plans', { type: t })).items.map(mapPlan);
    },
    async searchPlans(pin: string, category?: string) {
      const t = CATBACK[category || 'fiber'];
      const info = await get('/pincodes/' + pin, { anon: true });
      const plans = t ? (await all('/plans', { pincode: pin, type: t })).items.map(mapPlan) : [];
      return { areas: tidyAreas(info.areas || []), plans, serviceable: info.serviceable, city: info.city };
    },
    async popularPins() {
      const r = await get('/cities/1/areas', { anon: true }).catch(() => []);
      const by = new Map<string, { pin: string; area: string; city_id: string }>();
      (Array.isArray(r) ? r : []).forEach((a: Raw) => {
        if (!by.has(a.pincode)) by.set(a.pincode, { pin: a.pincode, area: a.name.split(',')[0], city_id: '1' });
      });
      return [...by.values()].slice(0, 8);
    },
    async cities() {
      return ((await get('/cities', { anon: true })) as Raw[]).map(mapCity);
    },
    /** every PIN code we serve, with its area and city (for PIN suggestions); public, cached by the API */
    async pinDirectory(): Promise<{ pin: string; area: string; city: string }[]> {
      const cs = ((await get('/cities', { anon: true })) as Raw[]).filter((c) => ['live', 'soon'].includes(c.status));
      const rows = await Promise.all(
        cs.map((c) => get(`/cities/${c.id}/areas`, { anon: true }).then((a: Raw[]) => a.map((x) => ({ pin: x.pincode, area: x.name, city: c.name }))).catch(() => [])),
      );
      return rows.flat();
    },
    async joinWaitlist(f: { consent: boolean; city_id: string; phone: string; name: string }) {
      if (!f.consent) fail('Please agree so we can message you at launch.');
      const r = await post('/waitlist', { city_id: Number(f.city_id), phone: f.phone, name: f.name }, { anon: true });
      return { city: r.city as string, waiting: 0 };
    },
    async requestConnection(f: ConnectionRequest) {
      const sim = f.sim ? `SIM request: ${JSON.stringify(f.sim)}` : '';
      const l = await post('/leads', {
        customer_name: f.name.trim(), customer_phone: f.phone, customer_email: f.email || undefined, address: f.address || undefined, pincode: f.pincode, plan_id: N(f.plan_id),
        source: f.plan_id ? 'website' : 'callback',
        notes: [f.preferred_date ? 'Preferred date: ' + f.preferred_date : '', f.area ? 'Area: ' + f.area : '', sim].filter(Boolean).join(' | ') || undefined,
      });
      // the server renamed the account to the name on this request
      if (me && me.role === 'customer' && f.name.trim() && me.full_name !== f.name.trim()) me = { ...me, full_name: f.name.trim(), name: f.name.trim() };
      return { lead_id: S(l.id) as string, ref_code: l.ref_code as string };
    },
    async applyPartner(f: PartnerApplication) {
      const d = await post('/partners/register', {
        role: f.type, name: f.name.trim(), phone: f.phone, email: f.email || undefined, address: f.address, pincode: f.pincode, city_id: N(f.city_id), business_name: f.firm || undefined,
        gst_number: f.gst_number || undefined, aadhaar: f.aadhaar, pan: f.pan, bank_name: f.bank_name, bank_account: f.bank_account, bank_ifsc: f.bank_ifsc,
        service_pincodes: (f.pincodes || '').split(',').map((x) => x.trim()).filter(Boolean), documents: f.documents || undefined,
      }, { anon: true });
      const charge = d.charge ? mapCharge(d.charge) : null;
      if (charge && d.payment_token) payTokens.set(charge.id, d.payment_token);
      return { partner_id: S(d.user.id) as string, charge };
    },
    async payPublicCharge(id: string, _method?: string, who?: Payer) {
      const paid = await payFlow(id, payTokens.get(String(id)), who);
      if (paid && paid.session) await startSession(paid.session); // a new TIP who just paid is logged in
      return mapCharge(paid);
    },

    /* ---- leads ---- */
    async myLeads() {
      need('customer');
      return (await all('/leads')).items.map(mapLead);
    },
    async partnerLeads() {
      need('dsa', 'tip');
      return (await all('/leads')).items.map(mapLead);
    },
    async adminLeads(f?: { status?: string }) {
      need('admin');
      return (await all('/leads', f && f.status ? leadStatusQuery(f.status) : undefined)).items.map(mapLead);
    },
    async adminBadges() {
      need('admin');
      return get('/reports/badges');
    },
    async leadDetail(id: string): Promise<Lead & { events: LeadEvent[] }> {
      const [l, ev] = await Promise.all([get('/leads/' + id), get(`/leads/${id}/events`)]);
      return {
        ...mapLead(l),
        events: (ev as Raw[]).map((e) => {
          const as = e.event_type === 'assigned' ? assignNote(e.note) : null;
          return {
            id: S(e.id), lead_id: S(e.lead_id), from_status: uiLeadStatus(e.from_status), to_status: (as ? as.to : uiLeadStatus(e.to_status)) as string,
            note: as ? as.note : e.note || String(e.event_type || '').replace(/_/g, ' '), created_at: e.created_at, actor_name: e.actor && e.actor.name,
          };
        }),
      };
    },
    async updateLeadStatus(id: string, status: string, note?: string, next?: string) {
      if (status === 'follow_up' && !next) fail('Choose a follow-up date.');
      await patch(`/leads/${id}/status`, {
        status: LSBACK[status] || status, note: note || undefined, followup_at: next ? new Date(next + 'T09:00:00').toISOString() : undefined,
        lost_reason: status === 'lost' ? note || undefined : undefined,
      });
      return true;
    },
    /* A lead is assigned to a DSA first (admin, before it is booked); once booked, admin or the lead's DSA assigns the TIP who installs it. */
    async assignLead(id: string, dsa?: string | null, tip?: string | null, ids?: { telephone_no: string; order_no: string }) {
      need('admin', 'dsa');
      const b: Record<string, string | number> = {};
      if (dsa) b.dsa_user_id = Number(dsa);
      if (tip) {
        b.tip_user_id = Number(tip);
        if (ids) {
          b.telephone_no = ids.telephone_no;
          b.order_no = ids.order_no;
        }
      }
      await patch(`/leads/${id}/assign`, b);
      return true;
    },
    /* approved TIPs, those covering the lead's PIN first */
    async tipOptions(id: string) {
      need('admin', 'dsa');
      return ((await get(`/leads/${id}/tip-options`)) as Raw[]).map((t) => ({ id: S(t.id) as string, name: t.name as string, firm: (t.business_name || '') as string, covers_pin: !!t.covers_pin, internal: !!t.is_internal }));
    },
    async dsaAddLead(f: { consent: boolean; name: string; phone: string; address?: string; pincode: string; plan_id?: string; area?: string }) {
      need('dsa');
      if (!f.consent) fail('Confirm the customer agreed to be contacted.');
      const l = await post('/leads', { customer_name: f.name.trim(), customer_phone: f.phone, address: f.address || undefined, pincode: f.pincode, plan_id: N(f.plan_id), notes: f.area ? 'Area: ' + f.area : undefined });
      return { ref_code: l.ref_code as string, tip: (l.tip ? l.tip.name : null) as string | null };
    },
    async dsaActivateSim() {
      fail('SIM and OTT activation is not part of the installation workflow in this version.');
    },
    async setAutoAssign(on: boolean) {
      need('admin');
      await put('/settings/auto_assign', { value: on ? '1' : '0' });
      return true;
    },

    /* ---- server-side aggregates + pages ---- */
    async dashboard(o?: { months?: number; pins?: number }) {
      const d = await get('/reports/dashboard' + qs({ months: o && o.months, pins: o && o.pins }));
      const L = d.leads || {}, B = d.bookings || {};
      return {
        ...d,
        leads: { new: L.new || 0, contacted: L.contacted || 0, follow_up: L.followup || 0, booked: L.scheduled || 0, installed: L.installed || 0, lost: (L.lost || 0) + (L.cancelled || 0) },
        bookings: { scheduled: (B.scheduled || 0) + (B.rescheduled || 0), installed: B.completed || 0, cancelled: B.cancelled || 0 },
        commission: { pending: 0, approved: 0, paid: 0, ...(d.commission || {}), rejected: (d.commission || {}).cancelled || 0 },
        charges: d.charges || {}, charges_count: d.charges_count || {},
      };
    },
    async partnerTotals() {
      need('admin');
      const d = await get('/reports/partners');
      const m = (r: Raw) => ({ leads: r.total, leads_month: r.leads_month || 0, installs: r.installs || 0, paid_amount: r.paid_amount || 0, paid_count: r.paid_count || 0, comm_paid: r.comm_paid || 0, comm_count: r.comm_count || 0 });
      return { tip: Object.fromEntries((d.tips as Raw[]).map((r) => [S(r.user_id), m(r)])), dsa: Object.fromEntries((d.dsas as Raw[]).map((r) => [S(r.user_id), m(r)])) };
    },
    async money(o?: { months?: number }) {
      need('admin');
      const d = await get('/reports/money' + qs({ months: o && o.months }));
      return { ...d, by_kind: Object.fromEntries(Object.entries(d.by_kind || {}).map(([k, v]) => [uiChargeKind(k), v])) };
    },
    async payables() {
      need('admin');
      return ((await get('/reports/payables')) as Raw[]).map((x) => ({ partner_id: S(x.dsa_user_id) as string, partner: { id: S(x.dsa_user_id) as string, name: x.name as string, type: 'dsa' }, count: x.count as number, total: x.total as number, ids: (x.ids as Raw[]).map(S) as string[] }));
    },
    async customerSummaries(ids: string[]) {
      need('admin');
      if (!ids.length) return {};
      const rows = (await get('/reports/customers' + qs({ ids: ids.join(',') }))) as Raw[];
      return Object.fromEntries(rows.map((r) => [S(r.customer_user_id), { requests: r.requests as number, latest: r.latest ? mapLead(r.latest) : null }]));
    },
    /* One page of a list, filtered by the server. f is in the screens' status names. */
    async pageLeads(f: PageFilter = {}) {
      const p: Query = {
        page: f.page || 1, limit: f.limit || 10, statuses: f.status === 'tobook' ? 'contacted,followup' : undefined,
        ...(f.status && !['all', 'open', 'due', 'tobook'].includes(f.status) ? leadStatusQuery(f.status) : {}),
        q: f.q, open: f.status === 'open' ? 1 : undefined, unassigned: f.unassigned || f.status === 'new' ? 1 : undefined, due: f.status === 'due' ? 1 : undefined, sort: f.sort, pincode: f.pincode,
      };
      return page(await get('/leads' + qs(p)), mapLead);
    },
    async pageBookings(f: PageFilter = {}) {
      if (f.device === 'reboots') return noPage(f); // restart counts are not reported by the API yet
      const d = await get('/bookings' + qs({
        page: f.page || 1, limit: f.limit || 10, status: f.status && f.status !== 'all' ? (f.status === 'installed' ? 'completed' : f.status) : undefined, q: f.q,
        scheduled_from: f.from, scheduled_to: f.to, device: ['offline', 'weak', 'unlinked'].includes(f.device || '') ? f.device : undefined,
      }));
      const dv = f.devices && (d.items as Raw[]).some((x) => x.lead && x.lead.care_plan)
        ? (await get('/care-plan/devices' + qs({ lead_ids: (d.items as Raw[]).map((x) => x.lead_id).join(','), limit: 100 })).catch(() => ({ items: [] }))).items
        : []; // modem rows of just this page
      return page(d, (b) => keepBooking(b, dv));
    },
    async pageTickets(f: PageFilter = {}) {
      const d = await get('/tickets' + qs({ page: f.page || 1, limit: f.limit || 10, status: f.status && !['all', 'open_all'].includes(f.status) ? f.status : undefined, open: f.status === 'open_all' ? 1 : undefined, q: f.q }));
      return page(d, mapTicket);
    },
    async pageCharges(f: PageFilter = {}): Promise<Page<Charge>> {
      if (me && me.role === 'dsa') return noPage(f);
      const d = await get('/charges' + qs({
        page: f.page || 1, limit: f.limit || 10, status: f.status && f.status !== 'all' ? (f.status === 'due' ? 'pending' : f.status) : undefined,
        kind: f.kind ? CKBACK[f.kind] || f.kind : undefined, q: f.q,
      }));
      return page(d, mapCharge);
    },
    async pageCommissions(f: PageFilter = {}) {
      if (me && me.role === 'tip') return noPage(f);
      const d = await get('/commissions' + qs({ page: f.page || 1, limit: f.limit || 10, status: f.status && f.status !== 'all' ? (f.status === 'rejected' ? 'cancelled' : f.status) : undefined, q: f.q, lead_ids: f.lead_ids }));
      return page(d, mapCommission);
    },
    async pageCustomers(f: PageFilter = {}) {
      need('admin');
      return page(await get('/users' + qs({ role: 'customer', page: f.page || 1, limit: f.limit || 10, q: f.q })), mapUser);
    },
    /* admin logins: one role at a time (admin / dsa / tip / customer) */
    async pageTeam(f: PageFilter = {}) {
      need('admin');
      const d = await get('/users' + qs({ role: f.role || undefined, page: f.page || 1, limit: f.limit || 10, q: f.q }));
      return page(d, (u) => ({ ...mapUser(u), partner: ['dsa', 'tip'].includes(u.role) ? pc(u) : null, pw_set_at: null }));
    },
    async pageMessages(f: PageFilter = {}) {
      need('admin');
      const d = await get('/notifications' + qs({ page: f.page || 1, limit: f.limit || 10, q: f.q }));
      return page({ ...d, items: d.items || [] }, notice);
    },
    async getLead(id: string) {
      return mapLead(await get('/leads/' + id));
    },
    async getPartner(id: string) {
      need('admin');
      await loadRates();
      return mapPartner(await get('/users/' + id), rates);
    },
    async getBooking(id: string) {
      return keepBooking(await get('/bookings/' + id), []);
    },
    /* partners of one kind ("dsa" | "tip"); status uses the screen names (active / pending / suspended) */
    async pagePartners(f: PageFilter = {}) {
      need('admin');
      const ps = f.status && f.status !== 'all' ? ({ active: 'approved', suspended: 'suspended', pending: 'pending', rejected: 'rejected' } as Record<string, string>)[f.status] : undefined;
      await loadRates();
      const d = await get('/users' + qs({ role: f.type, partner_status: ps, page: f.page || 1, limit: f.limit || 10, q: f.q }));
      return page(d, (u) => mapPartner(u, rates));
    },

    /* ---- bookings ---- */
    /* modem data is only fetched when at least one booking is on the Care plan */
    async bookingsWithDevices() {
      const b = await all('/bookings');
      const dv = b.items.some((x) => x.lead && x.lead.care_plan) ? await devices() : [];
      return b.items.map((x) => keepBooking(x, dv));
    },
    async myBookings() {
      need('customer');
      return api.bookingsWithDevices();
    },
    async partnerBookings() {
      need('tip', 'dsa');
      return api.bookingsWithDevices();
    },
    async adminBookings() {
      need('admin');
      return api.bookingsWithDevices();
    },
    async createBooking(leadId: string, date: string) {
      if (!date) fail('Choose a date.');
      const when = new Date(date + 'T18:00:00');
      if (when.getTime() < Date.now()) fail('Choose today or a future date.');
      const b = await post('/bookings', { lead_id: Number(leadId), scheduled_at: when.toISOString() });
      return 'BK-' + String(b.id).padStart(6, '0');
    },
    async updateBookingStatus(id: string, status: string, connRef?: string, ont?: string) {
      if (status === 'installed') {
        if (!(connRef || '').trim()) fail('Enter the connection reference to mark as installed.');
        await post(`/bookings/${id}/complete`, { connection_id: connRef!.trim(), router_serial: (ont || '').trim().toUpperCase() || undefined });
      } else if (status === 'cancelled') await patch('/bookings/' + id, { status: 'cancelled' });
      else if (status === 'in_progress') await post(`/bookings/${id}/start`); // tells the customer the technician has started
      else fail('This status change is not supported.');
      return true;
    },

    /* ---- tickets ---- */
    async myTickets() {
      need('customer');
      return (await all('/tickets')).items.map(mapTicket);
    },
    async partnerTickets() {
      need('tip');
      return (await all('/tickets')).items.map(mapTicket);
    },
    async adminTickets() {
      need('admin');
      return (await all('/tickets')).items.map(mapTicket);
    },
    async raiseTicket(f: { booking_id?: string | null; type?: string; description?: string; category?: string }) {
      const b = f.booking_id ? bookingCache.get(String(f.booking_id)) : null;
      if (!b && f.type === 'complaint') fail('Choose the connection for a complaint.');
      if (!f.description || f.description.trim().length < 5) fail('Describe the issue in a few words.');
      const cat = String(f.category || 'other').toLowerCase().replace(/[^a-z]+/g, '_');
      const cats = ['no_internet', 'slow_speed', 'billing', 'shifting', 'other'];
      const text = f.description!.trim();
      const t = await post('/tickets', { lead_id: b ? Number(b.lead_id) : undefined, category: cats.includes(cat) ? cat : 'other', subject: text.slice(0, 150), description: text });
      return t.ticket_code as string;
    },
    async updateTicket(id: string, status: string) {
      await patch('/tickets/' + id, { status });
      return true;
    },

    /* ---- money ---- */
    async myCharges(): Promise<Charge[]> {
      if (me && me.role === 'dsa') return []; // a DSA pays no charges and the API refuses /charges for DSAs
      return (await all('/charges')).items.map(mapCharge);
    },
    async adminCharges() {
      need('admin');
      return (await all('/charges')).items.map(mapCharge);
    },
    /* TIP (or admin) adds Care Plan to one lead, then pays the charge */
    async carePlanCharge(leadId: string) {
      need('tip', 'admin');
      const c = await post('/charges/care-plan', { lead_ids: [Number(leadId)] });
      const t = me!.role === 'admin' ? ((await get('/leads/' + Number(leadId)).catch(() => null)) || {}).tip : null;
      const paid = await payFlow(c.id, undefined, t ? { name: t.name, phone: t.phone } : undefined);
      return mapCharge(await get('/charges/' + c.id).catch(() => paid));
    },
    async payCharge(id: string) {
      const paid = await payFlow(id);
      return mapCharge(await get('/charges/' + id).catch(() => paid));
    },
    /* the server prices it from the lead's plan */
    async customerPay(f: { lead_id: string }) {
      need('customer');
      return mapCharge(await post('/charges/customer', { lead_id: Number(f.lead_id) }));
    },
    async markLeadPaid(leadId: string, reference?: string) {
      if (!me || !['admin', 'tip'].includes(me.role)) fail('Only admin or the installing TIP can mark a payment.');
      await post(`/leads/${leadId}/payment/offline`, { reference: (reference || '').trim() || undefined });
      return true;
    },
    async adminCreateCharge(f: { payer_type: string; partner_id?: string; customer_id?: string; kind: string; description: string; base: string | number }) {
      need('admin');
      const payer = f.payer_type === 'partner' ? f.partner_id : f.customer_id;
      if (!payer) fail('Choose who pays.');
      const c = await post('/charges', { payer_user_id: Number(payer), kind: CKBACK[f.kind] || 'other', description: f.description.trim(), base_amount: Number(f.base) });
      return mapCharge(c).ref_code;
    },
    async adminSetCharge(id: string, action: string, reference?: string) {
      need('admin');
      if (action === 'paid_offline') {
        if (!(reference || '').trim()) fail('Enter the payment reference.');
        await post(`/charges/${id}/offline`, { reference: reference!.trim() });
      } else if (action === 'waived') await post(`/charges/${id}/waive`);
      else if (action === 'cancelled') await post(`/charges/${id}/cancel`);
      else fail('Unknown action.');
      return true;
    },
    async myCommissions() {
      need('dsa', 'tip');
      if (me!.role !== 'dsa') return [];
      return (await all('/commissions')).items.map(mapCommission);
    },
    async adminCommissions() {
      need('admin');
      return (await all('/commissions')).items.map(mapCommission);
    },
    async setCommission(id: string, status: string) {
      need('admin');
      await post(`/commissions/${id}/${status === 'approved' ? 'approve' : 'cancel'}`);
      return true;
    },
    async recordPayment(partnerId: string, ids: string[], method: string, reference: string) {
      need('admin');
      if (!(reference || '').trim()) fail('Enter the payment reference (UTR / cheque no.).');
      const mode = ['upi', 'bank', 'cash', 'other'].includes(method) ? method : 'other';
      let total = 0;
      for (const id of ids) {
        const c = await post(`/commissions/${id}/pay`, { mode, reference: reference.trim() });
        total += num(c.amount) || 0;
      }
      return { id: String(Date.now()), partner_id: String(partnerId), amount: total, method: mode, reference: reference.trim(), paid_at: new Date().toISOString() };
    },
    async adminPayments() {
      need('admin');
      const r = (await all('/commissions', { status: 'paid' })).items;
      return r.map((c) => ({ id: S(c.id) as string, partner_id: S(c.dsa_user_id) as string, partner: pc(c.dsa), amount: num(c.amount) as number, method: c.paid_mode, reference: c.paid_reference, paid_at: c.paid_at }));
    },
    async getSettings(): Promise<Settings> {
      try {
        if (me && me.role === 'admin') return settingsOut(kv(await get('/settings')));
        if (me && (me.role === 'dsa' || me.role === 'tip')) return settingsOut({ ...(await get('/settings/public', { anon: true })), ...(await get('/settings/partner')) });
      } catch {
        /* fall through */
      }
      return settingsOut(await get('/settings/public', { anon: true }));
    },
    /* every money setting is a row in the app_settings table; only the values passed in are saved */
    async saveSettings(o: Record<string, string | number | undefined>) {
      need('admin');
      const m: Record<string, string> = { registration_fee_tip: 'tip_onboarding_fee', tip_install_fee: 'tip_install_fee', care_plan_fee_per_lead: 'care_plan_fee_per_lead', dsa_payout_per_lead: 'dsa_payout_per_lead', tip_job_earning: 'tip_job_earning', gst_percent: 'gst_percent', lead_target_default: 'lead_target_default' };
      const todo = Object.entries(m).filter(([k]) => o[k] !== undefined);
      for (const [k] of todo) {
        const x = Number(o[k]);
        if (o[k] === '' || !(x >= 0)) fail('Enter 0 or more.');
        if (k === 'gst_percent' && x > 100) fail('GST cannot be more than 100.');
      }
      for (const [k, v] of todo) await put('/settings/' + v, { value: String(Number(o[k])) });
      ratesAt = 0; // the per-install amounts on the partner screens follow what was just saved
      return true;
    },

    /* ---- people ---- */
    async myPartner() {
      need('dsa', 'tip');
      await loadRates();
      return mapPartner(await get('/users/me'), rates);
    },
    async adminPartners(f?: { partner_status?: string }) {
      need('admin');
      await loadRates();
      const ps = f && f.partner_status ? { partner_status: f.partner_status } : {};
      const [a, b] = await Promise.all([all('/users', { role: 'dsa', ...ps }), all('/users', { role: 'tip', ...ps })]);
      return [...a.items, ...b.items].map((u) => mapPartner(u, rates)).sort((x, y) => Number(y.id) - Number(x.id)); // newest first
    },
    async adminCustomers() {
      need('admin');
      return (await all('/users', { role: 'customer' })).items.map(mapUser);
    },
    async adminTeam() {
      need('admin');
      return (await all('/users')).items.filter((u) => u.role !== 'customer').map((u) => ({ ...mapUser(u), partner: ['dsa', 'tip'].includes(u.role) ? pc(u) : null, pw_set_at: null }));
    },
    async savePartner(f: { id?: string; type: string; name: string; firm?: string; phone: string; email?: string; address?: string; pincode?: string; service_pincodes?: string }) {
      need('admin');
      if (!f.id) fail('Partners join through the public registration form; approve them in the partner list.');
      const body: Record<string, unknown> = { name: f.name.trim(), business_name: f.firm || '', phone: f.phone, email: f.email || '', address: f.address || '', pincode: f.pincode || '' };
      if (f.type === 'dsa') body.service_pincodes = (f.service_pincodes || '').split(/[,\s]+/).filter(Boolean); // the PIN codes a DSA serves
      await patch(`/users/${N(f.id)}`, body); // any status
      return true;
    },
    async approvePartner(id: string) {
      need('admin');
      await patch(`/users/${id}/partner-status`, { status: 'approved' });
      return true;
    },
    async setPartnerStatus(id: string, status: string) {
      need('admin');
      await patch(`/users/${id}/partner-status`, { status: status === 'active' ? 'approved' : 'suspended' });
      return true;
    },
    async adminCreateUser(f: { role: string }) {
      need('admin');
      if (f.role !== 'admin') fail('DSA and TIP partners register through the public form (KYC and bank details are required), then admin approves them here.');
      fail('Admin accounts are created by the system owner with a password.');
    },
    async adminResetPassword() {
      fail('Partners and customers sign in with a WhatsApp OTP, so there is no password to reset.');
    },
    /** customer, DSA or TIP; the phone must match the account; nothing blocks it */
    async deleteMyAccount() {
      await del('/users/me', { phone: me!.phone });
      await http.setTokens(null);
      me = null;
      return true;
    },
    async deletePartner(id: string) {
      need('admin');
      await del('/users/' + id); // any status; their leads stay
      return true;
    },
    /* admin: details of a lead in any status */
    async updateLead(id: string, f: { name: string; phone: string; email?: string; address?: string; pincode: string; notes?: string; connection_ref?: string; ont_serial?: string; area_id?: string | null }) {
      need('admin');
      const b: Record<string, unknown> = { customer_name: f.name.trim(), customer_phone: f.phone, customer_email: f.email || '', address: f.address || '', pincode: f.pincode, notes: f.notes || '' };
      if (f.connection_ref !== undefined) b.connection_id = f.connection_ref;
      if (f.ont_serial !== undefined) b.router_serial = f.ont_serial;
      if (f.area_id !== undefined) b.area_id = f.area_id ? N(f.area_id) : null;
      await patch(`/leads/${N(id)}`, b);
      return true;
    },
    async deleteLead(id: string) {
      need('admin');
      await del(`/leads/${N(id)}`); // any status
      return true;
    },
    async adminSetDisabled(id: string, off: boolean) {
      need('admin');
      if (String(id) === String(me!.id)) fail('You cannot disable your own login.');
      await patch(`/users/${id}/active`, { is_active: !off });
      return true;
    },

    /* ---- catalogue / locations (admin) ---- */
    async adminProviders() {
      need('admin');
      const c = await get('/plan-categories?include_inactive=true').catch(() => get('/plan-categories'));
      return ((Array.isArray(c) ? c : c.items || []) as Raw[]).map((x) => providerOf(x)!);
    },
    async saveProvider(f: { id?: string; name: string }) {
      need('admin');
      const body = { name: f.name.trim(), type: 'fiber' };
      if (f.id) await patch('/plan-categories/' + f.id, { name: body.name });
      else await post('/plan-categories', body);
      return true;
    },
    async toggleProvider(id: string) {
      need('admin');
      const c = ((await get('/plan-categories')) as Raw[]).find((x) => String(x.id) === String(id));
      await patch('/plan-categories/' + id, { is_active: !(c && c.is_active !== false) });
      return true;
    },
    async adminPlans() {
      need('admin');
      return (await all('/plans', { include_inactive: true, sort: 'newest' })).items.map(mapPlan);
    },
    async savePlan(f: Record<string, string | undefined>) {
      need('admin');
      if (!f.provider_id) fail('Choose a provider.');
      if (!f.name || f.name.trim().length < 2) fail('Enter the plan name.');
      const body = {
        category_id: Number(f.provider_id), name: f.name!.trim(), speed_mbps: Number(f.speed_mbps) > 0 ? Number(f.speed_mbps) : undefined, price: Number(f.price_monthly),
        validity_days: Number(f.validity_days) || undefined, data_limit: f.data_limit_gb ? f.data_limit_gb + ' GB' : undefined, install_charge: Number(f.install_charge) || 0, tv_channels: Number(f.tv_channels) || undefined,
      };
      if (!(body.price >= 0)) fail('Enter a valid price.');
      if (f.id) await patch('/plans/' + f.id, body);
      else {
        if (!f.plan_code) fail('Enter a plan code.');
        await post('/plans', { ...body, plan_code: f.plan_code!.trim().toUpperCase() });
      }
      return true;
    },
    async togglePlan(id: string) {
      need('admin');
      const p = (await all('/plans', { include_inactive: true })).items.find((x) => String(x.id) === String(id));
      await patch('/plans/' + id, { is_active: !(p && p.is_active) });
      return true;
    },
    async adminImportPlans() {
      fail('Bulk plan upload is not part of this version. Add plans one by one, or load them through the seed data.');
    },
    async tipProviders() {
      return [];
    },
    async tipPlans() {
      return { live: [], mine: [] };
    },
    async tipSubmitPlans() {
      fail('Price-sheet upload is not part of this version. Ask Connect Bhai admin to update plans.');
    },
    async adminReviewPlan() {
      fail('There are no plan submissions to review in this version.');
    },
    async adminLocations() {
      need('admin');
      const [areas, maps] = (await Promise.all([get('/cities/1/areas'), get('/admin/tip-pincodes')])) as [Raw[], Raw[]];
      return areas.slice().sort((x, y) => y.id - x.id).map((a) => ({
        id: S(a.id) as string, pincode: a.pincode as string, area: a.name as string, city: 'Indore', zone: null,
        coverage: maps.filter((m) => m.pincode === a.pincode).map((m) => ({ id: S(m.id) as string, location_id: S(a.id) as string, provider_id: 'all', provider: { id: 'all', name: 'All providers' }, tip_partner_id: S(m.tip_user_id) as string, tip: pc(m.tip), technology: 'ftth', is_active: m.is_active })),
      }));
    },
    async saveLocation(f: { city_id?: string; area: string; pincode: string }) {
      need('admin');
      await post(`/cities/${N(f.city_id) || 1}/areas`, { name: f.area.trim(), pincode: f.pincode });
      return true;
    },
    async deleteLocation(id: string) {
      need('admin');
      await del(`/areas/${N(id)}`); // any state; leads that point to it just lose the area
      return true;
    },
    async updateLocation(id: string, name: string) {
      need('admin');
      await patch(`/areas/${N(id)}`, { name: String(name || '').trim() }); // rename only; the PIN code stays
      return true;
    },
    async saveLocationZone() {
      fail('Zones are not used any more.');
    },
    async saveCoverage(f: { location_id: string; tip_partner_id?: string }) {
      need('admin');
      const loc = (await api.adminLocations()).find((l) => String(l.id) === String(f.location_id));
      if (!loc) fail('Choose the area.');
      if (!f.tip_partner_id) fail('Choose the TIP partner.');
      await post('/admin/tip-pincodes', { pincode: loc!.pincode, tip_user_id: Number(f.tip_partner_id) });
      return true;
    },
    async removeCoverage(id: string) {
      need('admin');
      await del('/admin/tip-pincodes/' + id);
      return true;
    },
    async geoReverse(lat: number, lng: number) {
      const r = await get(`/locations/reverse${qs({ lat, lng })}`, { anon: true });
      return { pincode: r.pincode as string, area: r.area as string, city: r.city };
    },
    async pinLookupMany(list: string[]): Promise<PinInfo> {
      return get(`/locations/pincodes${qs({ codes: list.join(',') })}`, { anon: true });
    },
    async addAreasBulk(cityId: string | undefined, areas: unknown[]) {
      need('admin');
      return post(`/cities/${N(cityId) || 1}/areas/bulk`, { areas });
    },
    async partnerDocs(id: string) {
      need('admin');
      return get(`/users/${id}/documents`);
    },
    /* Every upload goes to Cloudinary: our server signs the request (the API secret stays there), then the file goes straight to Cloudinary. */
    async uploadFile(file: PickedFile, purpose: string): Promise<Upload> {
      const sg = await post('/uploads/sign', { purpose }, { anon: !me });
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!sg.allowed_formats.split(',').includes(ext)) fail('Allowed file types: ' + sg.allowed_formats.split(',').join(', ').toUpperCase() + '.');
      if (file.size > sg.max_bytes) fail(`${file.name} is too large (maximum ${Math.round(sg.max_bytes / 1048576)} MB).`);
      const fd = new FormData();
      Object.entries({ file: deps.filePart(file), api_key: sg.api_key, timestamp: sg.timestamp, signature: sg.signature, folder: sg.folder, type: sg.type, allowed_formats: sg.allowed_formats })
        .forEach(([k, v]) => fd.append(k, v as any));
      let r: Response;
      try {
        r = await (deps.fetcher || fetch)(sg.upload_url, { method: 'POST', body: fd });
      } catch {
        return fail('Could not reach the file server. Check your internet and try again.');
      }
      const j: Raw = await r.json().catch(() => ({}));
      if (!r.ok) fail((j.error && j.error.message) || 'Upload failed. Please try again.');
      return { public_id: j.public_id, version: j.version, signature: j.signature, format: j.format, resource_type: j.resource_type, bytes: j.bytes };
    },
    async pinLookup(pin: string): Promise<PinInfo> {
      return get(`/locations/pincode/${pin}`, { anon: true });
    },
    async geoAreas(pin: string) {
      const i = await get('/pincodes/' + pin, { anon: true });
      return { areas: ((i.areas || []) as Raw[]).map((a) => ({ name: a.name as string, district: i.city ? i.city.name : '', state: 'Madhya Pradesh' })) };
    },

    /* ---- cities / waitlist ---- */
    async adminCities() {
      need('admin');
      const [c, w] = (await Promise.all([get('/cities'), get('/waitlist/summary')])) as [Raw[], Raw[]]; // counts only
      return c.map((x) => {
        const s = w.find((r) => String(r.city_id) === String(x.id));
        return { ...mapCity(x), waiting: s ? s.waiting : 0, notified: s ? s.notified : 0, partners: 0, pins: 0 };
      });
    },
    async adminWaitlist() {
      need('admin');
      return (await all('/waitlist')).items.map((r) => ({ id: S(r.id) as string, city_id: S(r.city_id) as string, name: r.name || '', phone: r.phone as string, pincode: null, interest: null, status: r.notified_at ? 'notified' : 'waiting', created_at: r.created_at, notified_at: r.notified_at }));
    },
    async adminLaunchCity(id: string) {
      need('admin');
      await patch('/cities/' + id, { status: 'live' });
      return (await post('/waitlist/notify/' + id)).notified;
    },
    async adminSetCityStatus(id: string, status: string) {
      need('admin');
      await patch('/cities/' + id, { status });
      return true;
    },
    async adminAddCity(f: { name?: string }) {
      need('admin');
      const c = await post('/cities', { name: (f.name || '').trim() });
      return S(c.id) as string;
    },
    async adminNotifications() {
      need('admin');
      return (((await get('/notifications' + qs({ page: 1, limit: 100 }))).items || []) as Raw[]).map(notice);
    },

    /* ---- chat ---- */
    async myThreads(): Promise<ThreadRow[]> {
      const rows = (await get('/chat/threads')) as Raw[];
      const out: ThreadRow[] = [];
      for (const t of rows) {
        const id = (t.type === 'lead' ? 'lead:' : 'sup:') + t.id;
        let info: Thread;
        if (t.type === 'lead') {
          const l = t.lead;
          info = { id, kind: 'lead', title: t.title, sub: t.sub, people: [{ role: 'customer', name: l.customer_name, phone: l.customer_phone, email: l.customer_email || '' }, l.dsa && { ...pc(l.dsa), role: 'dsa' }, l.tip && { ...pc(l.tip), role: 'tip' }, SUPPORT].filter(Boolean) as Contact[] };
        } else info = { id, kind: 'sup', title: t.title, sub: t.sub, people: me!.role === 'admin' && t.user ? [{ role: t.user.role, name: t.user.name, phone: t.user.phone, email: '' }] : [SUPPORT] };
        threadCache.set(id, info);
        out.push({ ...info, last: t.last ? { ...t.last, id: S(t.last.id), sender_id: S(t.last.sender_user_id) } : null, unread: t.unread });
      }
      return out;
    },
    async threadMessages(id: string): Promise<{ thread: Thread; messages: Message[] }> {
      const [kind, key] = String(id).split(':');
      const type = kind === 'lead' ? 'lead' : 'support';
      const msgs = (await get(`/chat/${type}/${key}/messages`)) as Raw[];
      const newest = msgs.length ? String(msgs[msgs.length - 1].id) : '';
      if (readMark.get(id) !== newest) {
        readMark.set(id, newest);
        await post(`/chat/${type}/${key}/read`).catch(() => {}); // the 10 s refresh only calls /read when something new arrived
      }
      if (!threadCache.has(id)) await api.myThreads();
      return {
        thread: threadCache.get(id) || { id, kind, title: 'Chat', sub: '', people: [SUPPORT] },
        messages: msgs.map((m) => ({ id: S(m.id), thread: id, sender_id: S(m.sender_user_id), sender_role: m.sender ? m.sender.role : '', sender_name: m.sender ? m.sender.name : '', body: m.body, created_at: m.created_at })),
      };
    },
    async sendMessage(id: string, body: string): Promise<Message> {
      body = (body || '').trim();
      if (!body) fail('Type a message.');
      if (body.length > 1000) fail('Message is too long (1000 characters max).');
      const [kind, key] = String(id).split(':');
      const m = await post(`/chat/${kind === 'lead' ? 'lead' : 'support'}/${key}/messages`, { body });
      return { id: S(m.id), thread: id, sender_id: S(m.sender_user_id), sender_role: me!.role, sender_name: me!.full_name, body: m.body, created_at: m.created_at };
    },

    /* ---- Care plan (modem) ---- */
    async refreshDevice(bookingId: string) {
      const d = await deviceFor(bookingId);
      const r = await post(`/care-plan/devices/${d.id}/refresh`);
      return { ...mapDevice(r.device || r), booking_id: String(bookingId) };
    },
    async deviceAction(bookingId: string, action: string, p: { ssid?: string; password?: string } = {}) {
      const d = await deviceFor(bookingId);
      if (action === 'wifi' && !(p.ssid || p.password)) fail('Enter a new Wi-Fi name, a new password, or both.');
      await post(`/care-plan/devices/${d.id}/actions`, { action: action === 'wifi' ? 'change_wifi' : action, params: action === 'wifi' ? { ssid: p.ssid || undefined, password: p.password || undefined } : undefined });
      return mapDevice(await get('/care-plan/devices/' + d.id));
    },
    async deviceLog(bookingId: string) {
      const d = await deviceFor(bookingId);
      const x = await get('/care-plan/devices/' + d.id);
      return ((x.actions || []) as Raw[]).slice(0, 6).map((a) => ({ id: S(a.id) as string, booking_id: String(bookingId), action: a.action === 'change_wifi' ? 'wifi' : (a.action as string), detail: a.detail || a.error || null, by_name: a.actor ? a.actor.name : 'System', status: a.status || 'done', error: a.error || null, simulated: true, created_at: a.created_at as string }));
    },
    async speedTests(bookingId: string): Promise<SpeedRecord[]> {
      const mine = async () => (await localSpeed()).filter((t) => t.booking_id === String(bookingId));
      try {
        const d = await deviceFor(bookingId);
        const x = await get('/care-plan/devices/' + d.id);
        const dev: SpeedRecord[] = ((x.speed_tests || []) as Raw[]).map((t) => ({ id: S(t.id), booking_id: String(bookingId), kind: 'router', status: t.status || 'done', error: t.error || null, download_mbps: num(t.download_mbps), upload_mbps: num(t.upload_mbps), ping_ms: t.ping_ms, jitter_ms: null, is_simulated: !!x.simulated, created_at: t.created_at }));
        return [...dev, ...(await mine())].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6);
      } catch {
        return (await mine()).slice(0, 6);
      }
    },
    async recordSpeedTest(bookingId: string | null, r: { down: number; up: number; ping: number; jit: number; simulated?: boolean }) {
      if (!me) fail('Log in to save results.');
      const t: SpeedRecord = { id: 'local-' + Date.now(), booking_id: bookingId ? String(bookingId) : null, user_id: me!.id, kind: 'browser', status: 'done', download_mbps: +r.down.toFixed(2), upload_mbps: +r.up.toFixed(2), ping_ms: Math.round(r.ping), jitter_ms: Math.round(r.jit), is_simulated: !!r.simulated, created_at: new Date().toISOString() };
      try {
        await storage.setItem(SPEED_KEY, JSON.stringify([t, ...(await localSpeed())].slice(0, 50)));
      } catch {
        /* ignore */
      }
      return t;
    },
    async routerTest(bookingId: string, onQueued?: () => void) {
      const d = await deviceFor(bookingId);
      if (onQueued) onQueued();
      const t = await waitSpeedTest(d.id, await post(`/care-plan/devices/${d.id}/speed-test`));
      return { id: S(t.id) as string, booking_id: String(bookingId), kind: 'router', status: 'done', download_mbps: num(t.download_mbps), upload_mbps: num(t.upload_mbps), ping_ms: t.ping_ms, is_simulated: !!t.simulated, created_at: t.created_at };
    },
    /* Recent commands of one modem by device id (Care plan list progress box) */
    async deviceActsById(id: string) {
      const x = await get('/care-plan/devices/' + id);
      return ((x.actions || []) as Raw[]).slice(0, 6).map((a) => ({ id: S(a.id) as string, action: a.action === 'change_wifi' ? 'wifi' : (a.action as string), status: a.status || 'done', error: a.error || null, created_at: a.created_at as string }));
    },
    /* Restart or change Wi-Fi by device id (the Care plan list). Same endpoint the customer screen uses. */
    async deviceActById(id: string, action: string, params?: Record<string, string | undefined>) {
      await post(`/care-plan/devices/${id}/actions`, { action, ...(params ? { params } : {}) });
      return true;
    },
    async deviceRefresh(id: string) {
      const r = await post(`/care-plan/devices/${id}/refresh`);
      return mapDevice(r.device || r);
    },
    async deviceRouterTest(id: string, onAccepted?: (row: Raw) => void) {
      let row: Raw;
      try {
        row = await post(`/care-plan/devices/${id}/speed-test`);
      } catch (e) {
        // a test is already running on this modem: follow that one instead of failing
        if (!/already running/i.test((e as Error)?.message || '')) throw e;
        const x = await get('/care-plan/devices/' + id);
        row = ((x.speed_tests || []) as Raw[]).find((r) => r.status === 'running');
        if (!row) throw e;
      }
      if (onAccepted) onAccepted(row);
      const t = await waitSpeedTest(id, row);
      return { status: 'done', download_mbps: num(t.download_mbps), upload_mbps: num(t.upload_mbps), ping_ms: t.ping_ms, is_simulated: !!t.simulated };
    },
    /* real modems for the Care plan list screens (one page of up to 100) */
    async carePlanDevices() {
      const d = await get('/care-plan/devices' + qs({ page: 1, limit: 100 }));
      const q = (v: number) => (v >= -25 ? 'Good' : v >= -27 ? 'Weak' : 'Bad');
      return ((d.items || []) as Raw[]).map((x) => {
        const rx = num(x.rx_power_dbm);
        return {
          id: S(x.id) as string, serialNumber: (x.serial_number || '') as string, manufacturer: '', model: (x.model || 'Modem') as string, firmwareVersion: '—',
          customer: { userId: null, name: ((x.lead && x.lead.customer_name) || '') as string, mobile: '' }, status: (x.online == null ? 'unknown' : x.online ? 'online' : 'offline') as 'online' | 'offline' | 'unknown',
          linked: !!(x.genieacs_device_id || x.serial_number), active: x.is_active !== false, live: x.source === 'zabbix' || !!(x.genieacs_device_id || x.last_seen_at), statusOnly: x.source === 'zabbix', lastInform: (x.last_seen_at || null) as string | null,
          wifi: { ssid: (x.wifi_ssid || '—') as string, band: '', channel: '—', connectedDevices: (x.connected_clients == null ? 0 : x.connected_clients) as number, speedMbps: num(x.speed_mbps) },
          signal: { quality: rx == null ? 'Bad' : q(rx), rxPowerDbm: rx }, ip: null, uptimeSeconds: 0, partner: {},
        };
      });
    },
    /* admin "Fetch routers": refresh every linked modem now, then list every modem the server knows */
    async carePlanFetchAcs() {
      need('admin');
      const polled = await post('/care-plan/poll').catch(() => null);
      const d = await get('/care-plan/acs-devices');
      return { polled, ...d };
    },
    async carePlanLinkCandidates() {
      need('admin');
      return (await get('/care-plan/link-candidates')).items || [];
    },
    async carePlanLink(recordId: string, acsDevice: { source?: string; serial?: string; id?: string; model?: string }) {
      need('admin');
      await patch(`/care-plan/devices/${recordId}`, acsDevice.source === 'zabbix'
        ? { serial_number: acsDevice.serial } // a Zabbix ONU is matched by its serial only
        : { genieacs_device_id: acsDevice.id, ...(acsDevice.serial ? { serial_number: acsDevice.serial } : {}), ...(acsDevice.model ? { model: acsDevice.model } : {}) });
      await post(`/care-plan/devices/${recordId}/refresh`).catch(() => null); // fill in its status straight away
      return true;
    },
    async carePlanSummary() {
      const d = await get('/care-plan/summary');
      return { ...d, zones: d.zones || [] };
    },
    async adminAcs() {
      need('admin');
      const [p, sm] = await Promise.all([api.adminPartners(), get('/care-plan/summary')]);
      return p.filter((x) => x.type === 'tip').map((x) => ({ ...x, linked: (sm.tips || {})[x.id] || 0 }));
    },
    async saveAcs() {
      fail('Genie is configured on the server (GENIEACS_NBI_URL), not per partner.');
    },
  };
  return api;
}
export type Api = ReturnType<typeof createRest>;
export { ROLE_NAME };
