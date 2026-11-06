/* Connect Bhai · REST data layer (NestJS + MySQL).
   Same method names and result shapes as the Demo / Supabase layers in api.js, so the screens in ui.js and the
   dashboards work unchanged. All ids are handed to the UI as strings (they travel through data-id attributes) and
   converted back to numbers when sent to the API. Configure with NEXT_PUBLIC_API_URL (see .env.example). */
import { API_URL, SUPPORT } from "./config";

const TOKEN_KEY = "cb-tokens";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const S = v => (v == null ? v : String(v));
const N = v => (v == null || v === "" ? undefined : Number(v));
const num = v => (v == null ? v : Number(v));

export function createRest({ AppError, BOOK_NEXT, ROLE_NAME }) {
  const fail = m => { throw new AppError(m); };
  let me = null, tokens = null;
  const threadCache = new Map(), bookingCache = new Map(), payTokens = new Map();

  /* ---------- tokens + HTTP ---------- */
  const loadTokens = () => { try { tokens = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null"); } catch (e) { tokens = null; } return tokens; };
  const saveTokens = t => { tokens = t; getCache.clear(); try { t ? localStorage.setItem(TOKEN_KEY, JSON.stringify(t)) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* private mode */ } };
  const msgOf = b => (b && (Array.isArray(b.message) ? b.message.join(" · ") : b.message)) || "Something went wrong. Please try again.";

  async function raw(method, path, body, access) {
    let r;
    try {
      r = await fetch(API_URL + path, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(access ? { authorization: "Bearer " + access } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) { throw new AppError("Cannot reach the Connect Bhai server. Check that the API is running."); }
    let data = null; try { data = await r.json(); } catch (e) { /* empty body */ }
    return { r, data };
  }
  async function refresh() {
    if (!tokens || !tokens.refresh_token) return false;
    const { r, data } = await raw("POST", "/auth/refresh", { refresh_token: tokens.refresh_token });
    if (!r.ok) { saveTokens(null); me = null; return false; }
    saveTokens({ access_token: data.access_token, refresh_token: data.refresh_token }); return true;
  }
  /* Speed: identical GETs made at the same time share one request, and recent answers are reused for a few seconds
     (tab switches, re-renders). Any write clears the cache. Chat, notifications and live device data are never reused. */
  const getCache = new Map(), GET_TTL = 8000, NO_CACHE = /\/(chat|messages|notifications|devices|care)/;
  function req(method, path, body, opt) {
    if (method !== "GET") { getCache.clear(); return send(method, path, body, opt); }
    if (NO_CACHE.test(path)) return send(method, path, body, opt);
    const key = (tokens && tokens.access_token ? "u:" : "a:") + path, hit = getCache.get(key);
    if (hit && Date.now() - hit.t < GET_TTL) return hit.p;
    const p = send(method, path, body, opt); getCache.set(key, { p, t: Date.now() });
    p.catch(() => getCache.delete(key));
    return p;
  }
  async function send(method, path, body, opt) {
    opt = opt || {};
    let { r, data } = await raw(method, path, body, opt.anon ? null : tokens && tokens.access_token);
    if (r.status === 401 && !opt.anon && tokens && await refresh()) ({ r, data } = await raw(method, path, body, tokens.access_token));
    if (!r.ok) throw new AppError(r.status === 401 && !opt.anon ? "Please log in again." : r.status === 429 ? "Too many attempts. Please wait a minute and try again." : msgOf(data));
    return data;
  }
  const get = (p, o) => req("GET", p, undefined, o), post = (p, b, o) => req("POST", p, b || {}, o), patch = (p, b) => req("PATCH", p, b || {}), put = (p, b) => req("PUT", p, b || {}), del = p => req("DELETE", p);
  const qs = o => { const p = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => v != null && v !== "" && p.append(k, v)); const s = p.toString(); return s ? "?" + s : ""; };
  async function all(path, params) {   // follow pagination (limit 100) until everything is loaded
    const first = await get(path + qs({ ...params, page: 1, limit: 100 })), items = [...(first.items || [])], total = first.total || 0;
    const pages = Math.min(Math.ceil(total / 100), 50);
    if (pages > 1) { const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => get(path + qs({ ...params, page: i + 2, limit: 100 })))); rest.forEach(d => items.push(...(d.items || []))); }
    return { items, extra: first };
  }
  const need = (...roles) => { if (!me || !roles.includes(me.role)) fail("You do not have access to this action."); };

  /* ---------- mappers: API → UI shapes ---------- */
  const mapUser = u => u && ({ id: S(u.id), role: u.role, full_name: u.name, name: u.name, phone: u.phone, email: u.email || "", partner_id: ["dsa", "tip"].includes(u.role) ? S(u.id) : null,
    partner_code: u.partner_code || null, disabled: u.is_active === false, must_change: false, has_password: u.role === "admin", partner_status: u.partner_status || null });
  const PSTATUS = { approved: "active", pending: "pending", rejected: "suspended", suspended: "suspended" };
  const mapPartner = u => u && ({ id: S(u.id), type: u.role, role: u.role, name: u.name, firm: u.business_name || "", phone: u.phone, email: u.email || "", partner_code: u.partner_code, city_id: S(u.city_id),
    service_pincodes: Array.isArray(u.service_pincodes) ? u.service_pincodes.join(", ") : (u.pincode || ""), status: PSTATUS[u.partner_status] || "pending", kyc_verified: !!u.approved_at, approved_at: u.approved_at,
    fee_paid_at: u.approved_at, commission_per_install: u.role === "dsa" ? 300 : 0, created_at: u.created_at, is_internal: !!u.is_internal, acs_mode: "connectbhai", acs_key_set: true, acs_agreement: true, aadhaar_last4: u.aadhaar_last4, pan_last4: u.pan_last4 });
  const pc = u => u ? { id: S(u.id), name: u.name, firm: u.business_name || "", phone: u.phone || "", email: u.email || "", type: u.role || "partner", partner_code: u.partner_code } : null;
  /* official provider logos live in /public/logos (also stored as plan_categories.logo_url in MySQL) */
  const BRAND_LOGO = { bsnl: "/logos/bsnl.svg", jio: "/logos/jio.svg", airtel: "/logos/airtel.svg" };
  const CAT = { fiber: "fiber", airfiber: "air_fiber", tv: "tv", ott: "ott" }, CATBACK = { fiber: "fiber", air_fiber: "airfiber", tv: "tv", ott: "ott" };
  const providerOf = c => c ? ({ id: S(c.id), name: c.type && c.type !== "fiber" ? `${c.name} · ${({ airfiber: "Air Fiber", tv: "TV", ott: "OTT" })[c.type] || c.type}` : c.name, brand: c.name, kind: "local_isp", logo_url: c.logo_url || BRAND_LOGO[String(c.name || "").toLowerCase()] || null, is_demo: false, is_active: c.is_active !== false, website: "" }) : null;
  const mapPlan = p => p && ({ id: S(p.id), plan_code: p.plan_code, name: p.name, category: p.category ? (CAT[p.category.type] || p.category.type) : "fiber", provider_id: S(p.category_id || (p.category && p.category.id)), provider: providerOf(p.category || { id: p.category_id, name: "Plan" }),
    speed_mbps: p.speed_mbps, price_monthly: num(p.price), price_ex_gst: p.price_ex_gst != null ? num(p.price_ex_gst) : null, install_charge: num(p.install_charge) || 0, router_charge: num(p.router_charge) || 0, validity_days: p.validity_days || 30, data_limit: p.data_limit, data_limit_gb: null,
    ott_apps: (p.ott_apps || []).map(o => (typeof o === "string" ? o : o.name)), tv_channels: p.tv_channels || 0, is_active: p.is_active !== false, status: "live", verified_at: p.created_at, source_url: "", notes: "", benefits: p.benefits || null, technology: "ftth", is_demo: false });
  const LS = { new: "new", contacted: "contacted", followup: "follow_up", scheduled: "booked", installed: "installed", lost: "lost", cancelled: "lost" };
  const LSBACK = { follow_up: "followup" };
  const mapLead = l => {
    if (!l) return l;
    const b = l.booking || null;
    return { id: S(l.id), ref_code: l.ref_code, customer_id: S(l.customer_user_id), name: l.customer_name, phone: l.customer_phone, email: l.customer_email || "", pincode: l.pincode, area: l.area ? l.area.name : null, address: l.address,
      plan_id: S(l.plan_id), plan: l.plan ? mapPlan({ ...l.plan, category: l.plan.category }) : null, preferred_date: null, source: l.source, product: l.plan && l.plan.category && ["ott"].includes(l.plan.category.type) ? "ott" : "broadband", status: LS[l.status] || l.status,
      assigned_dsa_id: S(l.brought_by_user_id), assigned_tip_id: S(l.tip_user_id), dsa: pc(l.dsa), tip: pc(l.tip), next_follow_up: l.followup_at ? String(l.followup_at).slice(0, 10) : null, lost_reason: l.lost_reason, notes: l.notes,
      care_plan: !!l.care_plan, consent: true, created_at: l.created_at, updated_at: l.updated_at, installed_at: l.installed_at, booking: b };
  };
  const BS = { scheduled: "scheduled", rescheduled: "scheduled", completed: "installed", cancelled: "cancelled" };
  const mapDevice = d => d && ({ id: S(d.id), booking_id: null, lead_id: S(d.lead_id), state: d.online == null ? "unknown" : d.online ? "online" : "offline", last_seen: d.last_seen_at, rx_dbm: num(d.rx_power_dbm), ssid: d.wifi_ssid, clients: d.connected_clients,
    acs: "connectbhai", make: "", model: d.model || "", firmware: "", wan: d.online ? "Connected" : d.online === false ? "Down" : "—", uptime_h: null, reboots_7d: 0, reboots_30d: 0, is_simulated: true, source: "acs" });
  const mapBooking = (b, devs) => {
    const ld = b.lead || {}, dv = devs ? devs.find(d => String(d.lead_id) === String(b.lead_id)) : null;
    const out = { id: S(b.id), ref_code: "BK-" + String(b.id).padStart(6, "0"), lead_id: S(b.lead_id), customer_id: S(ld.customer_user_id), plan_id: S(ld.plan && ld.plan.id), plan: ld.plan ? mapPlan(ld.plan) : null,
      tip_partner_id: S(b.tip_user_id), dsa_partner_id: S(ld.brought_by_user_id), status: BS[b.status] || b.status, scheduled_date: b.scheduled_at ? String(b.scheduled_at).slice(0, 10) : null, installed_at: b.completed_at, connection_ref: b.connection_id,
      ont_serial: b.router_serial, authorized: b.status === "completed", created_at: b.created_at, care_plan: !!ld.care_plan,
      lead: { id: S(ld.id || b.lead_id), ref_code: ld.ref_code, name: ld.customer_name, phone: ld.customer_phone, email: "", address: ld.address, pincode: ld.pincode, status: LS[ld.status] || ld.status },
      tip: pc(b.tip), dsa: null, device: dv ? { ...mapDevice(dv), booking_id: S(b.id) } : null };
    bookingCache.set(out.id, out); return out;
  };
  const CK = { tip_onboarding: "registration_fee", tip_install_fee: "platform_fee", tip_care_plan_fee: "care_plan_fee", customer_payment: "customer_payment", other: "other" };
  const CKBACK = { registration_fee: "tip_onboarding", platform_fee: "tip_install_fee", care_plan_fee: "tip_care_plan_fee", customer_payment: "customer_payment", other: "other" };
  const mapCharge = c => ({ id: S(c.id), ref_code: c.invoice_no || "CH-" + String(c.id).padStart(6, "0"), kind: CK[c.kind] || c.kind, partner_id: c.payer && c.payer.role !== "customer" ? S(c.payer_user_id) : null,
    customer_id: c.payer && c.payer.role === "customer" ? S(c.payer_user_id) : null, payer_user_id: S(c.payer_user_id), lead_id: S(c.lead_id), booking_id: null, description: c.description, base_amount: num(c.base_amount),
    gst_amount: +(num(c.cgst_amount) + num(c.sgst_amount) + num(c.igst_amount)).toFixed(2), amount: num(c.total_amount), status: c.status === "pending" ? "due" : c.status, gateway: "razorpay", gateway_order_id: c.razorpay_order_id,
    gateway_payment_id: c.razorpay_payment_id, paid_via: c.pay_mode, paid_at: c.paid_at, created_at: c.created_at, invoice_no: c.invoice_no,
    partner: c.payer && c.payer.role !== "customer" ? pc(c.payer) : null, customer: c.payer && c.payer.role === "customer" ? mapUser(c.payer) : null });
  const mapTicket = t => ({ id: S(t.id), ref_code: t.ticket_code, customer_id: S(t.raised_by), booking_id: t.lead ? "lead:" + t.lead_id : null, lead_id: S(t.lead_id), type: "complaint", category: String(t.category || "other").replace(/_/g, " "), subject: t.subject,
    description: t.description || t.subject, status: t.status, assigned_tip_id: S(t.assigned_to), resolution_note: null, created_at: t.created_at, resolved_at: t.resolved_at, priority: t.priority,
    booking: t.lead ? { ref_code: t.lead.ref_code, lead: { name: t.lead.customer_name, phone: t.lead.customer_phone, ref_code: t.lead.ref_code, pincode: t.lead.pincode }, plan: t.lead.plan ? mapPlan({ ...t.lead.plan, id: 0 }) : null } : null,
    customer: t.raiser ? { id: S(t.raiser.id), full_name: t.raiser.name, phone: t.raiser.phone } : null });
  const CS = { pending: "pending", approved: "approved", paid: "paid", cancelled: "rejected" };
  const mapCommission = c => ({ id: S(c.id), partner_id: S(c.dsa_user_id), booking_id: S(c.booking_id), amount: num(c.amount), status: CS[c.status] || c.status, payment_id: c.paid_reference ? "pay-" + c.id : null, created_at: c.created_at, paid_at: c.paid_at,
    partner: pc(c.dsa), booking: { id: S(c.booking_id), ref_code: c.lead ? c.lead.ref_code : "", lead: c.lead ? { name: c.lead.customer_name, ref_code: c.lead.ref_code, pincode: c.lead.pincode } : null, plan: null } });
  const mapCity = c => ({ id: S(c.id), name: c.name, district: c.name, tier: 2, status: c.status });

  /* ---------- settings ---------- */
  const settingsOut = d => ({ registration_fee_tip: num(d.tip_onboarding_fee), registration_fee_dsa: 0, gst_percent: num(d.gst_percent), tip_install_fee: num(d.tip_install_fee), care_plan_fee_per_lead: num(d.care_plan_fee_per_lead),
    dsa_payout_per_lead: num(d.dsa_payout_per_lead), auto_assign: num(d.auto_assign), lead_target_default: 20, tip_share_percent: 0 });
  const kv = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));

  /* ---------- Razorpay checkout (live keys only; the mock gateway settles on the server) ---------- */
  const loadCheckout = () => window.Razorpay ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = ok; s.onerror = () => no(new AppError("Could not load the payment window.")); document.head.appendChild(s); });
  async function payFlow(id, tokenForPublic) {
    const body = tokenForPublic ? { payment_token: tokenForPublic } : {};
    const o = await post(`/charges/${id}/pay`, body, tokenForPublic ? { anon: !me } : undefined);
    if (o.mock) { await sleep(900); await post(`/charges/${id}/mock-pay`, body, tokenForPublic ? { anon: !me } : undefined); return; }
    await loadCheckout();
    const res = await new Promise((ok, no) => { const rz = new window.Razorpay({ key: o.key_id, order_id: o.order_id, amount: o.amount, currency: o.currency, name: "Connect Bhai", handler: ok, modal: { ondismiss: () => no(new AppError("Payment was cancelled.")) } }); rz.open(); });
    await post(`/charges/${id}/verify`, { ...body, razorpay_payment_id: res.razorpay_payment_id, razorpay_signature: res.razorpay_signature }, tokenForPublic ? { anon: !me } : undefined);
  }

  const devices = async () => { try { return (await all("/care-plan/devices")).items; } catch (e) { return []; } };
  const deviceFor = async bookingId => {
    const b = bookingCache.get(String(bookingId)); if (!b) fail("Connection not found.");
    const d = (await devices()).find(x => String(x.lead_id) === String(b.lead_id)); if (!d) fail("This modem is not on the Care plan yet. Ask the installer to enable Care Plan for this connection.");
    return d;
  };
  const speedKey = "cb-speed-tests";
  const localSpeed = () => { try { return JSON.parse(localStorage.getItem(speedKey) || "[]"); } catch (e) { return []; } };
  const cutBookNext = () => { BOOK_NEXT.scheduled = ["installed", "cancelled"]; };   // the API goes scheduled → completed directly

  /* Area names come from the post-office list ("Indore Kumar khadi, Indore"). Show them tidy: no city prefix/suffix, no duplicates, at most 4. */
  const tidyAreas = list => {
    const seen = new Set(), out = [];
    for (const a of list) {
      const n = String(a.name || "").split(",")[0].replace(/^indore\s+/i, "").replace(/\s+indore$/i, "").trim();
      const k = n.toLowerCase(); if (!n || seen.has(k)) continue; seen.add(k); out.push(n.replace(/\b\w/g, c => c.toUpperCase()));
    }
    return out.length > 4 ? [...out.slice(0, 4), `+${out.length - 4} more`] : out;
  };
  const apiFor = {
    mode: "rest",
    async init() { cutBookNext(); if (!loadTokens()) return null; try { me = mapUser(await get("/users/me")); } catch (e) { saveTokens(null); me = null; } return me; },
    me: () => me,
    demoAccounts: () => [],
    restore: async () => me,
    signInDemo: async () => fail("Demo accounts are not used when the API is connected."),
    async signOut() { saveTokens(null); me = null; },

    /* ---- auth ---- */
    async sendOtp(phone) { await post("/auth/otp/request", { phone }, { anon: true }); return { channel: "whatsapp" }; },
    async verifyOtp(phone, code, name) {
      const d = await post("/auth/otp/verify", { phone, code, name: name || undefined }, { anon: true });
      saveTokens({ access_token: d.access_token, refresh_token: d.refresh_token }); me = mapUser(d.user); return me;
    },
    async signInPassword(phone, password) {
      const d = await post("/auth/login", { phone, password }, { anon: true });
      saveTokens({ access_token: d.access_token, refresh_token: d.refresh_token }); me = mapUser(d.user); return me;
    },
    async changePassword() { fail("Partners and customers sign in with a WhatsApp OTP. Admin passwords are set by the system owner."); },
    async setMyName(n) { me = { ...me, ...mapUser(await patch("/users/me", { name: n.trim() })) }; return me; },
    async setMyProfile(f) { me = { ...me, ...mapUser(await patch("/users/me", { name: f.name.trim(), email: f.email || undefined })) }; return me; },

    /* ---- public ---- */
    async catalog(category) { const t = CATBACK[category]; if (!t) return []; return (await all("/plans", { type: t })).items.map(mapPlan); },
    async searchPlans(pin, category) {
      const t = CATBACK[category || "fiber"]; const info = await get("/pincodes/" + pin, { anon: true });
      const plans = t ? (await all("/plans", { pincode: pin, type: t })).items.map(mapPlan) : [];
      return { areas: tidyAreas(info.areas || []), plans, serviceable: info.serviceable, city: info.city };
    },
    async popularPins() { const r = await get("/cities/1/areas", { anon: true }).catch(() => []); const by = new Map(); (Array.isArray(r) ? r : []).forEach(a => { if (!by.has(a.pincode)) by.set(a.pincode, { pin: a.pincode, area: a.name.split(",")[0], city_id: "1" }); }); return [...by.values()].slice(0, 8); },
    async cities() { return (await get("/cities", { anon: true })).map(mapCity); },
    async joinWaitlist(f) {
      if (!f.consent) fail("Please agree so we can message you at launch.");
      const r = await post("/waitlist", { city_id: Number(f.city_id), phone: f.phone, name: f.name }, { anon: true }); return { city: r.city, waiting: 0 };
    },
    async requestConnection(f) {
      const sim = f.sim ? `SIM request: ${JSON.stringify(f.sim)}` : "";
      const l = await post("/leads", { customer_name: f.name.trim(), customer_phone: f.phone, customer_email: f.email || undefined, address: f.address || undefined, pincode: f.pincode, plan_id: N(f.plan_id),
        source: f.plan_id ? "website" : "callback", notes: [f.preferred_date ? "Preferred date: " + f.preferred_date : "", f.area ? "Area: " + f.area : "", sim].filter(Boolean).join(" | ") || undefined });
      return { lead_id: S(l.id), ref_code: l.ref_code };
    },
    async applyPartner(f) {
      const d = await post("/partners/register", { role: f.type, name: f.name.trim(), phone: f.phone, email: f.email || undefined, address: f.address, pincode: f.pincode, city_id: N(f.city_id), business_name: f.firm || undefined,
        gst_number: f.gst_number || undefined, aadhaar: f.aadhaar, pan: f.pan, bank_name: f.bank_name, bank_account: f.bank_account, bank_ifsc: f.bank_ifsc,
        service_pincodes: (f.pincodes || "").split(",").map(x => x.trim()).filter(Boolean), documents: f.documents || undefined }, { anon: true });
      const charge = d.charge ? mapCharge(d.charge) : null; if (charge && d.payment_token) payTokens.set(charge.id, d.payment_token);
      return { partner_id: S(d.user.id), charge };
    },
    async payPublicCharge(id, method) { await payFlow(id, payTokens.get(String(id))); const c = await get(`/charges/${id}`, { anon: !me }).catch(() => null); return c ? mapCharge(c) : { id: S(id), status: "paid" }; },

    /* ---- leads ---- */
    async myLeads() { need("customer"); return (await all("/leads")).items.map(mapLead); },
    async partnerLeads() { need("dsa", "tip"); return (await all("/leads")).items.map(mapLead); },
    async adminLeads() { need("admin"); return (await all("/leads")).items.map(mapLead); },
    async leadDetail(id) {
      const [l, ev] = await Promise.all([get("/leads/" + id), get(`/leads/${id}/events`)]);
      return { ...mapLead(l), events: ev.map(e => ({ id: S(e.id), lead_id: S(e.lead_id), from_status: LS[e.from_status] || e.from_status, to_status: LS[e.to_status] || e.to_status, note: e.note || String(e.event_type || "").replace(/_/g, " "), created_at: e.created_at, actor_name: e.actor && e.actor.name })) };
    },
    async updateLeadStatus(id, status, note, next) {
      if (status === "follow_up" && !next) fail("Choose a follow-up date.");
      await patch(`/leads/${id}/status`, { status: LSBACK[status] || status, note: note || undefined, followup_at: next ? new Date(next + "T09:00:00").toISOString() : undefined, lost_reason: status === "lost" ? (note || undefined) : undefined }); return true;
    },
    async assignLead(id, dsa, tip) { need("admin"); if (!tip) fail("Choose a TIP partner. A lead's DSA is fixed to whoever brought it."); await patch(`/leads/${id}/assign`, { tip_user_id: Number(tip) }); return true; },
    async dsaAddLead(f) {
      need("dsa"); if (!f.consent) fail("Confirm the customer agreed to be contacted.");
      const l = await post("/leads", { customer_name: f.name.trim(), customer_phone: f.phone, address: f.address || undefined, pincode: f.pincode, plan_id: N(f.plan_id), notes: f.area ? "Area: " + f.area : undefined });
      return { ref_code: l.ref_code, tip: l.tip ? l.tip.name : null };
    },
    async dsaActivateSim() { fail("SIM and OTT activation is not part of the installation workflow in this version."); },
    setAutoAssign: async on => { need("admin"); await put("/settings/auto_assign", { value: on ? "1" : "0" }); return true; },

    /* ---- bookings ---- */
    async myBookings() { need("customer"); const [b, dv] = await Promise.all([all("/bookings"), devices()]); return b.items.map(x => mapBooking(x, dv)); },
    async partnerBookings() { need("tip", "dsa"); const [b, dv] = await Promise.all([all("/bookings"), devices()]); return b.items.map(x => mapBooking(x, dv)); },
    async adminBookings() { need("admin"); const [b, dv] = await Promise.all([all("/bookings"), devices()]); return b.items.map(x => mapBooking(x, dv)); },
    async createBooking(leadId, date) {
      if (!date) fail("Choose a date.");
      const when = new Date(date + "T18:00:00"); if (when.getTime() < Date.now()) fail("Choose today or a future date.");
      const b = await post("/bookings", { lead_id: Number(leadId), scheduled_at: when.toISOString() }); return "BK-" + String(b.id).padStart(6, "0");
    },
    async updateBookingStatus(id, status, connRef, ont) {
      if (status === "installed") { if (!(connRef || "").trim()) fail("Enter the connection reference to mark as installed."); await post(`/bookings/${id}/complete`, { connection_id: connRef.trim(), router_serial: (ont || "").trim().toUpperCase() || undefined }); }
      else if (status === "cancelled") await patch("/bookings/" + id, { status: "cancelled" });
      else if (status === "in_progress") return true;
      else fail("This status change is not supported.");
      return true;
    },

    /* ---- tickets ---- */
    async myTickets() { need("customer"); return (await all("/tickets")).items.map(mapTicket); },
    async partnerTickets() { need("tip"); return (await all("/tickets")).items.map(mapTicket); },
    async adminTickets() { need("admin"); return (await all("/tickets")).items.map(mapTicket); },
    async raiseTicket(f) {
      const b = f.booking_id ? bookingCache.get(String(f.booking_id)) : null;
      if (!b && f.type === "complaint") fail("Choose the connection for a complaint.");
      if (!f.description || f.description.trim().length < 5) fail("Describe the issue in a few words.");
      const cat = String(f.category || "other").toLowerCase().replace(/[^a-z]+/g, "_"), cats = ["no_internet", "slow_speed", "billing", "shifting", "other"];
      const t = await post("/tickets", { lead_id: b ? Number(b.lead_id) : undefined, category: cats.includes(cat) ? cat : "other", subject: f.description.trim().slice(0, 150), description: f.description.trim() }); return t.ticket_code;
    },
    async updateTicket(id, status) { await patch("/tickets/" + id, { status }); return true; },

    /* ---- money ---- */
    async myCharges() { return (await all("/charges")).items.map(mapCharge); },
    async adminCharges() { need("admin"); return (await all("/charges")).items.map(mapCharge); },
    async payCharge(id) { await payFlow(id); return mapCharge(await get("/charges/" + id)); },
    async customerPay(f) { need("customer"); const c = await post("/charges/customer", { description: f.description.trim(), amount: Number(f.amount), lead_id: N(f.lead_id) }); return mapCharge(c); },
    async adminCreateCharge(f) {
      need("admin"); const payer = f.payer_type === "partner" ? f.partner_id : f.customer_id; if (!payer) fail("Choose who pays.");
      const c = await post("/charges", { payer_user_id: Number(payer), kind: CKBACK[f.kind] || "other", description: f.description.trim(), base_amount: Number(f.base) }); return mapCharge(c).ref_code;
    },
    async adminSetCharge(id, action, reference) {
      need("admin");
      if (action === "paid_offline") { if (!(reference || "").trim()) fail("Enter the payment reference."); await post(`/charges/${id}/offline`, { reference: reference.trim() }); }
      else if (action === "waived") await post(`/charges/${id}/waive`); else if (action === "cancelled") await post(`/charges/${id}/cancel`); else fail("Unknown action.");
      return true;
    },
    async myCommissions() { need("dsa", "tip"); if (me.role !== "dsa") return []; return (await all("/commissions")).items.map(mapCommission); },
    async adminCommissions() { need("admin"); return (await all("/commissions")).items.map(mapCommission); },
    async setCommission(id, status) { need("admin"); await post(`/commissions/${id}/${status === "approved" ? "approve" : "cancel"}`); return true; },
    async recordPayment(partnerId, ids, method, reference) {
      need("admin"); if (!(reference || "").trim()) fail("Enter the payment reference (UTR / cheque no.).");
      const mode = ["upi", "bank", "cash", "other"].includes(method) ? method : "other"; let total = 0;
      for (const id of ids) { const c = await post(`/commissions/${id}/pay`, { mode, reference: reference.trim() }); total += num(c.amount) || 0; }
      return { id: S(Date.now()), partner_id: S(partnerId), amount: total, method: mode, reference: reference.trim(), paid_at: new Date().toISOString() };
    },
    async adminPayments() { need("admin"); const r = (await all("/commissions", { status: "paid" })).items; return r.map(c => ({ id: S(c.id), partner_id: S(c.dsa_user_id), partner: pc(c.dsa), amount: num(c.amount), method: c.paid_mode, reference: c.paid_reference, paid_at: c.paid_at })); },
    async getSettings() { try { if (me && me.role === "admin") return settingsOut(kv(await get("/settings"))); } catch (e) { /* fall through */ } return settingsOut(await get("/settings/public", { anon: true })); },
    async saveSettings(o) {
      need("admin"); const m = { registration_fee_tip: "tip_onboarding_fee", gst_percent: "gst_percent" };
      for (const [k, v] of Object.entries(m)) { const x = Number(o[k]); if (!(x >= 0)) fail("Enter 0 or more."); await put("/settings/" + v, { value: String(x) }); }
      return true;
    },

    /* ---- people ---- */
    async myPartner() { need("dsa", "tip"); return mapPartner(await get("/users/me")); },
    async adminPartners() { need("admin"); const [a, b] = await Promise.all([all("/users", { role: "dsa" }), all("/users", { role: "tip" })]); return [...a.items, ...b.items].map(mapPartner).sort((x, y) => x.type.localeCompare(y.type) || x.name.localeCompare(y.name)); },
    async adminCustomers() { need("admin"); return (await all("/users", { role: "customer" })).items.map(mapUser); },
    async adminTeam() { need("admin"); return (await all("/users")).items.filter(u => u.role !== "customer").map(u => ({ ...mapUser(u), partner: ["dsa", "tip"].includes(u.role) ? pc(u) : null, pw_set_at: null })); },
    async savePartner() { fail("Partners join through the public registration form; approve them in the partner list."); },
    async approvePartner(id) { need("admin"); await patch(`/users/${id}/partner-status`, { status: "approved" }); return true; },
    async setPartnerStatus(id, status) { need("admin"); await patch(`/users/${id}/partner-status`, { status: status === "active" ? "approved" : "suspended" }); return true; },
    async adminCreateUser(f) {
      need("admin"); if (f.role !== "admin") fail("DSA and TIP partners register through the public form (KYC and bank details are required), then admin approves them here.");
      fail("Admin accounts are created by the system owner with a password.");
    },
    async adminResetPassword() { fail("Partners and customers sign in with a WhatsApp OTP, so there is no password to reset."); },
    async adminSetDisabled(id, off) { need("admin"); if (String(id) === String(me.id)) fail("You cannot disable your own login."); await patch(`/users/${id}/active`, { is_active: !off }); return true; },

    /* ---- catalogue / locations (admin) ---- */
    async adminProviders() { need("admin"); const c = await get("/plan-categories?include_inactive=true").catch(() => get("/plan-categories")); return (Array.isArray(c) ? c : c.items || []).map(providerOf); },
    async saveProvider(f) { need("admin"); const body = { name: f.name.trim(), type: "fiber" }; if (f.id) await patch("/plan-categories/" + f.id, { name: body.name }); else await post("/plan-categories", body); return true; },
    async toggleProvider(id) { need("admin"); const c = (await get("/plan-categories")).find(x => String(x.id) === String(id)); await patch("/plan-categories/" + id, { is_active: !(c && c.is_active !== false) }); return true; },
    async adminPlans() { need("admin"); return (await all("/plans", { include_inactive: true })).items.map(mapPlan); },
    async savePlan(f) {
      need("admin"); if (!f.provider_id) fail("Choose a provider."); if (!f.name || f.name.trim().length < 2) fail("Enter the plan name.");
      const body = { category_id: Number(f.provider_id), name: f.name.trim(), speed_mbps: Number(f.speed_mbps) > 0 ? Number(f.speed_mbps) : undefined, price: Number(f.price_monthly), validity_days: Number(f.validity_days) || undefined,
        data_limit: f.data_limit_gb ? f.data_limit_gb + " GB" : undefined, install_charge: Number(f.install_charge) || 0, tv_channels: Number(f.tv_channels) || undefined };
      if (!(body.price >= 0)) fail("Enter a valid price.");
      if (f.id) await patch("/plans/" + f.id, body); else { if (!f.plan_code) fail("Enter a plan code."); await post("/plans", { ...body, plan_code: f.plan_code.trim().toUpperCase() }); }
      return true;
    },
    async togglePlan(id) { need("admin"); const p = (await all("/plans", { include_inactive: true })).items.find(x => String(x.id) === String(id)); await patch("/plans/" + id, { is_active: !(p && p.is_active) }); return true; },
    async adminImportPlans() { fail("Bulk plan upload is not part of this version. Add plans one by one, or load them through the seed data."); },
    async tipProviders() { return []; },
    async tipPlans() { return { live: [], mine: [] }; },
    async tipSubmitPlans() { fail("Price-sheet upload is not part of this version. Ask Connect Bhai admin to update plans."); },
    async adminReviewPlan() { fail("There are no plan submissions to review in this version."); },
    async adminLocations() {
      need("admin"); const [areas, maps] = await Promise.all([get("/cities/1/areas"), get("/admin/tip-pincodes")]);
      return areas.map(a => ({ id: S(a.id), pincode: a.pincode, area: a.name, city: "Indore", zone: null,
        coverage: maps.filter(m => m.pincode === a.pincode).map(m => ({ id: S(m.id), location_id: S(a.id), provider_id: "all", provider: { id: "all", name: "All providers" }, tip_partner_id: S(m.tip_user_id), tip: pc(m.tip), technology: "ftth", is_active: m.is_active })) }));
    },
    async saveLocation(f) { need("admin"); await post(`/cities/${N(f.city_id) || 1}/areas`, { name: f.area.trim(), pincode: f.pincode }); return true; },
    async saveLocationZone() { fail("Zones are not used any more."); },
    async saveCoverage(f) { need("admin"); const loc = (await this.adminLocations()).find(l => String(l.id) === String(f.location_id)); if (!loc) fail("Choose the area."); if (!f.tip_partner_id) fail("Choose the TIP partner."); await post("/admin/tip-pincodes", { pincode: loc.pincode, tip_user_id: Number(f.tip_partner_id) }); return true; },
    async removeCoverage(id) { need("admin"); await del("/admin/tip-pincodes/" + id); return true; },
    async geoReverse(lat, lng) { const r = await get(`/locations/reverse${qs({ lat, lng })}`, { anon: true }); return { pincode: r.pincode, area: r.area, city: r.city }; },
    async pinLookupMany(list) { return get(`/locations/pincodes${qs({ codes: list.join(",") })}`, { anon: true }); },
    async importPincodes(cityId, pins) { need("admin"); return post("/admin/pincodes/import", { city_id: Number(cityId), pincodes: pins }); },
    async partnerDocs(id) { need("admin"); return get(`/users/${id}/documents`); },
    /* Every upload goes to Cloudinary: ask our server for a signed request (the API secret stays there), then send the file straight to Cloudinary. */
    async uploadFile(file, purpose) {
      const sg = await post("/uploads/sign", { purpose }, { anon: !me });
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!sg.allowed_formats.split(",").includes(ext)) fail("Allowed file types: " + sg.allowed_formats.split(",").join(", ").toUpperCase() + ".");
      if (file.size > sg.max_bytes) fail(`${file.name} is too large (maximum ${Math.round(sg.max_bytes / 1048576)} MB).`);
      const fd = new FormData();
      Object.entries({ file, api_key: sg.api_key, timestamp: sg.timestamp, signature: sg.signature, folder: sg.folder, type: sg.type, allowed_formats: sg.allowed_formats }).forEach(([k, v]) => fd.append(k, v));
      let r; try { r = await fetch(sg.upload_url, { method: "POST", body: fd }); } catch (e) { fail("Could not reach the file server. Check your internet and try again."); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) fail((j.error && j.error.message) || "Upload failed. Please try again.");
      return { public_id: j.public_id, version: j.version, signature: j.signature, format: j.format, resource_type: j.resource_type, bytes: j.bytes };
    },
    async pinLookup(pin) { return get(`/locations/pincode/${pin}`, { anon: true }); },
    async geoAreas(pin) { const i = await get("/pincodes/" + pin, { anon: true }); return { areas: (i.areas || []).map(a => ({ name: a.name, district: i.city ? i.city.name : "", state: "Madhya Pradesh" })) }; },

    /* ---- cities / waitlist ---- */
    async adminCities() {
      need("admin"); const [c, w] = await Promise.all([get("/cities"), all("/waitlist")]);
      return c.map(x => { const ws = w.items.filter(r => String(r.city_id) === String(x.id)); return { ...mapCity(x), waiting: ws.filter(r => !r.notified_at).length, notified: ws.filter(r => r.notified_at).length, partners: 0, pins: 0 }; });
    },
    async adminWaitlist() { need("admin"); return (await all("/waitlist")).items.map(r => ({ id: S(r.id), city_id: S(r.city_id), name: r.name || "", phone: r.phone, pincode: null, interest: null, status: r.notified_at ? "notified" : "waiting", created_at: r.created_at, notified_at: r.notified_at })); },
    async adminLaunchCity(id) { need("admin"); await patch("/cities/" + id, { status: "live" }); return (await post("/waitlist/notify/" + id)).notified; },
    async adminSetCityStatus(id, status) { need("admin"); await patch("/cities/" + id, { status }); return true; },
    async adminAddCity(f) { need("admin"); const c = await post("/cities", { name: (f.name || "").trim() }); return S(c.id); },
    async adminNotifications() { need("admin"); return (await all("/notifications")).items.map(n => ({ id: n.id, to_phone: n.phone || "", template: n.template, params: n.payload ? Object.values(n.payload).map(String) : [], status: n.status, simulated: n.status !== "sent", created_at: n.created_at, sent_at: n.created_at })); },

    /* ---- chat ---- */
    async myThreads() {
      const rows = await get("/chat/threads"), out = [];
      for (const t of rows) {
        const id = (t.type === "lead" ? "lead:" : "sup:") + t.id;
        let info;
        if (t.type === "lead") {
          const l = t.lead; info = { id, kind: "lead", title: t.title, sub: t.sub, people: [{ role: "customer", name: l.customer_name, phone: l.customer_phone, email: l.customer_email || "" }, l.dsa && { role: "dsa", ...pc(l.dsa) }, l.tip && { role: "tip", ...pc(l.tip) }, SUPPORT].filter(Boolean) };
        } else info = { id, kind: "sup", title: t.title, sub: t.sub, people: me.role === "admin" && t.user ? [{ role: t.user.role, name: t.user.name, phone: t.user.phone, email: "" }] : [SUPPORT] };
        threadCache.set(id, info);
        out.push({ ...info, last: t.last ? { ...t.last, id: S(t.last.id), sender_id: S(t.last.sender_user_id) } : null, unread: t.unread });
      }
      return out;
    },
    async threadMessages(id) {
      const [kind, key] = String(id).split(":"), type = kind === "lead" ? "lead" : "support";
      const msgs = await get(`/chat/${type}/${key}/messages`); await post(`/chat/${type}/${key}/read`).catch(() => {});
      if (!threadCache.has(id)) await this.myThreads();
      return { thread: threadCache.get(id) || { id, kind, title: "Chat", sub: "", people: [SUPPORT] }, messages: msgs.map(m => ({ id: S(m.id), thread: id, sender_id: S(m.sender_user_id), sender_role: m.sender ? m.sender.role : "", sender_name: m.sender ? m.sender.name : "", body: m.body, created_at: m.created_at })) };
    },
    async sendMessage(id, body) {
      body = (body || "").trim(); if (!body) fail("Type a message."); if (body.length > 1000) fail("Message is too long (1000 characters max).");
      const [kind, key] = String(id).split(":"); const m = await post(`/chat/${kind === "lead" ? "lead" : "support"}/${key}/messages`, { body });
      return { id: S(m.id), thread: id, sender_id: S(m.sender_user_id), sender_role: me.role, sender_name: me.full_name, body: m.body, created_at: m.created_at };
    },

    /* ---- Care plan (modem) ---- */
    async refreshDevice(bookingId) { const d = await deviceFor(bookingId); const r = await post(`/care-plan/devices/${d.id}/refresh`); return { ...mapDevice(r.device || r), booking_id: S(bookingId) }; },
    async deviceAction(bookingId, action, p) {
      const d = await deviceFor(bookingId); p = p || {};
      if (action === "wifi" && !(p.ssid || p.password)) fail("Enter a new Wi-Fi name, a new password, or both.");
      await post(`/care-plan/devices/${d.id}/actions`, { action: action === "wifi" ? "change_wifi" : action, params: action === "wifi" ? { ssid: p.ssid || undefined, password: p.password || undefined } : undefined });
      return mapDevice((await get("/care-plan/devices/" + d.id)));
    },
    async deviceLog(bookingId) { const d = await deviceFor(bookingId); const x = await get("/care-plan/devices/" + d.id); return (x.actions || []).slice(0, 6).map(a => ({ id: S(a.id), booking_id: S(bookingId), action: a.action === "change_wifi" ? "wifi" : a.action, detail: a.detail || null, by_name: a.actor ? a.actor.name : "System", status: a.status || "done", simulated: true, created_at: a.created_at })); },
    async speedTests(bookingId) { try { const d = await deviceFor(bookingId); const x = await get("/care-plan/devices/" + d.id); const dev = (x.speed_tests || []).map(t => ({ id: S(t.id), booking_id: S(bookingId), kind: "router", status: "done", download_mbps: num(t.download_mbps), upload_mbps: num(t.upload_mbps), ping_ms: t.ping_ms, jitter_ms: null, is_simulated: true, created_at: t.created_at })); return [...dev, ...localSpeed().filter(t => t.booking_id === String(bookingId))].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6); } catch (e) { return localSpeed().filter(t => t.booking_id === String(bookingId)).slice(0, 6); } },
    async recordSpeedTest(bookingId, r) {
      if (!me) fail("Log in to save results.");
      const t = { id: "local-" + Date.now(), booking_id: bookingId ? String(bookingId) : null, user_id: me.id, kind: "browser", status: "done", download_mbps: +r.down.toFixed(2), upload_mbps: +r.up.toFixed(2), ping_ms: Math.round(r.ping), jitter_ms: Math.round(r.jit), is_simulated: !!r.simulated, created_at: new Date().toISOString() };
      try { localStorage.setItem(speedKey, JSON.stringify([t, ...localSpeed()].slice(0, 50))); } catch (e) { /* ignore */ } return t;
    },
    routerTest(bookingId, onQueued) {
      return deviceFor(bookingId).then(async d => { if (onQueued) onQueued(); const t = await post(`/care-plan/devices/${d.id}/speed-test`);
        return { id: S(t.id), booking_id: S(bookingId), kind: "router", status: "done", download_mbps: num(t.download_mbps), upload_mbps: num(t.upload_mbps), ping_ms: t.ping_ms, is_simulated: true, created_at: t.created_at }; });
    },
    async adminAcs() { need("admin"); const [p, d] = await Promise.all([this.adminPartners(), devices()]); return p.filter(x => x.type === "tip").map(x => ({ ...x, linked: d.filter(v => String(v.tip_user_id) === x.id).length })); },
    async saveAcs() { fail("GenieACS is configured on the server (GENIEACS_NBI_URL), not per partner."); },
  };
  return apiFor;
}
