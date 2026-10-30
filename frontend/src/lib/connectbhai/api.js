/* Connect Bhai · data layer (migrated verbatim from the original single-file app).
   Demo back end (in-browser) and Live back end (Supabase) expose the same API object.
   Configuration lives in ./config.js. Browser-only: import this module from client code at runtime. */
import { CONFIG, SUPPORT, LIVE } from "./config";
import { ROLE_NAME } from "./shared";

/* =====================================================================
   Connect Bhai · data layer
   Two interchangeable back ends with the SAME method names and shapes:
     DemoAPI  – in-browser copy of the schema; enforces the same role rules
                as the Supabase RLS policies and RPCs (prototype / preview).
     LiveAPI  – Supabase (Auth + PostgreSQL + RPC). Turned on by CONFIG below.
   FlutterFlow apps later call the same Supabase tables / RPCs.
   ===================================================================== */
/* ---------- helpers ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fdate = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fdt = d => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const isPhone = v => /^[6-9]\d{9}$/.test(v);
const isPin = v => /^[1-9]\d{5}$/.test(v);
const nowISO = () => new Date().toISOString();
class AppError extends Error {}
const fail = m => { throw new AppError(m); };

const LEAD = { new: "New", assigned: "Assigned", contacted: "Contacted", follow_up: "Follow-up", booked: "Booked", installed: "Installed", lost: "Lost" };
const LEAD_TONE = { new: "p-blue", assigned: "p-blue", contacted: "p-warn", follow_up: "p-warn", booked: "p-blue", installed: "p-ok", lost: "p-bad" };
const LEAD_NEXT = { new: ["lost"], assigned: ["contacted", "follow_up", "lost"], contacted: ["follow_up", "lost"], follow_up: ["contacted", "follow_up", "lost"], lost: ["follow_up"], booked: [], installed: [] };
const BOOK = { scheduled: "Scheduled", in_progress: "Installation in progress", installed: "Installed", cancelled: "Cancelled" };
const BOOK_TONE = { scheduled: "p-blue", in_progress: "p-warn", installed: "p-ok", cancelled: "p-bad" };
const BOOK_NEXT = { scheduled: ["in_progress", "cancelled"], in_progress: ["installed", "cancelled"], installed: [], cancelled: [] };
const TICKET = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
const TICKET_TONE = { open: "p-bad", in_progress: "p-warn", resolved: "p-ok", closed: "p-grey" };
const COMM = { pending: "Pending", approved: "Approved", paid: "Paid", rejected: "Rejected" };
const COMM_TONE = { pending: "p-warn", approved: "p-blue", paid: "p-ok", rejected: "p-bad" };
/* Indore district: Indore tehsil = city, split into 5 zones; Sanwer, Depalpur and Mhow tehsils = rural.
   Each PIN code / area (Locations) carries a zone, so every lead is placed in a zone by its PIN code. */
const ZONES = [
  { id: "nehru_park", name: "Nehru Park", kind: "city" }, { id: "meghdoot_park", name: "Meghdoot Park", kind: "city" },
  { id: "transport_nagar", name: "Transport Nagar", kind: "city" }, { id: "pologround", name: "Pologround", kind: "city" },
  { id: "bengali_chouraha", name: "Bengali Chouraha", kind: "city" },
  { id: "sanwer", name: "Sanwer", kind: "rural" }, { id: "depalpur", name: "Depalpur", kind: "rural" }, { id: "mhow", name: "Mhow", kind: "rural" }];
const ZONE_NAME = Object.fromEntries(ZONES.map(z => [z.id, z.name]));
// Starting suggestion only — admin corrects any PIN in Locations
const ZONE_BY_PIN = { "452001": "nehru_park", "452002": "nehru_park", "452003": "nehru_park", "452007": "nehru_park", "452010": "meghdoot_park", "452011": "meghdoot_park",
  "452009": "transport_nagar", "452018": "transport_nagar", "452015": "pologround", "452006": "pologround", "452016": "bengali_chouraha",
  "453551": "sanwer", "453115": "depalpur", "453441": "mhow" };
const KIND = { bsnl_tip: "BSNL TIP (FTTH)", telco: "Telecom operator", local_isp: "Local ISP" };
/* Madhya Pradesh: all 55 districts. Indore is live; the others show "Launching soon" with a waiting list.
   tier 1 = big cities (shown first). Admin can add towns and launch a city from Admin > Cities. */
const MP_CITIES = [["indore", "Indore", 1], ["bhopal", "Bhopal", 1], ["jabalpur", "Jabalpur", 1], ["gwalior", "Gwalior", 1], ["ujjain", "Ujjain", 1],
  ["sagar", "Sagar", 2], ["dewas", "Dewas", 2], ["satna", "Satna", 2], ["ratlam", "Ratlam", 2], ["rewa", "Rewa", 2], ["katni", "Katni", 2], ["singrauli", "Singrauli", 2],
  ["burhanpur", "Burhanpur", 2], ["khandwa", "Khandwa", 2], ["chhindwara", "Chhindwara", 2], ["morena", "Morena", 2], ["bhind", "Bhind", 2], ["guna", "Guna", 2],
  ["shivpuri", "Shivpuri", 2], ["vidisha", "Vidisha", 2], ["mandsaur", "Mandsaur", 2], ["neemuch", "Neemuch", 2], ["khargone", "Khargone", 2], ["dhar", "Dhar", 2],
  ["narmadapuram", "Narmadapuram", 2], ["agar_malwa", "Agar Malwa", 3], ["alirajpur", "Alirajpur", 3], ["anuppur", "Anuppur", 3], ["ashoknagar", "Ashoknagar", 3],
  ["balaghat", "Balaghat", 3], ["barwani", "Barwani", 3], ["betul", "Betul", 3], ["chhatarpur", "Chhatarpur", 3], ["damoh", "Damoh", 3], ["datia", "Datia", 3],
  ["dindori", "Dindori", 3], ["harda", "Harda", 3], ["jhabua", "Jhabua", 3], ["maihar", "Maihar", 3], ["mandla", "Mandla", 3], ["mauganj", "Mauganj", 3],
  ["narsinghpur", "Narsinghpur", 3], ["niwari", "Niwari", 3], ["pandhurna", "Pandhurna", 3], ["panna", "Panna", 3], ["raisen", "Raisen", 3], ["rajgarh", "Rajgarh", 3],
  ["sehore", "Sehore", 3], ["seoni", "Seoni", 3], ["shahdol", "Shahdol", 3], ["shajapur", "Shajapur", 3], ["sheopur", "Sheopur", 3], ["sidhi", "Sidhi", 3],
  ["tikamgarh", "Tikamgarh", 3], ["umaria", "Umaria", 3]];
const citySlug = n => String(n || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
// Indore district PINs (city zones + Sanwer, Depalpur, Mhow) all belong to the Indore launch.
const cityIdOfLoc = l => l.zone ? "indore" : citySlug(l.city || "Indore");
const CATS = { fiber: "Fiber broadband", air_fiber: "Air Fiber", tv: "TV", ott: "OTT pack", sim_prepaid: "SIM · Prepaid", sim_postpaid: "SIM · Postpaid" };
const productOf = cat => ["sim_prepaid", "sim_postpaid"].includes(cat) ? "sim" : cat === "fiber" || !cat ? "broadband" : cat;
const PRODUCT_NAME = { broadband: "Fiber broadband", air_fiber: "Air Fiber", tv: "TV", ott: "OTT", sim: "SIM" };
const SHEET_COLS = ["plan_code", "category", "provider", "plan_name", "speed_mbps", "price", "validity_days", "data_limit_gb", "data_per_day_gb", "voice", "sms_per_day", "ott_apps", "tv_channels", "install_charge", "source_url", "verified", "active", "notes"];
function planFromRow(r, providerId) {   // same rules as plan_from_json() in the database
  const num = v => (v === undefined || v === null || String(v).trim() === "") ? null : Number(v);
  const cat = String(r.category || "").trim();
  if (!CATS[cat]) fail(`Unknown category "${r.category}" (${r.plan_code || r.plan_name || "row"}).`);
  const name = String(r.plan_name || "").trim(); if (name.length < 2) fail(`Plan name missing (${r.plan_code || "row"}).`);
  const price = num(r.price); if (price === null || !(price >= 0)) fail(`Invalid price (${r.plan_code || name}).`);
  const speed = num(r.speed_mbps); if (["fiber", "air_fiber"].includes(cat) && !(speed > 0)) fail(`Speed needed for ${cat} (${r.plan_code || name}).`);
  return { provider_id: providerId, category: cat, plan_code: String(r.plan_code || "").trim().toUpperCase() || null, name, speed_mbps: speed, price_monthly: price,
    validity_days: num(r.validity_days) || 30, data_limit_gb: num(r.data_limit_gb), data_per_day_gb: num(r.data_per_day_gb), voice: String(r.voice || "").trim() || null,
    sms_per_day: num(r.sms_per_day), ott_apps: String(r.ott_apps || "").split(",").map(x => x.trim()).filter(Boolean), tv_channels: num(r.tv_channels) || 0,
    install_charge: num(r.install_charge) || 0, source_url: String(r.source_url || "").trim(), notes: String(r.notes || "").trim() };
}


/* =====================================================================
   DEMO BACK END
   ===================================================================== */
const DEMO_KEY = "cb-demo-v6";
/* Passwords. Demo only: a salted hash kept in this browser so the flow can be tried.
   Live: Supabase Auth stores passwords (bcrypt); the browser never sees another user's password. */
const demoHash = (pw, salt) => { let h1 = 0x811c9dc5, h2 = 0x01000193; const s = salt + "|cb|" + pw;
  for (let r = 0; r < 64; r++) for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i) + r; h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ (c * 31), 2246822519) >>> 0; }
  return "d1$" + h1.toString(16) + h2.toString(16); };
const PW_RULE = "At least 8 characters, with a letter and a number.";
const pwOk = p => typeof p === "string" && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
const genTempPw = () => { const L = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz", D = "23456789", A = L + D, r = new Uint32Array(8); crypto.getRandomValues(r);
  let p = [...r].map(x => A[x % A.length]).join(""); return p.slice(0, 2) + D[r[0] % D.length] + L[r[1] % L.length] + p.slice(4); };
function seedDemo() {
  const t = Date.now(), ago = d => new Date(t - d * 864e5).toISOString();
  const db = {
    seq: 1040,
    providers: [
      { id: "pv-a", name: "Sample Fiber A", kind: "bsnl_tip", website: "", is_active: true, is_demo: true },
      { id: "pv-b", name: "Sample Telco B", kind: "telco", website: "", is_active: true, is_demo: true },
      { id: "pv-c", name: "Sample Local ISP C", kind: "local_isp", website: "", is_active: true, is_demo: true },
      { id: "pv-e", name: "Sample Mobile E", kind: "telco", website: "", is_active: true, is_demo: true }
    ],
    plans: [
      ["pl-a1", "A-FIB-50", "fiber", "pv-a", "Fiber Start", 50, 449, 30, null, null, null, null, [], 0, 0],
      ["pl-a2", "A-FIB-100", "fiber", "pv-a", "Fiber Plus", 100, 699, 30, null, null, null, null, ["Video streaming", "Music"], 0, 0],
      ["pl-a3", "A-FIB-300", "fiber", "pv-a", "Fiber Max", 300, 1199, 30, null, null, null, null, ["Video streaming", "Sports", "Music", "Kids"], 350, 0],
      ["pl-b1", "B-FIB-40", "fiber", "pv-b", "Home 40", 40, 399, 30, 3300, null, null, null, [], 0, 500],
      ["pl-b2", "B-FIB-150", "fiber", "pv-b", "Home 150", 150, 799, 30, null, null, null, null, ["Video streaming", "Sports"], 0, 500],
      ["pl-b3", "B-FIB-500", "fiber", "pv-b", "Home 500", 500, 1499, 30, null, null, null, null, ["Video streaming", "Sports", "Music", "News", "Kids"], 400, 0],
      ["pl-c1", "C-FIB-60", "fiber", "pv-c", "Value 60", 60, 350, 30, null, null, null, null, [], 0, 1000],
      ["pl-c2", "C-FIB-200", "fiber", "pv-c", "Speed 200", 200, 650, 30, null, null, null, null, ["Video streaming"], 0, 500],
      ["pl-c3", "C-BIZ-100", "fiber", "pv-c", "Business 100 (static IP)", 100, 1999, 30, null, null, null, null, [], 0, 1500],
      ["pl-b-air-100", "B-AIR-100", "air_fiber", "pv-b", "AirFiber 100", 100, 649, 30, 1000, null, null, null, ["Video streaming"], 0, 1000],
      ["pl-b-air-300", "B-AIR-300", "air_fiber", "pv-b", "AirFiber 300", 300, 999, 30, null, null, null, null, ["Video streaming", "Sports", "Music"], 350, 1000],
      ["pl-c-air-50", "C-AIR-50", "air_fiber", "pv-c", "Wireless 50", 50, 499, 30, null, null, null, null, [], 0, 1500],
      ["pl-a-tv-300", "A-TV-300", "tv", "pv-a", "IPTV Basic", null, 199, 30, null, null, null, null, [], 300, 0],
      ["pl-a-tv-550", "A-TV-550", "tv", "pv-a", "IPTV Plus", null, 349, 30, null, null, null, null, ["Video streaming", "Sports"], 550, 0],
      ["pl-a-ott-5", "A-OTT-5", "ott", "pv-a", "OTT Pack 5", null, 149, 30, null, null, null, null, ["Video streaming", "Sports", "Music", "Kids", "News"], 0, 0],
      ["pl-b-ott-10", "B-OTT-10", "ott", "pv-b", "OTT Max 10", null, 299, 30, null, null, null, null, ["Video streaming", "Sports", "Music", "Kids", "News", "Regional", "Movies", "Comedy", "Devotional", "Learning"], 0, 0],
      ["pl-b-pre-199", "B-PRE-199", "sim_prepaid", "pv-b", "Prepaid 28 days", null, 199, 28, null, 2, "Unlimited", 100, [], 0, 0],
      ["pl-b-pre-549", "B-PRE-549", "sim_prepaid", "pv-b", "Prepaid 84 days", null, 549, 84, null, 1.5, "Unlimited", 100, [], 0, 0],
      ["pl-e-pre-1999", "E-PRE-1999", "sim_prepaid", "pv-e", "Prepaid 365 days", null, 1999, 365, null, 2, "Unlimited", 100, ["Music"], 0, 0],
      ["pl-b-post-399", "B-POST-399", "sim_postpaid", "pv-b", "Postpaid 399", null, 399, 30, 75, null, "Unlimited", 100, [], 0, 0],
      ["pl-e-post-599", "E-POST-599", "sim_postpaid", "pv-e", "Postpaid Family 599", null, 599, 30, 100, null, "Unlimited", 100, ["Video streaming"], 0, 0]
    ].map(([id, plan_code, category, provider_id, name, speed_mbps, price_monthly, validity_days, data_limit_gb, data_per_day_gb, voice, sms_per_day, ott_apps, tv_channels, install_charge]) => ({
      id, plan_code, category, provider_id, name, speed_mbps, price_monthly, validity_days, data_limit_gb, data_per_day_gb, voice, sms_per_day, ott_apps, tv_channels, install_charge,
      is_active: true, status: "live", is_demo: true, source_url: "", verified_at: ago(3), notes: "Demo plan for testing"
    })),
    partners: [
      { id: "pt-d1", type: "dsa", name: "Sunil Verma", firm: "Verma Connections", phone: "9876500101", email: "sunil.verma@example.com", service_pincodes: "452010, 452016", lead_target: 25, status: "active", commission_per_install: 300, kyc_verified: true, created_at: ago(60) },
      { id: "pt-d2", type: "dsa", name: "Priya Jain", firm: "Jain Mobile Point", phone: "9876500102", email: "priya.jain@example.com", service_pincodes: "452001, 452009", status: "active", commission_per_install: 300, kyc_verified: true, created_at: ago(45) },
      { id: "pt-d3", type: "dsa", name: "Arif Khan", firm: "Khan Telecom", phone: "9876500103", email: "arif.khan@example.com", service_pincodes: "452018", status: "pending", commission_per_install: 0, kyc_verified: false, created_at: ago(1) },
      { id: "pt-t1", type: "tip", name: "Malwa Fibernet (demo TIP)", firm: "Malwa Fibernet", phone: "9876500201", email: "ops@malwafibernet.example", service_pincodes: "452010, 452016", lead_target: 30, status: "active", commission_per_install: 300, kyc_verified: true, approved_at: ago(90), fee_paid_at: ago(89), created_at: ago(90) },
      { id: "pt-t2", type: "tip", name: "Narmada Netlink (demo TIP)", firm: "Narmada Netlink", phone: "9876500202", email: "ops@narmadanetlink.example", service_pincodes: "452001, 452018", status: "active", commission_per_install: 300, kyc_verified: true, approved_at: ago(80), fee_paid_at: ago(79), created_at: ago(80) },
      { id: "pt-t3", type: "tip", name: "Ravi Fibernet (demo TIP)", firm: "Ravi Fibernet", phone: "9876500203", email: "ravi@ravifibernet.example", service_pincodes: "452009", status: "pending", commission_per_install: 300, kyc_verified: true, approved_at: ago(1), fee_paid_at: null, created_at: ago(3) }
    ],
    profiles: [
      { id: "u-cust", role: "customer", full_name: "Ramesh Sharma", phone: "9876500001", email: "ramesh.sharma@example.com", partner_id: null },
      { id: "u-cust2", role: "customer", full_name: "Neha Gupta", phone: "9876500002", email: "neha.gupta@example.com", partner_id: null },
      { id: "u-dsa", role: "dsa", full_name: "Sunil Verma", phone: "9876500101", email: "sunil.verma@example.com", partner_id: "pt-d1" },
      { id: "u-tip", role: "tip", full_name: "Malwa Fibernet Ops", phone: "9876500201", email: "ops@malwafibernet.example", partner_id: "pt-t1" },
      { id: "u-admin", role: "admin", full_name: "Connect Bhai Admin", phone: "9876500999", email: "support@connectbhai.in", partner_id: null }
    ],
    locations: [
      { id: "lc-1", pincode: "452010", area: "Vijay Nagar", city: "Indore", zone: "meghdoot_park" },
      { id: "lc-2", pincode: "452001", area: "Rajwada", city: "Indore", zone: "nehru_park" },
      { id: "lc-3", pincode: "452009", area: "Annapurna", city: "Indore", zone: "transport_nagar" },
      { id: "lc-4", pincode: "452016", area: "Nipania", city: "Indore", zone: "bengali_chouraha" },
      { id: "lc-5", pincode: "452018", area: "Bhawarkuan", city: "Indore", zone: "transport_nagar" },
      { id: "lc-6", pincode: "452015", area: "Pologround Industrial Area", city: "Indore", zone: "pologround" },
      { id: "lc-7", pincode: "453551", area: "Sanwer", city: "Sanwer", zone: "sanwer" },
      { id: "lc-8", pincode: "453115", area: "Depalpur", city: "Depalpur", zone: "depalpur" },
      { id: "lc-9", pincode: "453441", area: "Mhow", city: "Mhow", zone: "mhow" }
    ],
    coverage: [
      ["lc-1", "pv-a", "pt-t1", "ftth"], ["lc-1", "pv-b", null, "ftth"], ["lc-1", "pv-c", null, "cable"],
      ["lc-2", "pv-a", "pt-t2", "ftth"], ["lc-2", "pv-b", null, "ftth"],
      ["lc-3", "pv-b", null, "ftth"], ["lc-3", "pv-c", null, "wireless"],
      ["lc-4", "pv-a", "pt-t1", "ftth"], ["lc-4", "pv-c", null, "cable"],
      ["lc-5", "pv-a", "pt-t2", "ftth"]
    ].map(([location_id, provider_id, tip_partner_id, technology], i) => ({ id: "cv-" + i, location_id, provider_id, tip_partner_id, technology, is_active: true })),
    settings: { registration_fee_tip: 5000, registration_fee_dsa: 1000, gst_percent: 18, auto_assign: 1, lead_target_default: 20, tip_share_percent: 0 },
    leads: [], lead_events: [], bookings: [], tickets: [], commissions: [], payments: [], device_status: [], device_actions: [], speed_tests: [], charges: [], notifications: [], messages: [], reads: {}, waitlist: [],
    cities: MP_CITIES.map(([id, name, tier]) => ({ id, name, district: name, tier, status: id === "indore" ? "live" : "soon", launched_at: id === "indore" ? ago(30) : null, created_at: ago(30) }))
  };
  const L = (id, ref, customer_id, name, phone, pincode, area, plan_id, status, dsa, tip, days, extra) => {
    db.leads.push(Object.assign({ id, ref_code: ref, customer_id, name, phone, pincode, area, address: "", plan_id, preferred_date: null, source: "website",
      status, assigned_dsa_id: dsa, assigned_tip_id: tip, assigned_at: dsa || tip ? ago(days - 0.2) : null, next_follow_up: null, consent: true,
      created_at: ago(days), updated_at: ago(Math.max(0, days - 1)) }, extra || {}));
    db.lead_events.push({ id: uuid(), lead_id: id, actor_id: customer_id, from_status: null, to_status: "new", note: "Request received", created_at: ago(days) });
    if (dsa || tip) db.lead_events.push({ id: uuid(), lead_id: id, actor_id: "u-admin", from_status: "new", to_status: "assigned", note: "Assigned by admin", created_at: ago(days - 0.2) });
  };
  L("ld-1", "CB261001-1001", "u-cust", "Ramesh Sharma", "9876500001", "452010", "Vijay Nagar", "pl-a2", "installed", "pt-d1", "pt-t1", 12, { address: "12, Scheme 54" });
  L("ld-2", "CB261008-1012", "u-cust2", "Neha Gupta", "9876500002", "452010", "Vijay Nagar", "pl-a3", "booked", "pt-d1", "pt-t1", 6);
  L("ld-3", "CB261009-1018", null, "Arjun Patel", "9826012345", "452016", "Nipania", "pl-c2", "follow_up", "pt-d1", null, 5, { next_follow_up: todayISO() });
  L("ld-4", "CB261010-1021", null, "Kavita Joshi", "9893011122", "452001", "Rajwada", "pl-a1", "assigned", "pt-d2", "pt-t2", 4);
  L("ld-5", "CB261012-1027", null, "Mohit Rao", "9755033344", "452009", "Annapurna", "pl-b2", "new", null, null, 2);
  L("ld-6", "CB261013-1031", null, "Sana Sheikh", "9617055566", "452010", "Vijay Nagar", null, "new", null, null, 1, { source: "callback" });
  L("ld-7", "CB261011-1024", null, "Deepak Yadav", "9926077788", "452016", "Nipania", "pl-a2", "contacted", "pt-d1", "pt-t1", 3);
  L("ld-8", "CB261005-1009", null, "Pooja Mehta", "9302099900", "452001", "Rajwada", "pl-b1", "lost", "pt-d2", null, 9);
  L("ld-9", "CB260928-0981", null, "Suresh Patidar", "9425066677", "452016", "Nipania", "pl-a1", "installed", "pt-d1", "pt-t1", 20);
  L("ld-10", "CB260930-0990", null, "Meena Choudhary", "9179088899", "452001", "Rajwada", "pl-a2", "installed", "pt-d2", "pt-t2", 18);
  L("ld-11", "CB261014-1033", null, "Shankar Choudhary", "9425099911", "453551", "Sanwer", null, "new", null, null, 1, { source: "callback" });
  db.lead_events.push({ id: uuid(), lead_id: "ld-3", actor_id: "u-dsa", from_status: "assigned", to_status: "follow_up", note: "Wants to compare with current provider; call back.", created_at: ago(2) });
  db.lead_events.push({ id: uuid(), lead_id: "ld-7", actor_id: "u-dsa", from_status: "assigned", to_status: "contacted", note: "Interested in Fiber Plus. Ready this week.", created_at: ago(1) });
  db.lead_events.push({ id: uuid(), lead_id: "ld-8", actor_id: "u-dsa", from_status: "assigned", to_status: "lost", note: "Chose another provider.", created_at: ago(7) });
  db.lead_events.push({ id: uuid(), lead_id: "ld-2", actor_id: "u-tip", from_status: "contacted", to_status: "booked", note: "Installation scheduled", created_at: ago(1) });
  db.lead_events.push({ id: uuid(), lead_id: "ld-1", actor_id: "u-tip", from_status: "booked", to_status: "installed", note: "Installed and authorised", created_at: ago(8) });
  db.bookings.push({ id: "bk-1", ref_code: "BK261004-1005", lead_id: "ld-1", customer_id: "u-cust", plan_id: "pl-a2", tip_partner_id: "pt-t1", dsa_partner_id: "pt-d1", status: "installed", scheduled_date: ago(9).slice(0, 10), installed_at: ago(8), connection_ref: "DEMO-FTTH-10021", ont_serial: "DEMOONT0001", authorized: true, created_at: ago(10) });
  db.speed_tests.push({ id: "st-1", booking_id: "bk-1", user_id: "u-cust", kind: "browser", status: "done", download_mbps: 91.4, upload_mbps: 86.2, ping_ms: 8, jitter_ms: 2, is_simulated: true, created_at: ago(3) });
  db.speed_tests.push({ id: "st-2", booking_id: "bk-1", user_id: "u-tip", kind: "router", status: "done", download_mbps: 98.7, upload_mbps: null, ping_ms: null, jitter_ms: null, is_simulated: true, created_at: ago(8) });
  db.bookings.push({ id: "bk-2", ref_code: "BK261013-1030", lead_id: "ld-2", customer_id: "u-cust2", plan_id: "pl-a3", tip_partner_id: "pt-t1", dsa_partner_id: "pt-d1", status: "scheduled", scheduled_date: addDays(1), installed_at: null, connection_ref: null, authorized: false, created_at: ago(1) });
  db.device_status.push({ booking_id: "bk-1", state: "online", last_seen: new Date(t - 3 * 6e4).toISOString(), is_simulated: true, source: "simulated" });
  db.device_status.push({ booking_id: "bk-2", state: "unknown", last_seen: null, is_simulated: true, source: "simulated" });
  db.bookings.push({ id: "bk-3", ref_code: "BK260930-0985", lead_id: "ld-9", customer_id: null, plan_id: "pl-a1", tip_partner_id: "pt-t1", dsa_partner_id: "pt-d1", status: "installed", scheduled_date: ago(17).slice(0, 10), installed_at: ago(16), connection_ref: "DEMO-FTTH-09931", ont_serial: "DEMOONT0002", authorized: true, created_at: ago(18) });
  db.device_status.push({ booking_id: "bk-3", state: "offline", last_seen: new Date(t - 3 * 36e5).toISOString(), is_simulated: true, source: "simulated" });
  db.bookings.push({ id: "bk-4", ref_code: "BK261002-0996", lead_id: "ld-10", customer_id: null, plan_id: "pl-a2", tip_partner_id: "pt-t2", dsa_partner_id: "pt-d2", status: "installed", scheduled_date: ago(14).slice(0, 10), installed_at: ago(13), connection_ref: "DEMO-FTTH-09960", ont_serial: null, authorized: true, created_at: ago(15) });
  db.device_status.push({ booking_id: "bk-4", state: "unknown", last_seen: null, is_simulated: true, source: "simulated" });
  db.tickets.push({ id: "tk-1", ref_code: "TK261012-1028", customer_id: "u-cust", booking_id: "bk-1", type: "complaint", category: "Slow speed", description: "Speed drops in the evening between 8 and 11 pm.", status: "in_progress", assigned_tip_id: "pt-t1", resolution_note: "Technician visit planned.", created_at: ago(2), resolved_at: null });
  db.payments.push({ id: "py-1", partner_id: "pt-d1", amount: 300, method: "upi", reference: "DEMO-UTR-5521", paid_at: ago(4), created_by: "u-admin" });
  db.commissions.push({ id: "cm-1", partner_id: "pt-d1", booking_id: "bk-1", amount: 300, status: "paid", payment_id: "py-1", created_at: ago(8) });
  db.partners.filter(p => p.status === "active").forEach(p => { p.approved_at = p.approved_at || ago(70); p.fee_paid_at = p.fee_paid_at || ago(69); });
  const ch = (id, kind, partner_id, customer_id, booking_id, description, base, status, days) => db.charges.push({ id, ref_code: "PY" + id.slice(3).padStart(4, "0"), kind, partner_id, customer_id, booking_id, description,
    base_amount: base, gst_amount: Math.round(base * 18) / 100, amount: base + Math.round(base * 18) / 100, status, gateway: "razorpay", gateway_order_id: null,
    gateway_payment_id: status === "paid" ? "pay_DEMO" + id.slice(3) : null, paid_via: status === "paid" ? "razorpay" : null, paid_at: status === "paid" ? ago(days - 0.5) : null, created_at: ago(days) });
  ch("ch-1", "registration_fee", "pt-t1", null, null, "TIP registration fee", 5000, "paid", 90);
  ch("ch-2", "registration_fee", "pt-t2", null, null, "TIP registration fee", 5000, "paid", 80);
  ch("ch-3", "registration_fee", "pt-d1", null, null, "DSA registration fee", 1000, "paid", 60);
  ch("ch-4", "registration_fee", "pt-d2", null, null, "DSA registration fee", 1000, "paid", 45);
  ch("ch-5", "registration_fee", "pt-t3", null, null, "TIP registration fee", 5000, "due", 1);
  ch("ch-6", "platform_fee", "pt-t1", null, "bk-1", "Platform fee · CB261001-1001 · Ramesh Sharma", 300, "paid", 8);
  ch("ch-7", "platform_fee", "pt-t1", null, "bk-3", "Platform fee · CB260928-0981 · Suresh Patidar", 300, "due", 16);
  ch("ch-8", "platform_fee", "pt-t2", null, "bk-4", "Platform fee · CB260930-0990 · Meena Choudhary", 300, "due", 13);
  ch("ch-9", "customer_payment", null, "u-cust", "bk-1", "Dual-band Wi-Fi router (upgrade)", 1499, "due", 2);
  const hn = ["Amit Jain", "Rekha Soni", "Vikas Tiwari", "Pallavi Rathore", "Rohit Gour", "Sneha Malviya", "Imran Qureshi", "Kiran Yadav", "Manoj Patel", "Ankita Sharma", "Harish Verma", "Seema Chouhan", "Gaurav Mehta", "Nisha Agrawal", "Lokesh Dubey", "Preeti Singh", "Ajay Thakur", "Ritu Mishra"];
  let hx = 0;
  [[165, 3], [135, 4], [105, 5], [75, 6], [45, 7], [18, 5]].forEach(([d0, cnt]) => { for (let i = 0; i < cnt; i++, hx++) {
    const d = d0 - i * 3, tip = hx % 3 === 2 ? "pt-t2" : "pt-t1", dsa = tip === "pt-t1" ? "pt-d1" : "pt-d2", pin = tip === "pt-t1" ? "452016" : "452001";
    const id = "ld-h" + hx, nm = hn[hx % hn.length], plan = ["pl-a1", "pl-a2", "pl-a3", "pl-a2"][hx % 4], won = hx % 4 !== 3, rf = "CBH-" + (2000 + hx);
    L(id, rf, null, nm, String(9300000000 + hx * 7919), pin, pin === "452016" ? "Nipania" : "Rajwada", plan, won ? "installed" : "lost", dsa, tip, d);
    if (!won) continue;
    const bid = "bk-h" + hx;
    const ontH = hx % 3 !== 1 ? "DEMOONTH" + (100 + hx) : null, offH = ontH && hx % 7 === 4;
    db.bookings.push({ id: bid, ref_code: "BKH-" + (2000 + hx), lead_id: id, customer_id: null, plan_id: plan, tip_partner_id: tip, dsa_partner_id: dsa, status: "installed", scheduled_date: ago(d - 2).slice(0, 10), installed_at: ago(d - 3), connection_ref: "DEMO-FTTH-H" + hx, ont_serial: ontH, authorized: true, created_at: ago(d - 1) });
    db.device_status.push({ booking_id: bid, state: ontH ? (offH ? "offline" : "online") : "unknown", last_seen: ontH ? new Date(t - (offH ? 5 * 36e5 : (hx % 5 + 1) * 6e4)).toISOString() : null, is_simulated: true, source: "simulated" });
    db.commissions.push({ id: "cm-h" + hx, partner_id: dsa, booking_id: bid, amount: 300, status: d > 45 ? "paid" : d > 20 ? "approved" : "pending", payment_id: null, created_at: ago(d - 3) });
    ch("ch-h" + hx, "platform_fee", tip, null, bid, "Platform fee · " + rf + " · " + nm, 300, d > 30 ? "paid" : "due", d - 3);
  } });
  [["9876500001", "cb_request_received", ["Ramesh Sharma", "CB261001-1001"], 12], ["9876500101", "cb_new_lead", ["CB261001-1001", "Ramesh Sharma", "9876500001", "452010"], 11.8],
   ["9876500001", "cb_installed", ["Ramesh Sharma", "DEMO-FTTH-10021"], 8], ["9876500201", "cb_payment_due", ["Platform fee · CB261001-1001", "354", "PY0006"], 8],
   ["9876500203", "cb_partner_approved", ["Ravi Fibernet (demo TIP)", "5900"], 1], ["9876500203", "cb_payment_due", ["TIP registration fee", "5900", "PY0005"], 1],
   ["9876500001", "cb_payment_due", ["Dual-band Wi-Fi router (upgrade)", "1768.82", "PY0009"], 2]]
    .forEach(([to_phone, template, params, d], i) => db.notifications.push({ id: i + 1, to_phone, template, params, status: "sent", simulated: true, created_at: ago(d), sent_at: ago(d) }));
  [["u-cust", "customer", "Ramesh Sharma", "Speed drops in the evening. Can someone check?", 2.1], ["u-dsa", "dsa", "Sunil Verma", "Namaste Ramesh ji, I have informed the installer. They will call you today.", 2.05],
   ["u-tip", "tip", "Malwa Fibernet Ops", "Technician visit planned for tomorrow 11 am. Please keep the router on.", 2]]
    .forEach(([sender_id, sender_role, sender_name, body, d]) => db.messages.push({ id: uuid(), thread: "lead:ld-1", sender_id, sender_role, sender_name, body, created_at: ago(d) }));
  db.leads.forEach(l => { if (l.pincode === "452010") { l.lat = 22.7533 + Math.random() * 0.01; l.lng = 75.8937 + Math.random() * 0.01; l.location_source = "gps"; } });
  db.profiles.forEach(p => { p.pw = demoHash("Demo@1234", p.id); p.must_change = false; p.disabled = false; });
  db.leads.forEach(l => { l.product = l.product || "broadband"; });
  /* GenieACS: Malwa Fibernet already runs its own GenieACS (Connect Bhai reads it through its API);
     Narmada Netlink's modems report to Connect Bhai's own GenieACS. */
  const acsOf = { "pt-t1": { acs_mode: "partner", acs_url: "http://acs.malwafibernet.example:7557", acs_key_set: true, acs_agreement: true },
    "pt-t2": { acs_mode: "connectbhai", acs_url: "http://acs.connectbhai.in:7557", acs_key_set: true, acs_agreement: true } };
  db.partners.forEach(p => { if (p.type === "tip") Object.assign(p, { acs_mode: null, acs_url: "", acs_key_set: false, acs_agreement: false, acs_updated_at: ago(30) }, acsOf[p.id] || {}); });
  const MODELS = [["Syrotech", "SY-GPON-2010-WADONT", "V3.2.18"], ["Digisol", "DG-GR6821AC", "V2.1.4"], ["Huawei", "EG8145V5", "V5R020C10S115"], ["DBC", "DBC-XPON-1GE", "V1.0.9"], ["VSOL", "V2802RH", "V2.0.6"]];
  db.device_status.forEach((d, i) => {
    const b = db.bookings.find(x => x.id === d.booking_id), tp = b && db.partners.find(p => p.id === b.tip_partner_id), ld = b && db.leads.find(l => l.id === b.lead_id), m = MODELS[i % MODELS.length];
    const linked = !!(b && b.ont_serial && tp && tp.acs_mode), on = d.state === "online";
    Object.assign(d, { acs: linked ? tp.acs_mode : null, make: linked ? m[0] : null, model: linked ? m[1] : null, firmware: linked ? m[2] : null,
      rx_dbm: linked ? +(-17.5 - (i * 1.7) % 9.5).toFixed(1) : null, ssid: linked && ld ? ld.name.split(" ")[0] + "_WiFi" : null,
      clients: linked && on ? 2 + i % 7 : 0, uptime_h: linked && on ? 6 + (i * 13) % 300 : 0, reboots_7d: linked ? i % 4 : 0, reboots_30d: linked ? (i % 4) * 2 + i % 3 : 0,
      wan: on ? "Connected" : d.state === "offline" ? "Down" : null });
  });
  Object.assign(db.device_status.find(d => d.booking_id === "bk-1"), { rx_dbm: -19.8, ssid: "Sharma_Home", clients: 6, uptime_h: 52, reboots_7d: 1, reboots_30d: 3 });
  Object.assign(db.device_status.find(d => d.booking_id === "bk-3"), { rx_dbm: -28.4, reboots_7d: 5, reboots_30d: 12 });
  db.device_actions.push({ id: uuid(), booking_id: "bk-1", action: "wifi", detail: "Name → Sharma_Home", by_id: "u-cust", by_role: "customer", by_name: "Ramesh Sharma", acs: "partner", status: "done", simulated: true, created_at: ago(6) });
  db.device_actions.push({ id: uuid(), booking_id: "bk-1", action: "reboot", detail: null, by_id: "u-tip", by_role: "tip", by_name: "Malwa Fibernet (demo TIP)", acs: "partner", status: "done", simulated: true, created_at: ago(2.2) });
  db.partners.forEach(p => { p.city_id = p.city_id || "indore"; });
  [["bhopal", "Ankit Saxena", "9300100001", "462016", "broadband", 6], ["bhopal", "Pooja Raghuwanshi", "9300100002", "462042", "sim", 4], ["bhopal", "Irfan Ali", "9300100003", "462001", "broadband", 2],
   ["bhopal", "Neelam Tiwari", "9300100004", null, "air_fiber", 1], ["ujjain", "Mahesh Joshi", "9300100005", "456010", "broadband", 5], ["ujjain", "Kavya Bhati", "9300100006", "456001", "tv", 2],
   ["dewas", "Rohit Panwar", "9300100007", "455001", "broadband", 3], ["jabalpur", "Sonal Dubey", "9300100008", "482002", "sim", 1]]
    .forEach(([city_id, name, phone, pincode, interest, d]) => db.waitlist.push({ id: uuid(), city_id, name, phone, pincode, interest, status: "waiting", consent: true, is_demo: true, created_at: ago(d), notified_at: null }));
  return db;
}
let DB;
function resetDemoData() { DB = seedDemo(); saveDemo(); }
function loadDemo() {
  try { const s = localStorage.getItem(DEMO_KEY); if (s) { DB = JSON.parse(s); DB.speed_tests = DB.speed_tests || []; DB.device_actions = DB.device_actions || []; DB.charges = DB.charges || []; DB.notifications = DB.notifications || []; DB.settings = DB.settings || { registration_fee_tip: 5000, registration_fee_dsa: 1000, gst_percent: 18 }; if (DB.settings.auto_assign === undefined) DB.settings.auto_assign = 1; DB.messages = DB.messages || []; DB.reads = DB.reads || {}; if (DB.settings.lead_target_default === undefined) DB.settings.lead_target_default = 20; DB.locations.forEach(l => { if (l.zone === undefined) l.zone = ZONE_BY_PIN[l.pincode] || null; });
    [["452015", "Pologround Industrial Area", "Indore", "pologround"], ["453551", "Sanwer", "Sanwer", "sanwer"], ["453115", "Depalpur", "Depalpur", "depalpur"], ["453441", "Mhow", "Mhow", "mhow"]].forEach(([pincode, area, city, zone]) => { if (!DB.locations.some(l => l.pincode === pincode)) DB.locations.push({ id: uuid(), pincode, area, city, zone }); }); if (DB.settings.tip_share_percent === undefined) DB.settings.tip_share_percent = 0; DB.profiles.forEach(p => { if (p.pw === undefined && ["u-cust", "u-cust2", "u-dsa", "u-tip", "u-admin"].includes(p.id)) { p.pw = demoHash("Demo@1234", p.id); p.must_change = false; } }); return; } } catch (e) {}
  DB = seedDemo();
}
function migrateCities() { if (!DB.cities) { DB.cities = seedDemo().cities; } DB.waitlist = DB.waitlist || []; DB.partners.forEach(p => { if (p.city_id === undefined) p.city_id = "indore"; }); }
function saveDemo() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(DB)); } catch (e) {} }

const Demo = (() => {
  let me = null, otpFresh = false, issued = null;
  const ref = p => p + todayISO().slice(2).replace(/-/g, "") + "-" + (++DB.seq);
  const need = (...roles) => { if (!me || !roles.includes(me.role)) fail("You do not have access to this action."); };
  const isAdmin = () => me && me.role === "admin";
  const byId = (t, id) => DB[t].find(x => x.id === id);
  const plan = id => { const p = byId("plans", id); return p ? Object.assign({}, p, { provider: byId("providers", p.provider_id) }) : null; };
  const partnerName = id => (byId("partners", id) || {}).name || null;
  const pc = id => { const p = id ? byId("partners", id) : null; return p ? { id: p.id, name: p.name, firm: p.firm || "", phone: p.phone, email: p.email || "", type: p.type } : null; };
  const custEmail = l => l.email || ((l.customer_id && byId("profiles", l.customer_id)) || {}).email || "";
  const leadOut = l => Object.assign({}, l, { email: custEmail(l), plan: plan(l.plan_id), dsa: pc(l.assigned_dsa_id), tip: pc(l.assigned_tip_id), booking: DB.bookings.find(b => b.lead_id === l.id) || null });
  const bookingOut = b => { const ld = DB.leads.find(l => l.id === b.lead_id); return Object.assign({}, b, { plan: plan(b.plan_id), lead: ld ? Object.assign({}, ld, { email: custEmail(ld) }) : ld, device: DB.device_status.find(d => d.booking_id === b.id) || null,
    tip: pc(b.tip_partner_id), dsa: pc(b.dsa_partner_id) }); };
  const canSeeLead = l => isAdmin() || (me && (l.customer_id === me.id || (me.role === "dsa" && l.assigned_dsa_id === me.partner_id) || (me.role === "tip" && l.assigned_tip_id === me.partner_id)));
  const canSeeBooking = b => isAdmin() || (me && (b.customer_id === me.id || (me.role === "tip" && b.tip_partner_id === me.partner_id) || (me.role === "dsa" && b.dsa_partner_id === me.partner_id)));
  const threadInfo = id => {
    const [kind, key] = String(id || "").split(":");
    if (kind === "lead") {
      const l = byId("leads", key); if (!l || !canSeeLead(l)) return null; const o = leadOut(l);
      const people = [{ role: "customer", name: l.name, phone: l.phone, email: o.email }, o.dsa && Object.assign({ role: "dsa" }, o.dsa), o.tip && Object.assign({ role: "tip" }, o.tip), SUPPORT].filter(Boolean);
      return { id, kind: "lead", title: l.name + " · " + l.ref_code, sub: o.plan ? o.plan.provider.name + " · " + o.plan.name : "Callback request", people };
    }
    if (kind === "sup") {
      const p = byId("profiles", key); if (!p || !(isAdmin() || (me && me.id === key))) return null;
      const pt = p.partner_id ? byId("partners", p.partner_id) : null, nm = pt ? pt.name : (p.full_name || "Customer");
      return isAdmin() ? { id, kind: "sup", title: nm + " · support", sub: ROLE_NAME[p.role] || "", people: [{ role: p.role, name: nm, phone: p.phone, email: p.email || (pt && pt.email) || "" }] }
        : { id, kind: "sup", title: "Connect Bhai Admin", sub: "Support chat · any time", people: [SUPPORT] };
    }
    return null;
  };
  const event = (lead_id, from, to, note) => DB.lead_events.push({ id: uuid(), lead_id, actor_id: me ? me.id : null, from_status: from, to_status: to, note: note || null, created_at: nowISO() });
  const done = v => { saveDemo(); return Promise.resolve(v); };
  const queueWA = (phone, template, params, lead_id, booking_id) => { if (isPhone(phone || "")) DB.notifications.push({ id: (DB.notifications.reduce((m, n) => Math.max(m, n.id), 0) + 1), to_phone: phone, template, params: params.map(String), status: "sent", simulated: true, lead_id: lead_id || null, booking_id: booking_id || null, created_at: nowISO(), sent_at: nowISO() }); };
  const partnerPhone = id => (byId("partners", id) || {}).phone;
  const newCharge = (kind, partner_id, customer_id, booking_id, description, base, opt) => {
    opt = opt || {}; let gst = Math.round(base * (DB.settings.gst_percent || 0)) / 100;
    if (opt.inclusive) { const total = base; base = +(total / (1 + (DB.settings.gst_percent || 0) / 100)).toFixed(2); gst = +(total - base).toFixed(2); }
    const c = { id: uuid(), ref_code: ref("PY"), kind, partner_id: partner_id || null, customer_id: customer_id || null, booking_id: booking_id || null, lead_id: opt.lead_id || null, description, base_amount: base, gst_amount: gst, amount: +(base + gst).toFixed(2),
      status: "due", gateway: "razorpay", gateway_order_id: null, gateway_payment_id: null, paid_via: null, paid_at: null, created_at: nowISO() };
    DB.charges.push(c); queueWA(partner_id ? partnerPhone(partner_id) : (byId("profiles", customer_id) || {}).phone, "cb_payment_due", [description, c.amount, c.ref_code], null, booking_id); return c;
  };
  const markPaid = (c, payId, via) => {
    if (c.status === "paid") return c;
    c.status = "paid"; c.gateway_payment_id = payId; c.paid_via = via; c.paid_at = nowISO();
    if (c.kind === "registration_fee") { const p = byId("partners", c.partner_id); if (p) { p.fee_paid_at = p.fee_paid_at || nowISO(); if (p.status === "pending" && p.approved_at) p.status = "active";
      // registration + payment done: create the partner's login at once and send username + one-time password on WhatsApp
      let pr = DB.profiles.find(x => x.phone === p.phone);
      if (!pr) { pr = { id: uuid(), role: p.type, full_name: p.name, phone: p.phone, email: p.email || "", partner_id: p.id, disabled: false }; DB.profiles.push(pr); }
      else if (!pr.partner_id && pr.role === "customer") { pr.role = p.type; pr.partner_id = p.id; pr.email = pr.email || p.email || ""; }
      if (!pr.pw) issued = issueLogin(pr, "cb_partner_credentials");
      queueWA(p.phone, "cb_partner_registered", [p.name, p.type.toUpperCase(), c.ref_code]); } }
    queueWA(c.partner_id ? partnerPhone(c.partner_id) : (byId("profiles", c.customer_id) || {}).phone, "cb_payment_received", [c.ref_code, c.amount, c.description]); return c;
  };
  const issueLogin = (p, template) => {
    const temp = genTempPw(); p.pw = demoHash(temp, p.id); p.must_change = true; p.pw_set_at = nowISO();
    // the real WhatsApp message carries the one-time password; the log keeps it masked
    queueWA(p.phone, template, [p.full_name || "", p.phone, "one-time password (hidden in log)"]);
    return { username: p.phone, temp_password: temp, name: p.full_name || "", role: p.role };
  };
  const pickPartners = (pin, planId) => {
    const pl = planId ? byId("plans", planId) : null, open = id => DB.leads.filter(x => x.assigned_dsa_id === id && !["installed", "lost"].includes(x.status)).length;
    const dsa = DB.partners.filter(p => p.type === "dsa" && p.status === "active" && (p.service_pincodes || "").split(",").map(x => x.trim()).includes(pin)).sort((a, b) => open(a.id) - open(b.id))[0];
    const locIds = DB.locations.filter(x => x.pincode === pin).map(x => x.id);
    const cov = DB.coverage.find(c => c.is_active && locIds.includes(c.location_id) && c.tip_partner_id && (!pl || c.provider_id === pl.provider_id) && (byId("partners", c.tip_partner_id) || {}).status === "active");
    return { dsa: dsa ? dsa.id : null, tip: cov ? cov.tip_partner_id : null };
  };
  const autoAssign = l => {   // mirrors the leads_auto_assign database trigger
    if (!Number(DB.settings.auto_assign) || l.assigned_dsa_id || l.assigned_tip_id) return;
    const pp = pickPartners(l.pincode, l.plan_id), dsa = pp.dsa, tip = ["sim", "ott"].includes(l.product) ? null : pp.tip; if (!dsa && !tip) return;
    l.assigned_dsa_id = dsa; l.assigned_tip_id = tip; l.assigned_at = nowISO(); l.status = "assigned";
    DB.lead_events.push({ id: uuid(), lead_id: l.id, actor_id: null, from_status: "new", to_status: "assigned", note: "Auto-assigned by PIN code", created_at: nowISO() });
    [dsa, tip].filter(Boolean).forEach(pid => queueWA(partnerPhone(pid), "cb_new_lead", [l.ref_code, l.name, l.phone, l.pincode], l.id));
  };
  const providerByName = n => DB.providers.find(p => p.name.toLowerCase() === String(n || "").trim().toLowerCase());
  const yes = v => ["Y", "YES", "TRUE", "1"].includes(String(v || "").trim().toUpperCase());
  const linkPartner = p => {
    if (p.role !== "customer" || p.partner_id) return;
    const pt = DB.partners.find(x => x.phone === p.phone && x.approved_at && x.status !== "suspended");
    if (pt) { p.role = pt.type; p.partner_id = pt.id; p.full_name = p.full_name || pt.name; }
  };
  const wrap = fn => (...a) => { try { return Promise.resolve(fn(...a)); } catch (e) { return Promise.reject(e); } };

  return {
    mode: "demo",
    /* ---- auth ---- */
    demoAccounts: () => DB.profiles.map(p => ({ id: p.id, role: p.role, full_name: p.full_name, partner: p.partner_id ? partnerName(p.partner_id) : null })),
    signInDemo: wrap(id => { me = DB.profiles.find(p => p.id === id) || null; return me; }),
    restore: wrap(id => { me = DB.profiles.find(p => p.id === id) || null; return me; }),
    signOut: wrap(() => { me = null; otpFresh = false; }),
    me: () => me,
    /* WhatsApp OTP (demo: no message is sent, the OTP is always 123456) */
    sendOtp: wrap(phone => { if (!isPhone(phone)) fail("Enter a valid 10-digit WhatsApp number."); return { channel: "whatsapp", demo: true }; }),
    verifyOtp: wrap((phone, otp, name) => {
      if (otp !== "123456") fail("Incorrect OTP. Please check and try again.");
      let p = DB.profiles.find(x => x.phone === phone);
      if (!p) { p = { id: uuid(), role: "customer", full_name: (name || "").trim() || "", phone, partner_id: null }; DB.profiles.push(p); }
      else if (!p.full_name && name) p.full_name = name.trim();
      if (p.disabled) fail("This login is disabled. Please contact Connect Bhai admin.");
      linkPartner(p); me = p; otpFresh = true; saveDemo(); return me;
    }),
    setMyName: wrap(n => { if (!me) fail("Log in first."); me.full_name = n.trim(); saveDemo(); return me; }),

    /* ---- speed tests ---- */
    recordSpeedTest: wrap((bookingId, r) => {
      if (!me) fail("Log in to save results.");
      if (bookingId) { const b = byId("bookings", bookingId); if (!b || !canSeeBooking(b)) fail("Connection not found."); }
      const t = { id: uuid(), booking_id: bookingId || null, user_id: me.id, kind: "browser", status: "done", download_mbps: +r.down.toFixed(2), upload_mbps: +r.up.toFixed(2),
        ping_ms: Math.round(r.ping), jitter_ms: Math.round(r.jit), is_simulated: !!r.simulated, created_at: nowISO() };
      DB.speed_tests.push(t); return done(t);
    }),
    speedTests: wrap(bookingId => { const b = byId("bookings", bookingId); if (!b || !canSeeBooking(b)) fail("Connection not found.");
      return DB.speed_tests.filter(t => t.booking_id === bookingId).sort((a, b2) => b2.created_at.localeCompare(a.created_at)).slice(0, 6); }),
    routerTest: (bookingId, onQueued) => {
      try {
        const b = byId("bookings", bookingId); if (!b || !canSeeBooking(b) || b.status !== "installed") fail("Connection not found.");
        if (!b.ont_serial) fail("This modem is not on the Care plan (through GenieACS) yet. The installer must add the ONT serial number.");
        const p = byId("plans", b.plan_id) || { speed_mbps: 100 };
        if (onQueued) onQueued();
        return new Promise(res => setTimeout(() => {
          const t = { id: uuid(), booking_id: b.id, user_id: me.id, kind: "router", status: "done", download_mbps: +(p.speed_mbps * (0.88 + Math.random() * 0.1)).toFixed(1),
            upload_mbps: null, ping_ms: null, jitter_ms: null, is_simulated: true, created_at: nowISO() };
          DB.speed_tests.push(t); saveDemo(); res(t);
        }, 2600));
      } catch (e) { return Promise.reject(e); }
    },

    /* ---- public catalogue ---- */
    catalog: wrap(category => DB.plans.filter(p => p.is_active && p.status === "live" && p.category === category && (byId("providers", p.provider_id) || {}).is_active).map(p => plan(p.id))),
    searchPlans: wrap((pin, category) => {
      const locs = DB.locations.filter(l => l.pincode === pin);
      const cov = DB.coverage.filter(c => c.is_active && locs.some(l => l.id === c.location_id));
      const pids = [...new Set(cov.map(c => c.provider_id))].filter(id => (byId("providers", id) || {}).is_active);
      const plans = DB.plans.filter(p => p.is_active && p.status === "live" && (p.category || "fiber") === (category || "fiber") && pids.includes(p.provider_id)).map(p => Object.assign(plan(p.id), { technology: (cov.find(c => c.provider_id === p.provider_id) || {}).technology }));
      return { areas: locs.map(l => l.area), plans };
    }),
    popularPins: wrap(() => [...new Set(DB.locations.map(l => l.pincode))].map(pin => { const ls = DB.locations.filter(l => l.pincode === pin); return { pin, area: ls.map(l => l.area).join(", "), city_id: cityIdOfLoc(ls[0]) }; })),
    cities: wrap(() => DB.cities.filter(c => c.status !== "hidden").map(c => Object.assign({}, c))),
    joinWaitlist: wrap(f => {
      const c = DB.cities.find(x => x.id === f.city_id && x.status !== "hidden"); if (!c) fail("Choose your city.");
      if (c.status === "live") fail(c.name + " is already live. Search your PIN code to see plans.");
      if (!f.consent) fail("Please agree so we can message you at launch."); if (!isPhone(f.phone)) fail("Enter a valid 10-digit mobile number.");
      if (!f.name || f.name.trim().length < 2) fail("Enter your name."); if (f.pincode && !isPin(f.pincode)) fail("Enter a valid 6-digit PIN code.");
      let w = DB.waitlist.find(x => x.city_id === c.id && x.phone === f.phone);
      if (w) Object.assign(w, { name: f.name.trim(), pincode: f.pincode || w.pincode, interest: f.interest || w.interest });
      else { w = { id: uuid(), city_id: c.id, name: f.name.trim(), phone: f.phone, pincode: f.pincode || null, interest: f.interest || null, status: "waiting", consent: true, created_at: nowISO(), notified_at: null }; DB.waitlist.push(w); queueWA(f.phone, "cb_waitlist_joined", [w.name, c.name]); }
      return done({ city: c.name, waiting: DB.waitlist.filter(x => x.city_id === c.id && x.status === "waiting").length });
    }),
    requestConnection: wrap(f => {
      if (!f.consent) fail("Please agree to be contacted.");
      if (!isPhone(f.phone)) fail("Enter a valid 10-digit mobile number.");
      if (!isPin(f.pincode)) fail("Enter a valid 6-digit PIN code.");
      if (f.preferred_date && f.preferred_date < todayISO()) fail("Preferred date cannot be in the past.");
      const pl = f.plan_id ? byId("plans", f.plan_id) : null;
      if (f.plan_id && !(pl && pl.is_active && pl.status === "live")) fail("This plan is no longer available.");
      const product = pl ? productOf(pl.category) : (f.product || "broadband");
      if (product === "sim") { const sm = f.sim || {}; if (!["new", "port"].includes(sm.connection)) fail("Choose new SIM or port your number.");
        if (sm.connection === "port" && !isPhone(sm.port_number || "")) fail("Enter the mobile number to port."); }
      if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) fail("Enter a valid email.");
      if (me && me.role === "customer" && f.email && !me.email) me.email = f.email.trim();
      const l = { id: uuid(), ref_code: ref("CB"), customer_id: me && me.role === "customer" ? me.id : null, name: f.name.trim(), phone: f.phone, email: (f.email || "").trim() || null, pincode: f.pincode,
        area: f.area || null, address: f.address || null, plan_id: f.plan_id || null, preferred_date: f.preferred_date || null, source: f.plan_id ? "website" : "callback",
        lat: f.lat || null, lng: f.lng || null, location_source: f.lat ? "gps" : null, product, sim_request: product === "sim" ? f.sim : null,
        status: "new", assigned_dsa_id: null, assigned_tip_id: null, assigned_at: null, next_follow_up: null, consent: true, created_at: nowISO(), updated_at: nowISO() };
      DB.leads.push(l); event(l.id, null, "new", "Request received"); queueWA(l.phone, "cb_request_received", [l.name, l.ref_code], l.id); autoAssign(l);
      saveDemo(); return { lead_id: l.id, ref_code: l.ref_code };
    }),
    applyPartner: wrap(f => {
      if (!isPhone(f.phone)) fail("Enter a valid 10-digit mobile number.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email || "")) fail("Enter a valid email.");
      const old = DB.partners.find(x => x.phone === f.phone && x.status !== "suspended");
      if (old) { const due = DB.charges.find(c => c.partner_id === old.id && c.kind === "registration_fee" && ["due", "failed"].includes(c.status));
        if (due) return { partner_id: old.id, charge: due, existing: true }; fail("This mobile number is already registered as a partner. Log in with WhatsApp OTP."); }
      const p = { id: uuid(), type: f.type, name: f.name.trim(), firm: f.firm || "", phone: f.phone, email: f.email.trim(), service_pincodes: f.pincodes || "",
        status: "pending", commission_per_install: f.type === "tip" ? 300 : 0, kyc_verified: false, created_at: nowISO() };
      DB.partners.push(p);
      const fee = Number(DB.settings["registration_fee_" + p.type]) || 0;   // fee is collected at registration, before admin approval
      const charge = fee > 0 ? newCharge("registration_fee", p.id, null, null, p.type.toUpperCase() + " registration fee", fee) : null;
      if (f.city_id && DB.cities.some(c => c.id === f.city_id)) p.city_id = f.city_id;
      saveDemo(); return { partner_id: p.id, charge };
    }),
    payPublicCharge: (id, method) => new Promise((res, rej) => setTimeout(() => {   // registration fee paid right after applying (no login yet)
      try {
        const c = byId("charges", id); if (!c || c.kind !== "registration_fee") fail("Payment not found.");
        if (!["due", "failed"].includes(c.status)) fail("This payment is already " + c.status + ".");
        c.gateway_order_id = "order_DEMO" + Date.now().toString(36); issued = null; markPaid(c, "pay_DEMO" + Date.now().toString(36), "razorpay_test:" + method); saveDemo(); res(Object.assign({}, c, issued ? { login: issued } : {}));
      } catch (e) { rej(e); }
    }, 1400)),

    /* ---- customer ---- */
    myLeads: wrap(() => { need("customer"); return DB.leads.filter(l => l.customer_id === me.id).map(leadOut).sort((a, b) => b.created_at.localeCompare(a.created_at)); }),
    myBookings: wrap(() => { need("customer"); return DB.bookings.filter(b => b.customer_id === me.id).map(bookingOut); }),
    myTickets: wrap(() => { need("customer"); return DB.tickets.filter(t => t.customer_id === me.id).sort((a, b) => b.created_at.localeCompare(a.created_at)); }),
    raiseTicket: wrap(f => {
      need("customer");
      let b = null;
      if (f.booking_id) { b = DB.bookings.find(x => x.id === f.booking_id && x.customer_id === me.id); if (!b) fail("Connection not found."); }
      else if (f.type === "complaint") fail("Choose the connection for a complaint.");
      if (!f.description || f.description.trim().length < 5) fail("Describe the issue in a few words.");
      const tk = { id: uuid(), ref_code: ref("TK"), customer_id: me.id, booking_id: b ? b.id : null, type: f.type, category: f.category, description: f.description.trim(),
        status: "open", assigned_tip_id: b ? b.tip_partner_id : null, resolution_note: null, created_at: nowISO(), resolved_at: null };
      DB.tickets.push(tk); if (tk.assigned_tip_id) queueWA(partnerPhone(tk.assigned_tip_id), "cb_new_ticket", [tk.ref_code, tk.category], null, tk.booking_id); return done(tk.ref_code);
    }),
    refreshDevice: wrap(bookingId => {
      const b = byId("bookings", bookingId);
      if (!b || b.status !== "installed" || !canSeeBooking(b)) fail("You do not have access to this action.");
      const d = DB.device_status.find(x => x.booking_id === bookingId);
      d.state = Math.random() < 0.85 ? "online" : "offline"; d.last_seen = new Date(Date.now() - Math.random() * 6e5).toISOString(); d.is_simulated = true;
      if (d.acs) { d.rx_dbm = +((d.rx_dbm || -20) + (Math.random() - 0.5) * 0.6).toFixed(1); d.clients = d.state === "online" ? Math.max(1, (d.clients || 2) + Math.round((Math.random() - 0.5) * 2)) : 0; d.wan = d.state === "online" ? "Connected" : "Down"; }
      return done(d);
    }),
    /* GenieACS commands. Live: the "genieacs" edge function finds the modem by ONT serial on the right ACS
       (the TIP's own GenieACS or Connect Bhai's) and posts a task with ?connection_request. */
    deviceAction: (bookingId, action, p) => new Promise((res, rej) => setTimeout(() => { try {
      p = p || {};
      const b = byId("bookings", bookingId);
      if (!b || b.status !== "installed" || !(isAdmin() || (me && ((me.role === "customer" && b.customer_id === me.id) || (me.role === "tip" && b.tip_partner_id === me.partner_id))))) fail("You do not have access to this modem.");
      const d = DB.device_status.find(x => x.booking_id === b.id), tip = byId("partners", b.tip_partner_id);
      if (!b.ont_serial || !d || !d.acs) fail("This modem is not linked to GenieACS yet. The installer adds the ONT serial, and admin sets the ACS for this TIP partner.");
      if (!(tip && tip.acs_agreement) || (d.acs === "partner" && !tip.acs_key_set)) fail("The TIP partner's GenieACS access is not complete (API key or written agreement missing). Ask Connect Bhai admin.");
      if (d.state !== "online") fail("The modem is offline, so it cannot take commands. Check power and fiber, or raise a complaint.");
      const l = byId("leads", b.lead_id);
      const log = (what, detail) => DB.device_actions.push({ id: uuid(), booking_id: b.id, action: what, detail: detail || null, by_id: me.id, by_role: me.role, by_name: me.partner_id ? partnerName(me.partner_id) : (me.full_name || "User"), acs: d.acs, status: "done", simulated: true, created_at: nowISO() });
      if (action === "reboot") {
        d.uptime_h = 0; d.reboots_7d = (d.reboots_7d || 0) + 1; d.reboots_30d = (d.reboots_30d || 0) + 1; d.last_seen = nowISO(); log("reboot");
        if (l) queueWA(l.phone, "cb_modem_restarted", [l.name, b.connection_ref || b.ref_code], l.id, b.id);
      } else if (action === "wifi") {
        const ssid = String(p.ssid || "").trim(), pw = String(p.password || "");
        if (!ssid && !pw) fail("Enter a new Wi-Fi name, a new password, or both.");
        if (ssid && (ssid.length > 32 || !/^[\x20-\x7E]+$/.test(ssid))) fail("Wi-Fi name: up to 32 English letters, digits or symbols.");
        if (ssid && ssid === d.ssid) fail("The new Wi-Fi name is the same as the current one.");
        if (pw && (pw.length < 8 || pw.length > 63)) fail("Wi-Fi password: 8 to 63 characters.");
        if (ssid) d.ssid = ssid; d.clients = 0; d.last_seen = nowISO();
        log("wifi", [ssid ? "Name → " + ssid : "", pw ? "Password changed" : ""].filter(Boolean).join(" · "));   // the password itself is never stored in the log
        if (l) queueWA(l.phone, "cb_wifi_changed", [l.name, d.ssid], l.id, b.id);
      } else fail("Unknown modem action.");
      saveDemo(); res(Object.assign({}, d));
    } catch (e) { rej(e); } }, 1500)),
    deviceLog: wrap(bookingId => { const b = byId("bookings", bookingId); if (!b || !canSeeBooking(b)) fail("Connection not found.");
      return DB.device_actions.filter(a => a.booking_id === bookingId).sort((a, c) => c.created_at.localeCompare(a.created_at)).slice(0, 6); }),
    adminAcs: wrap(() => { need("admin"); return DB.partners.filter(p => p.type === "tip").map(p => Object.assign({}, p, { linked: DB.bookings.filter(b => b.tip_partner_id === p.id && b.status === "installed" && b.ont_serial).length })); }),
    saveAcs: wrap((id, f) => {
      need("admin"); const p = byId("partners", id); if (!p || p.type !== "tip") fail("TIP partner not found.");
      if (!["partner", "connectbhai", ""].includes(f.mode || "")) fail("Choose the ACS.");
      if (f.mode === "partner" && !/^https?:\/\/\S+$/.test(f.url || "")) fail("Enter the partner's GenieACS API (NBI) address, e.g. http://acs.partner.in:7557");
      if (f.mode === "partner" && !(p.acs_mode === "partner" && p.acs_key_set) && !f.key) fail("Enter the API key the partner gave you.");
      if (f.mode && !f.agreement) fail("Get the written agreement from the partner first.");
      p.acs_mode = f.mode || null; p.acs_url = f.mode === "partner" ? f.url.trim() : f.mode === "connectbhai" ? "http://acs.connectbhai.in:7557" : "";
      p.acs_key_set = f.mode === "connectbhai" ? true : f.mode === "partner" ? (!!f.key || (p.acs_key_set && p.acs_mode === "partner")) : false;
      p.acs_agreement = !!f.agreement; p.acs_updated_at = nowISO();
      DB.bookings.filter(b => b.tip_partner_id === id && b.ont_serial).forEach(b => { const d = DB.device_status.find(x => x.booking_id === b.id); if (d) d.acs = p.acs_mode; });
      return done(true);
    }),

    /* ---- partners (DSA / TIP) ---- */
    partnerLeads: wrap(() => { need("dsa", "tip"); return DB.leads.filter(canSeeLead).map(leadOut).sort((a, b) => b.updated_at.localeCompare(a.updated_at)); }),
    leadDetail: wrap(id => { const l = byId("leads", id); if (!l || !canSeeLead(l)) fail("Lead not found."); return Object.assign(leadOut(l), { events: DB.lead_events.filter(e => e.lead_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)) }); }),
    updateLeadStatus: wrap((id, status, note, next) => {
      const l = byId("leads", id); if (!l) fail("Lead not found.");
      if (!(isAdmin() || (me && me.role === "dsa" && l.assigned_dsa_id === me.partner_id) || (me && me.role === "tip" && l.assigned_tip_id === me.partner_id))) fail("You do not have access to this lead.");
      if (!(LEAD_NEXT[l.status] || []).includes(status)) fail(`Status cannot change from ${LEAD[l.status]} to ${LEAD[status]}.`);
      if (status === "follow_up" && !next) fail("Choose a follow-up date.");
      const from = l.status; l.status = status; l.next_follow_up = next || null; l.updated_at = nowISO(); event(id, from, status, note);
      return done(true);
    }),
    partnerBookings: wrap(() => { need("tip", "dsa"); return DB.bookings.filter(canSeeBooking).map(bookingOut).sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || "")); }),
    createBooking: wrap((leadId, date) => {
      const l = byId("leads", leadId); if (!l) fail("Lead not found.");
      if (!(isAdmin() || (me && me.role === "tip" && l.assigned_tip_id === me.partner_id))) fail("Only the assigned TIP partner or admin can book.");
      if (!["assigned", "contacted", "follow_up"].includes(l.status)) fail("Lead is not ready for booking.");
      if (!l.plan_id) fail("Select a plan on this lead first.");
      if (!date || date < todayISO()) fail("Choose today or a future date.");
      const b = { id: uuid(), ref_code: ref("BK"), lead_id: l.id, customer_id: l.customer_id, plan_id: l.plan_id, tip_partner_id: l.assigned_tip_id, dsa_partner_id: l.assigned_dsa_id,
        status: "scheduled", scheduled_date: date, installed_at: null, connection_ref: null, authorized: false, created_at: nowISO() };
      DB.bookings.push(b); DB.device_status.push({ booking_id: b.id, state: "unknown", last_seen: null, is_simulated: true, source: "simulated" });
      const from = l.status; l.status = "booked"; l.updated_at = nowISO(); event(l.id, from, "booked", "Installation scheduled for " + fdate(date));
      const pl = byId("plans", l.plan_id); if (pl && Number(pl.install_charge) > 0 && l.customer_id) newCharge("customer_payment", null, l.customer_id, b.id, "Installation charge · " + pl.name, Number(pl.install_charge));
      queueWA(l.phone, "cb_install_scheduled", [l.name, l.ref_code, fdate(date)], l.id, b.id);
      return done(b.ref_code);
    }),
    updateBookingStatus: wrap((id, status, connRef, ont) => {
      const b = byId("bookings", id); if (!b) fail("Booking not found.");
      if (!(isAdmin() || (me && me.role === "tip" && b.tip_partner_id === me.partner_id))) fail("You do not have access to this booking.");
      if (!(BOOK_NEXT[b.status] || []).includes(status)) fail(`Status cannot change from ${BOOK[b.status]} to ${BOOK[status]}.`);
      if (status === "installed" && !(connRef || "").trim()) fail("Enter the connection reference to mark as installed.");
      if (ont && DB.bookings.some(x => x.id !== b.id && x.ont_serial === ont.trim().toUpperCase())) fail("This ONT serial is already linked to another connection.");
      b.status = status; if (connRef) b.connection_ref = connRef.trim(); if (ont) b.ont_serial = ont.trim().toUpperCase();
      const l = byId("leads", b.lead_id);
      if (b.ont_serial) {   // linking the ONT serial puts the modem on this TIP's ACS (their own GenieACS or Connect Bhai's)
        const d0 = DB.device_status.find(x => x.booking_id === b.id), tp = byId("partners", b.tip_partner_id);
        if (d0) { d0.acs = (tp && tp.acs_mode) || null; if (!d0.model) Object.assign(d0, { make: "Syrotech", model: "SY-GPON-2010-WADONT", firmware: "V3.2.18", rx_dbm: -19.5, ssid: (l.name || "Home").split(" ")[0] + "_WiFi", clients: 1, uptime_h: 0, reboots_7d: 0, reboots_30d: 0 }); }
      }
      if (status === "installed") {
        b.installed_at = nowISO(); b.authorized = true; l.status = "installed"; event(l.id, "booked", "installed", "Installed and authorised");
        const dsa = byId("partners", b.dsa_partner_id);   // DSA payout: Connect Bhai pays the DSA
        if (dsa && dsa.commission_per_install > 0 && !DB.commissions.some(c => c.partner_id === dsa.id && c.booking_id === b.id))
          DB.commissions.push({ id: uuid(), partner_id: dsa.id, booking_id: b.id, amount: dsa.commission_per_install, status: "pending", payment_id: null, created_at: nowISO() });
        const tip = byId("partners", b.tip_partner_id);   // TIP platform fee: TIP pays Connect Bhai
        if (tip && tip.commission_per_install > 0 && !DB.charges.some(c => c.booking_id === b.id && c.kind === "platform_fee"))
          newCharge("platform_fee", tip.id, null, b.id, "Platform fee · " + l.ref_code + " · " + l.name, Number(tip.commission_per_install));
        queueWA(l.phone, "cb_installed", [l.name, b.connection_ref || ""], l.id, b.id);
        const d = DB.device_status.find(x => x.booking_id === b.id); if (d) { d.state = "online"; d.last_seen = nowISO(); }
      } else if (status === "cancelled") { l.status = "lost"; event(l.id, "booked", "lost", "Booking cancelled"); DB.charges.filter(c => c.booking_id === b.id && c.status === "due").forEach(c => (c.status = "cancelled")); }
      l.updated_at = nowISO();
      return done(true);
    }),
    partnerTickets: wrap(() => { need("tip"); return DB.tickets.filter(t => t.assigned_tip_id === me.partner_id).map(t => Object.assign({}, t, { booking: bookingOut(byId("bookings", t.booking_id) || {}) })); }),
    updateTicket: wrap((id, status, note) => {
      const t = byId("tickets", id); if (!t) fail("Ticket not found.");
      if (!(isAdmin() || (me && me.role === "tip" && t.assigned_tip_id === me.partner_id))) fail("You do not have access to this ticket.");
      const changed = t.status !== status; t.status = status; if (note) t.resolution_note = note; if (["resolved", "closed"].includes(status) && !t.resolved_at) t.resolved_at = nowISO();
      if (changed) queueWA((byId("profiles", t.customer_id) || {}).phone, "cb_ticket_update", [t.ref_code, status, t.resolution_note || ""], null, t.booking_id);
      return done(true);
    }),
    myCommissions: wrap(() => { need("dsa", "tip"); return DB.commissions.filter(c => c.partner_id === me.partner_id).map(c => Object.assign({}, c, { booking: bookingOut(byId("bookings", c.booking_id)) })); }),
    myPartner: wrap(() => { need("dsa", "tip"); return byId("partners", me.partner_id); }),

    /* ---- admin ---- */
    adminLeads: wrap(() => { need("admin"); return DB.leads.map(leadOut).sort((a, b) => b.created_at.localeCompare(a.created_at)); }),
    assignLead: wrap((id, dsa, tip) => {
      need("admin"); const l = byId("leads", id); if (!l) fail("Lead not found.");
      if (!dsa && !tip) fail("Choose a DSA or a TIP partner.");
      if (dsa && !DB.partners.some(p => p.id === dsa && p.type === "dsa" && p.status === "active")) fail("Selected DSA is not active.");
      if (tip && !DB.partners.some(p => p.id === tip && p.type === "tip" && p.status === "active")) fail("Selected TIP partner is not active.");
      if (["installed", "lost"].includes(l.status)) fail("Closed leads cannot be reassigned.");
      if (dsa && dsa !== l.assigned_dsa_id) queueWA(partnerPhone(dsa), "cb_new_lead", [l.ref_code, l.name, l.phone, l.pincode], l.id);
      if (tip && tip !== l.assigned_tip_id) queueWA(partnerPhone(tip), "cb_new_lead", [l.ref_code, l.name, l.phone, l.pincode], l.id);
      const from = l.status; l.assigned_dsa_id = dsa || null; l.assigned_tip_id = tip || null; l.assigned_at = nowISO(); l.assigned_by = me.id;
      if (l.status === "new") l.status = "assigned"; l.updated_at = nowISO(); event(id, from, l.status, "Assigned by admin");
      return done(true);
    }),
    adminPartners: wrap(() => { need("admin"); return DB.partners.slice().sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)); }),
    savePartner: wrap(f => {
      need("admin"); if (!isPhone(f.phone)) fail("Enter a valid 10-digit mobile number."); if (!f.name || f.name.trim().length < 2) fail("Enter the partner name.");
      const amt = Number(f.commission_per_install); if (!(amt >= 0)) fail("Commission must be 0 or more.");
      let p = f.id ? byId("partners", f.id) : null;
      if (!p) { p = { id: uuid(), status: "active", kyc_verified: false, created_at: nowISO() }; DB.partners.push(p); }
      Object.assign(p, { type: f.type, name: f.name.trim(), firm: f.firm || "", phone: f.phone, email: f.email || "", service_pincodes: f.service_pincodes || "", commission_per_install: amt, kyc_verified: !!f.kyc_verified, lead_target: Number(f.lead_target) || null });
      return done(true);
    }),
    setPartnerStatus: wrap((id, status) => { need("admin"); const p = byId("partners", id);
      if (status === "active" && !p.fee_paid_at && !DB.charges.some(c => c.partner_id === id && c.kind === "registration_fee" && ["paid", "waived"].includes(c.status)) && Number(DB.settings["registration_fee_" + p.type]) > 0) fail("Registration fee is not paid yet. Approve the partner so the fee becomes due, or waive it in Billing.");
      p.status = status; return done(true); }),
    approvePartner: wrap(id => {
      need("admin"); const p = byId("partners", id);
      if (!p.kyc_verified) fail("Verify KYC and agreement first (Edit partner).");
      if (p.status !== "pending") fail("Partner is already " + p.status + ".");
      const fee = Number(DB.settings["registration_fee_" + p.type]) || 0;
      const feeDone = !!p.fee_paid_at || DB.charges.some(c => c.partner_id === p.id && c.kind === "registration_fee" && ["paid", "waived"].includes(c.status));
      p.approved_at = nowISO(); if (fee <= 0 || feeDone) p.status = "active";
      if (fee > 0 && !feeDone && !DB.charges.some(c => c.partner_id === p.id && c.kind === "registration_fee" && c.status === "due")) newCharge("registration_fee", p.id, null, null, p.type.toUpperCase() + " registration fee", fee);
      queueWA(p.phone, "cb_partner_approved", [p.name, fee && !feeDone ? (fee * (1 + DB.settings.gst_percent / 100)).toFixed(2) : "0"]);
      return done(true);
    }),
    /* ---- billing (money coming in to Connect Bhai) ---- */
    getSettings: wrap(() => Object.assign({}, DB.settings)),
    setAutoAssign: wrap(on => { need("admin"); DB.settings.auto_assign = on ? 1 : 0; return done(true); }),
    dsaAddLead: wrap(f => {
      need("dsa"); const me_p = byId("partners", me.partner_id); if (!me_p || me_p.status !== "active") fail("Only active DSAs can add leads.");
      if (!f.consent) fail("Confirm the customer agreed to be contacted."); if (!isPhone(f.phone)) fail("Enter a valid 10-digit mobile number."); if (!isPin(f.pincode)) fail("Enter a valid 6-digit PIN code.");
      if (DB.leads.some(x => x.phone === f.phone && !["installed", "lost"].includes(x.status))) fail("This customer already has an open request.");
      const apl = f.plan_id ? byId("plans", f.plan_id) : null, product = apl ? productOf(apl.category) : "broadband";
      const tip = ["sim", "ott"].includes(product) ? null : pickPartners(f.pincode, f.plan_id || null).tip;
      const l = { id: uuid(), ref_code: ref("CB"), customer_id: null, product, name: f.name.trim(), phone: f.phone, pincode: f.pincode, area: f.area || null, address: f.address || null, plan_id: f.plan_id || null, preferred_date: null,
        source: "dsa", status: "assigned", assigned_dsa_id: me.partner_id, assigned_tip_id: tip, assigned_at: nowISO(), next_follow_up: null, consent: true, created_at: nowISO(), updated_at: nowISO() };
      DB.leads.push(l); event(l.id, null, "assigned", "Added by DSA"); queueWA(l.phone, "cb_request_received", [l.name, l.ref_code], l.id);
      if (tip) queueWA(partnerPhone(tip), "cb_new_lead", [l.ref_code, l.name, l.phone, l.pincode], l.id);
      return done({ ref_code: l.ref_code, tip: tip ? byId("partners", tip).name : null });
    }),
    saveSettings: wrap(o => { need("admin"); ["registration_fee_tip", "registration_fee_dsa", "gst_percent", "lead_target_default", "tip_share_percent"].forEach(k => { const v = Number(o[k]); if (!(v >= 0)) fail("Enter 0 or more."); DB.settings[k] = v; }); return done(true); }),
    myCharges: wrap(() => { if (!me) fail("Log in first."); return DB.charges.filter(c => (me.role === "customer" && c.customer_id === me.id) || (me.partner_id && c.partner_id === me.partner_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)); }),
    payCharge: (id, method) => new Promise((res, rej) => setTimeout(() => {
      try {
        const c = byId("charges", id); if (!c || !((me.role === "customer" && c.customer_id === me.id) || (me.partner_id && c.partner_id === me.partner_id))) fail("Payment not found.");
        if (!["due", "failed"].includes(c.status)) fail("This payment is already " + c.status + ".");
        c.gateway_order_id = "order_DEMO" + Date.now().toString(36); issued = null; markPaid(c, "pay_DEMO" + Date.now().toString(36), "razorpay_test:" + method); saveDemo(); res(Object.assign({}, c, issued ? { login: issued } : {}));
      } catch (e) { rej(e); }
    }, 1400)),
    /* ---- password login & management ---- */
    signInPassword: wrap((phone, pw) => {
      if (!isPhone(phone)) fail("Enter your 10-digit mobile number.");
      const p = DB.profiles.find(x => x.phone === phone);
      if (!p || !p.pw || p.pw !== demoHash(pw || "", p.id)) fail("Wrong mobile number or password. Use Forgot password to reset it.");
      if (p.disabled) fail("This login is disabled. Please contact Connect Bhai admin.");
      me = p; otpFresh = false; return me;
    }),
    changePassword: wrap((current, next) => {
      if (!me) fail("Log in first.");
      if (me.pw && !me.must_change && !otpFresh && me.pw !== demoHash(current || "", me.id)) fail("Your current password is not correct.");
      if (!pwOk(next)) fail("New password: " + PW_RULE);
      if (me.pw && me.pw === demoHash(next, me.id)) fail("Choose a password different from the old one.");
      me.pw = demoHash(next, me.id); me.must_change = false; me.pw_set_at = nowISO(); otpFresh = false;
      queueWA(me.phone, "cb_password_changed", [me.full_name || "", me.phone, fdt(new Date())]);
      return done(me);
    }),
    adminTeam: wrap(() => { need("admin"); return DB.profiles.map(p => ({ id: p.id, role: p.role, full_name: p.full_name, phone: p.phone, email: p.email || (p.partner_id && (byId("partners", p.partner_id) || {}).email) || "",
      partner: p.partner_id ? pc(p.partner_id) : null, has_password: !!p.pw, must_change: !!p.must_change, disabled: !!p.disabled, pw_set_at: p.pw_set_at || null })); }),
    adminCreateUser: wrap(f => {
      need("admin"); const role = f.role;
      if (!["admin", "dsa", "tip"].includes(role)) fail("Choose a role.");
      if (!f.name || f.name.trim().length < 2) fail("Enter the name."); if (!isPhone(f.phone)) fail("Enter a valid 10-digit mobile number.");
      if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) fail("Enter a valid email.");
      let pr = DB.profiles.find(x => x.phone === f.phone);
      if (pr && pr.role !== "customer") fail("A " + ROLE_NAME[pr.role] + " login already exists for this mobile number. Use Reset password instead.");
      let partner_id = null;
      if (role !== "admin") {
        let pt = DB.partners.find(x => x.phone === f.phone && x.type === role);
        if (!pt) { if (f.pincodes && !f.pincodes.split(",").every(x => isPin(x.trim()))) fail("Enter 6-digit PIN codes separated by commas.");
          pt = { id: uuid(), type: role, name: f.name.trim(), firm: (f.firm || "").trim(), phone: f.phone, email: (f.email || "").trim(), service_pincodes: f.pincodes || "", status: "active", commission_per_install: 300, kyc_verified: true, approved_at: nowISO(), fee_paid_at: null, fee_waived: true, created_by: me.id, created_at: nowISO() }; DB.partners.push(pt); }
        partner_id = pt.id;
      }
      if (!pr) { pr = { id: uuid(), phone: f.phone }; DB.profiles.push(pr); }
      Object.assign(pr, { role, full_name: f.name.trim(), email: (f.email || "").trim(), partner_id, disabled: false, created_by: me.id });
      return done(issueLogin(pr, "cb_login_created"));
    }),
    adminResetPassword: wrap(id => { need("admin"); const p = byId("profiles", id); if (!p) fail("User not found."); return done(issueLogin(p, "cb_password_reset")); }),
    adminSetDisabled: wrap((id, off) => { need("admin"); const p = byId("profiles", id); if (!p) fail("User not found."); if (p.id === me.id) fail("You cannot disable your own login.");
      if (off && p.role === "admin" && DB.profiles.filter(x => x.role === "admin" && !x.disabled).length <= 1) fail("Keep at least one active admin.");
      p.disabled = !!off; return done(true); }),
    customerPay: wrap(f => {   // customer starts a payment themselves (rental, installation, bill, router…)
      need("customer"); const amt = Number(f.amount);
      if (!(amt >= 1)) fail("Enter an amount of ₹1 or more."); if (amt > 200000) fail("Amount is too large for online payment.");
      if (!f.description || f.description.trim().length < 3) fail("Choose what you are paying for.");
      let l = null; if (f.lead_id) { l = DB.leads.find(x => x.id === f.lead_id && x.customer_id === me.id); if (!l) fail("Connection not found."); }
      const b = l ? DB.bookings.find(x => x.lead_id === l.id) : null;
      const c = newCharge("customer_payment", null, me.id, b ? b.id : null, f.description.trim() + (l ? " · " + l.ref_code : ""), +amt.toFixed(2), { inclusive: true, lead_id: l ? l.id : null });
      return done(c);
    }),
    setMyProfile: wrap(f => {
      if (!me) fail("Log in first."); if (!f.name || f.name.trim().length < 2) fail("Enter your name.");
      if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) fail("Enter a valid email.");
      me.full_name = f.name.trim(); me.email = (f.email || "").trim();
      if (me.partner_id) { const p = byId("partners", me.partner_id); if (p && me.email) p.email = me.email; }
      return done(me);
    }),
    /* ---- chat: one thread per connection request (customer + DSA + TIP + admin) and one support thread per user ---- */
    myThreads: wrap(() => {
      if (!me) fail("Log in first.");
      let ids = isAdmin() ? DB.leads.filter(l => l.status !== "lost" || DB.messages.some(m => m.thread === "lead:" + l.id)).map(l => "lead:" + l.id)
        .concat([...new Set(DB.messages.filter(m => m.thread.startsWith("sup:")).map(m => m.thread))])
        : DB.leads.filter(l => canSeeLead(l) && (l.status !== "lost" || DB.messages.some(m => m.thread === "lead:" + l.id))).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(l => "lead:" + l.id).concat(["sup:" + me.id]);
      const rd = DB.reads[me.id] || {};
      return ids.map(threadInfo).filter(Boolean).map(t => { const ms = DB.messages.filter(m => m.thread === t.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
        return Object.assign(t, { last: ms[ms.length - 1] || null, unread: ms.filter(m => m.sender_id !== me.id && m.created_at > (rd[t.id] || "")).length }); })
        .sort((a, b) => ((b.last && b.last.created_at) || "").localeCompare((a.last && a.last.created_at) || ""));
    }),
    threadMessages: wrap(id => {
      const t = threadInfo(id); if (!t) fail("Chat not found.");
      (DB.reads[me.id] = DB.reads[me.id] || {})[id] = nowISO(); saveDemo();
      return { thread: t, messages: DB.messages.filter(m => m.thread === id).sort((a, b) => a.created_at.localeCompare(b.created_at)) };
    }),
    sendMessage: wrap((id, body) => {
      const t = threadInfo(id); if (!t) fail("Chat not found."); body = (body || "").trim();
      if (!body) fail("Type a message."); if (body.length > 1000) fail("Message is too long (1000 characters max).");
      const m = { id: uuid(), thread: id, sender_id: me.id, sender_role: me.role, sender_name: me.partner_id ? partnerName(me.partner_id) : (me.full_name || "Customer"), body, created_at: nowISO() };
      DB.messages.push(m); (DB.reads[me.id] = DB.reads[me.id] || {})[id] = m.created_at;
      t.people.filter(p => p.phone && p.phone !== me.phone).forEach(p => queueWA(p.phone, "cb_new_message", [m.sender_name, t.title, body.slice(0, 60)]));
      return done(m);
    }),
    adminCharges: wrap(() => { need("admin"); return DB.charges.map(c => Object.assign({}, c, { partner: c.partner_id ? byId("partners", c.partner_id) : null, customer: c.customer_id ? byId("profiles", c.customer_id) : null })).sort((a, b) => b.created_at.localeCompare(a.created_at)); }),
    adminCustomers: wrap(() => { need("admin"); return DB.profiles.filter(p => p.role === "customer"); }),
    adminCreateCharge: wrap(f => {
      need("admin"); const base = Number(f.base); if (!(base > 0)) fail("Amount must be more than 0."); if (!f.description || f.description.trim().length < 3) fail("Add a description.");
      if (f.payer_type === "partner" ? !byId("partners", f.partner_id) : !byId("profiles", f.customer_id)) fail("Choose who pays.");
      const c = newCharge(f.kind, f.payer_type === "partner" ? f.partner_id : null, f.payer_type === "customer" ? f.customer_id : null, null, f.description.trim(), base); return done(c.ref_code);
    }),
    adminSetCharge: wrap((id, action, reference) => {
      need("admin"); const c = byId("charges", id); if (!c) fail("Charge not found.");
      if (action === "paid_offline") { if (!(reference || "").trim()) fail("Enter the payment reference."); if (!["due", "failed"].includes(c.status)) fail("Only due payments can be marked paid."); markPaid(c, reference.trim(), "offline"); }
      else if (["waived", "cancelled"].includes(action)) { if (c.status !== "due") fail("Only due payments can be " + action + "."); c.status = action;
        if (action === "waived" && c.kind === "registration_fee") { const p = byId("partners", c.partner_id); if (p && p.status === "pending" && p.approved_at) p.status = "active"; } }
      else fail("Unknown action."); return done(true);
    }),
    adminNotifications: wrap(() => { need("admin"); return DB.notifications.slice().sort((a, b) => b.id - a.id); }),
    /* ---- location ---- */
    geoReverse: wrap((lat, lng) => {
      const near = [["452010", "Vijay Nagar", 22.753, 75.894], ["452001", "Rajwada", 22.718, 75.855], ["452009", "Annapurna", 22.695, 75.832], ["452016", "Nipania", 22.766, 75.912], ["452018", "Bhawarkuan", 22.693, 75.866]]
        .map(x => ({ x, d: (x[2] - lat) ** 2 + (x[3] - lng) ** 2 })).sort((a, b) => a.d - b.d)[0].x;
      return { pincode: near[0], area: near[1], city: "Indore", simulated: true };
    }),
    geoAreas: wrap(pin => { if (!isPin(pin)) fail("Enter a valid 6-digit PIN code."); const known = { "452010": ["Vijay Nagar", "Scheme No 54", "Scheme No 74"], "452001": ["Rajwada", "Indore GPO"], "452016": ["Nipania", "Bicholi Mardana"] };
      return { areas: (known[pin] || ["Area 1", "Area 2"]).map(n => ({ name: n, district: "Indore", state: "Madhya Pradesh" })), simulated: true }; }),
    adminProviders: wrap(() => { need("admin"); return DB.providers.slice(); }),
    saveProvider: wrap(f => {
      need("admin"); if (!f.name || f.name.trim().length < 2) fail("Enter the provider name.");
      if (DB.providers.some(p => p.name.toLowerCase() === f.name.trim().toLowerCase() && p.id !== f.id)) fail("A provider with this name already exists.");
      let p = f.id ? byId("providers", f.id) : null;
      if (!p) { p = { id: uuid(), is_active: true, is_demo: false }; DB.providers.push(p); }
      Object.assign(p, { name: f.name.trim(), kind: f.kind, website: f.website || "" }); return done(true);
    }),
    toggleProvider: wrap(id => { need("admin"); const p = byId("providers", id); p.is_active = !p.is_active; return done(true); }),
    adminPlans: wrap(() => { need("admin"); return DB.plans.map(p => Object.assign(plan(p.id), { submitter: p.submitted_partner ? byId("partners", p.submitted_partner) : null })).sort((a, b) => a.provider.name.localeCompare(b.provider.name) || a.price_monthly - b.price_monthly); }),
    adminImportPlans: wrap(rows => {
      need("admin"); let ins = 0, upd = 0;
      const prepared = rows.map(r => { const pv = providerByName(r.provider); if (!pv) fail(`Unknown provider "${r.provider}" (add it in Admin > Providers first).`); const v = planFromRow(r, pv.id);
        if (!v.plan_code) fail(`plan_code missing for "${v.name}".`); const verified = yes(r.verified); if (verified && !v.source_url) fail(`Verified plan ${v.plan_code} needs a source link.`); return { v, verified, active: r.active === undefined || r.active === "" ? true : yes(r.active) }; });
      prepared.forEach(({ v, verified, active }) => {
        let p = DB.plans.find(x => x.plan_code === v.plan_code && x.status !== "pending_review");
        if (!p) { p = { id: uuid(), is_demo: false }; DB.plans.push(p); ins++; } else upd++;
        Object.assign(p, v, { is_active: active, status: "live", verified_at: verified ? (p.verified_at || nowISO()) : null, updated_at: nowISO() });
      });
      return done({ inserted: ins, updated: upd });
    }),
    tipProviders: wrap(() => { need("tip"); const ids = [...new Set(DB.coverage.filter(c => c.tip_partner_id === me.partner_id).map(c => c.provider_id))]; return DB.providers.filter(p => ids.includes(p.id)); }),
    tipPlans: wrap(() => {
      need("tip"); const ids = [...new Set(DB.coverage.filter(c => c.tip_partner_id === me.partner_id).map(c => c.provider_id))];
      return { live: DB.plans.filter(p => p.status === "live" && p.is_active && ids.includes(p.provider_id)).map(p => plan(p.id)),
        mine: DB.plans.filter(p => p.submitted_partner === me.partner_id).map(p => Object.assign(plan(p.id), { replaces: p.replaces_plan ? plan(p.replaces_plan) : null })).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")) };
    }),
    tipSubmitPlans: wrap(rows => {
      need("tip"); const pt = byId("partners", me.partner_id); if (!pt || pt.status !== "active") fail("Only active TIP partners can submit plans.");
      const mine = DB.coverage.filter(c => c.tip_partner_id === me.partner_id).map(c => c.provider_id);
      const prepared = rows.map(r => { const pv = providerByName(r.provider); if (!pv || !mine.includes(pv.id)) fail(`You can submit plans only for providers you install (${r.provider || "?"}).`); return planFromRow(r, pv.id); });
      prepared.forEach(v => { const old = v.plan_code ? DB.plans.find(x => x.plan_code === v.plan_code && x.status === "live") : null;
        DB.plans.push(Object.assign({ id: uuid(), is_demo: false }, v, { plan_code: null, is_active: false, status: "pending_review", submitted_by: me.id, submitted_partner: me.partner_id,
          replaces_plan: old ? old.id : null, wanted_code: v.plan_code, created_at: nowISO() })); });
      return done(prepared.length);
    }),
    adminReviewPlan: wrap((id, approve, note) => {
      need("admin"); const sub = DB.plans.find(p => p.id === id && p.status === "pending_review"); if (!sub) fail("Submission not found.");
      if (!approve) { sub.status = "rejected"; sub.review_note = (note || "").trim() || null; return done(true); }
      if (sub.replaces_plan) { const o = byId("plans", sub.replaces_plan);
        ["name", "category", "speed_mbps", "price_monthly", "validity_days", "data_limit_gb", "data_per_day_gb", "voice", "sms_per_day", "ott_apps", "tv_channels", "install_charge"].forEach(k => (o[k] = sub[k]));
        o.source_url = sub.source_url || o.source_url; o.verified_at = nowISO(); sub.status = "rejected"; sub.review_note = "Applied to existing plan"; }
      else { Object.assign(sub, { status: "live", is_active: true, plan_code: sub.wanted_code || ("TIP-" + sub.id.slice(-8).toUpperCase()), verified_at: nowISO(), review_note: (note || "").trim() || null }); }
      return done(true);
    }),
    dsaActivateSim: wrap((leadId, reference) => {
      const l = byId("leads", leadId); if (!l) fail("Lead not found.");
      if (!(isAdmin() || (me && me.role === "dsa" && l.assigned_dsa_id === me.partner_id))) fail("You do not have access to this lead.");
      if (!["sim", "ott"].includes(l.product)) fail("Use installation booking for this connection.");
      if (!["assigned", "contacted", "follow_up"].includes(l.status)) fail("Lead is not open.");
      if (!(reference || "").trim()) fail("Enter the activation reference.");
      const b = { id: uuid(), ref_code: ref("BK"), lead_id: l.id, customer_id: l.customer_id, plan_id: l.plan_id, tip_partner_id: null, dsa_partner_id: l.assigned_dsa_id, status: "installed",
        scheduled_date: todayISO(), installed_at: nowISO(), connection_ref: reference.trim(), ont_serial: null, authorized: true, created_at: nowISO() };
      DB.bookings.push(b); const from = l.status; l.status = "installed"; l.updated_at = nowISO(); event(l.id, from, "installed", "Activated · " + reference.trim());
      const d = byId("partners", l.assigned_dsa_id); if (d && d.commission_per_install > 0) DB.commissions.push({ id: uuid(), partner_id: d.id, booking_id: b.id, amount: d.commission_per_install, status: "pending", payment_id: null, created_at: nowISO() });
      queueWA(l.phone, "cb_sim_activated", [l.name, l.ref_code], l.id, b.id); return done(b.ref_code);
    }),
    savePlan: wrap(f => {
      need("admin");
      if (!byId("providers", f.provider_id)) fail("Choose a provider.");
      if (!f.name || f.name.trim().length < 2) fail("Enter the plan name.");
      const sp = Number(f.speed_mbps), pr = Number(f.price_monthly), cat = f.category || "fiber";
      if (["fiber", "air_fiber"].includes(cat) && !(sp > 0)) fail("Speed must be more than 0 Mbps."); if (!(pr >= 0)) fail("Enter a valid price.");
      if (f.plan_code && DB.plans.some(x => x.plan_code === f.plan_code.trim().toUpperCase() && x.id !== f.id)) fail("Another plan already uses this plan code.");
      if (f.verified && !(f.source_url || "").trim()) fail("Add the source link you verified the tariff from.");
      let p = f.id ? byId("plans", f.id) : null;
      if (!p) { p = { id: uuid(), is_active: true, is_demo: false }; DB.plans.push(p); }
      Object.assign(p, { provider_id: f.provider_id, category: cat, plan_code: (f.plan_code || "").trim().toUpperCase() || p.plan_code || ("CB-" + p.id.slice(-6).toUpperCase()), status: "live",
        data_per_day_gb: f.data_per_day_gb ? Number(f.data_per_day_gb) : null, voice: f.voice || null, sms_per_day: f.sms_per_day ? Number(f.sms_per_day) : null,
        name: f.name.trim(), speed_mbps: sp > 0 ? sp : null, price_monthly: pr, data_limit_gb: f.data_limit_gb ? Number(f.data_limit_gb) : null,
        validity_days: Number(f.validity_days) || 30, ott_apps: (f.ott || "").split(",").map(s => s.trim()).filter(Boolean), tv_channels: Number(f.tv_channels) || 0,
        install_charge: Number(f.install_charge) || 0, source_url: (f.source_url || "").trim(), notes: f.notes || "",
        verified_at: f.verified ? (p.verified_at || nowISO()) : null });
      return done(true);
    }),
    togglePlan: wrap(id => { need("admin"); const p = byId("plans", id); p.is_active = !p.is_active; return done(true); }),
    adminLocations: wrap(() => { need("admin"); return DB.locations.map(l => Object.assign({}, l, { coverage: DB.coverage.filter(c => c.location_id === l.id).map(c => Object.assign({}, c, { provider: byId("providers", c.provider_id), tip: c.tip_partner_id ? byId("partners", c.tip_partner_id) : null })) })).sort((a, b) => a.pincode.localeCompare(b.pincode)); }),
    saveLocation: wrap(f => {
      need("admin"); if (!isPin(f.pincode)) fail("Enter a valid 6-digit PIN code."); if (!f.area || f.area.trim().length < 2) fail("Enter the area name.");
      if (DB.locations.some(l => l.pincode === f.pincode && l.area.toLowerCase() === f.area.trim().toLowerCase())) fail("This PIN code and area already exist.");
      if (f.zone && !ZONE_NAME[f.zone]) fail("Choose a zone."); const z = ZONES.find(x => x.id === f.zone);
      const ct = f.city_id && f.city_id !== "indore" ? DB.cities.find(c => c.id === f.city_id) : null;
      DB.locations.push({ id: uuid(), pincode: f.pincode, area: f.area.trim(), city: ct ? ct.name : z && z.kind === "rural" ? z.name : "Indore", zone: ct ? null : f.zone || null }); return done(true);
    }),
    saveCoverage: wrap(f => {
      need("admin"); if (!byId("locations", f.location_id) || !byId("providers", f.provider_id)) fail("Choose the area and provider.");
      let c = DB.coverage.find(x => x.location_id === f.location_id && x.provider_id === f.provider_id);
      if (!c) { c = { id: uuid(), location_id: f.location_id, provider_id: f.provider_id, is_active: true }; DB.coverage.push(c); }
      c.tip_partner_id = f.tip_partner_id || null; c.technology = f.technology || "ftth"; c.is_active = true; return done(true);
    }),
    saveLocationZone: wrap((id, zone) => { need("admin"); const l = byId("locations", id); if (!l) fail("Location not found."); if (zone && !ZONE_NAME[zone]) fail("Choose a zone.");
      const z = ZONES.find(x => x.id === zone); l.zone = zone || null; l.city = z && z.kind === "rural" ? z.name : "Indore"; return done(true); }),
    removeCoverage: wrap(id => { need("admin"); DB.coverage = DB.coverage.filter(c => c.id !== id); return done(true); }),
    adminCommissions: wrap(() => { need("admin"); return DB.commissions.map(c => Object.assign({}, c, { partner: byId("partners", c.partner_id), booking: byId("bookings", c.booking_id) })).sort((a, b) => b.created_at.localeCompare(a.created_at)); }),
    setCommission: wrap((id, status) => { need("admin"); const c = byId("commissions", id); if (c.status !== "pending") fail("Only pending commissions can be approved or rejected."); c.status = status; return done(true); }),
    recordPayment: wrap((partnerId, ids, method, reference) => {
      need("admin"); const cs = DB.commissions.filter(c => ids.includes(c.id) && c.partner_id === partnerId && c.status === "approved");
      const total = cs.reduce((s, c) => s + Number(c.amount), 0); if (!(total > 0)) fail("No approved commissions selected.");
      if (!(reference || "").trim()) fail("Enter the payment reference (UTR / cheque no.).");
      const p = { id: uuid(), partner_id: partnerId, amount: total, method, reference: reference.trim(), paid_at: nowISO(), created_by: me.id };
      DB.payments.push(p); cs.forEach(c => { c.status = "paid"; c.payment_id = p.id; }); return done(p);
    }),
    adminPayments: wrap(() => { need("admin"); return DB.payments.map(p => Object.assign({}, p, { partner: byId("partners", p.partner_id) })).sort((a, b) => b.paid_at.localeCompare(a.paid_at)); }),
    adminBookings: wrap(() => { need("admin"); return DB.bookings.map(bookingOut); }),
    adminTickets: wrap(() => { need("admin"); return DB.tickets.slice(); }),
    adminCities: wrap(() => { need("admin"); return DB.cities.map(c => Object.assign({}, c, { waiting: DB.waitlist.filter(w => w.city_id === c.id && w.status === "waiting").length,
      notified: DB.waitlist.filter(w => w.city_id === c.id && w.status === "notified").length, partners: DB.partners.filter(p => p.city_id === c.id && p.status !== "suspended").length,
      pins: [...new Set(DB.locations.filter(l => cityIdOfLoc(l) === c.id).map(l => l.pincode))].length })); }),
    adminWaitlist: wrap(() => { need("admin"); return DB.waitlist.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)); }),
    adminLaunchCity: wrap(id => {
      need("admin"); const c = DB.cities.find(x => x.id === id); if (!c) fail("City not found."); if (c.status === "live") fail(c.name + " is already live.");
      c.status = "live"; c.launched_at = nowISO(); let n = 0;
      DB.waitlist.filter(w => w.city_id === id && w.status === "waiting").forEach(w => { queueWA(w.phone, "cb_city_launched", [w.name, c.name]); w.status = "notified"; w.notified_at = nowISO(); n++; });
      return done(n);
    }),
    adminSetCityStatus: wrap((id, status) => { need("admin"); const c = DB.cities.find(x => x.id === id); if (!c) fail("City not found."); if (!["soon", "hidden"].includes(status)) fail("Use Launch to make a city live.");
      if (c.status === "live" && DB.cities.filter(x => x.status === "live").length <= 1) fail("Keep at least one live city."); c.status = status; return done(true); }),
    adminAddCity: wrap(f => { need("admin"); const name = (f.name || "").trim(), id = citySlug(name); if (name.length < 2 || !id) fail("Enter the city or town name.");
      if (DB.cities.some(c => c.id === id || c.name.toLowerCase() === name.toLowerCase())) fail(name + " is already in the list.");
      DB.cities.push({ id, name, district: (f.district || "").trim() || name, tier: Number(f.tier) || 3, status: "soon", launched_at: null, created_at: nowISO() }); return done(id); })
  };
})();

/* =====================================================================
   LIVE BACK END (Supabase) – same method names / shapes as Demo
   ===================================================================== */
const Live = (() => {
  let sb = null, me = null;
  const one = x => Array.isArray(x) ? (x[0] || null) : x;
  const chk = r => { if (r.error) throw new AppError(r.error.message); return r.data; };
  const LEAD_SEL = "*, plan:plans(*, provider:providers(id,name,kind,is_demo)), dsa:partners!leads_assigned_dsa_id_fkey(id,name,firm,phone,email), tip:partners!leads_assigned_tip_id_fkey(id,name,firm,phone,email), booking:bookings(*)";
  const BOOK_SEL = "*, plan:plans(*, provider:providers(id,name,kind,is_demo)), lead:leads(*), device:device_status(*), tip:partners!bookings_tip_partner_id_fkey(id,name,firm,phone,email), dsa:partners!bookings_dsa_partner_id_fkey(id,name,firm,phone,email)";
  const normLead = l => Object.assign(l, { booking: one(l.booking) });
  const normBook = b => Object.assign(b, { device: one(b.device), lead: one(b.lead) });
  async function loadMe() {
    const u = (await sb.auth.getUser()).data.user; if (!u) { me = null; return null; }
    me = chk(await sb.from("profiles").select("*").eq("id", u.id).single()); return me;
  }
  return {
    mode: "live",
    async init() {
      if (!window.supabase) await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY); return loadMe();
    },
    me: () => me,
    // OTP is generated by Supabase Auth and delivered on WhatsApp by the "whatsapp-otp-hook" Send SMS hook
    async sendOtp(phone) { chk(await sb.auth.signInWithOtp({ phone: "+91" + phone })); return { channel: "whatsapp" }; },
    async verifyOtp(phone, token, name) {
      chk(await sb.auth.verifyOtp({ phone: "+91" + phone, token, type: "sms" }));
      await sb.rpc("link_partner_account"); await loadMe();   // approved DSA/TIP partners are linked by their verified number
      if (me && !me.full_name && name) { chk(await sb.rpc("set_my_name", { p_name: name })); await loadMe(); }
      return me;
    },
    async setMyName(n) { chk(await sb.rpc("set_my_name", { p_name: n })); return loadMe(); },
    async recordSpeedTest(bookingId, r) { chk(await sb.rpc("record_speed_test", { p_booking: bookingId || null, p_down: r.down, p_up: r.up, p_ping: r.ping, p_jitter: r.jit })); return true; },
    async speedTests(bookingId) { return chk(await sb.from("speed_tests").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(6)); },
    async routerTest(bookingId, onQueued) {
      const call = async body => { const r = await sb.functions.invoke("router-speedtest", { body }); if (r.error) { let m = r.error.message; try { m = (await r.error.context.json()).error || m; } catch (e) {} throw new AppError(m); } return r.data; };
      const st = await call({ booking_id: bookingId, action: "start" }); if (onQueued) onQueued(st.queued);
      for (let i = 0; i < 26; i++) { await new Promise(r => setTimeout(r, 15000)); const t = await call({ booking_id: bookingId, action: "result", test_id: st.test_id }); if (t.status !== "requested") return t; }
      throw new AppError("The router did not answer in time. Try again later.");
    },
    async signOut() { await sb.auth.signOut(); me = null; },
    // Password login uses Supabase Auth (phone + password). New logins and resets are made by the "admin-users" edge
    // function (service role); partner logins are issued by the razorpay webhook once the registration fee is paid.
    async signInPassword(phone, password) { chk(await sb.auth.signInWithPassword({ phone: "+91" + phone, password })); await loadMe();
      if (me && me.disabled) { await sb.auth.signOut(); me = null; throw new AppError("This login is disabled. Please contact Connect Bhai admin."); } return me; },
    async changePassword(current, next) {
      if (current) { const r = await sb.auth.signInWithPassword({ phone: "+91" + me.phone, password: current }); if (r.error) throw new AppError("Your current password is not correct."); }
      chk(await sb.auth.updateUser({ password: next })); chk(await sb.rpc("password_changed")); return loadMe(); },
    async adminTeam() { return chk(await sb.from("profiles").select("id,role,full_name,phone,email,has_password,must_change,disabled,pw_set_at,partner:partners(id,name,firm,phone,email,type)").order("role").order("full_name")); },
    async adminCreateUser(f) { return this._users({ action: "create", ...f }); },
    async adminResetPassword(id) { return this._users({ action: "reset", user_id: id }); },
    async adminSetDisabled(id, off) { return this._users({ action: off ? "disable" : "enable", user_id: id }); },
    async _users(body) { const r = await sb.functions.invoke("admin-users", { body }); if (r.error) { let m = r.error.message; try { m = (await r.error.context.json()).error || m; } catch (e) {} throw new AppError(m); } return r.data; },

    async catalog(category) { return chk(await sb.from("plans").select("*, provider:providers(id,name,kind,is_demo,is_active)").eq("category", category).order("price_monthly")).filter(p => p.provider && p.provider.is_active); },
    async searchPlans(pin, category) {
      const locs = chk(await sb.from("locations").select("id,area").eq("pincode", pin));
      if (!locs.length) return { areas: [], plans: [] };
      const cov = chk(await sb.from("coverage").select("provider_id,technology").in("location_id", locs.map(l => l.id)));
      const pids = [...new Set(cov.map(c => c.provider_id))]; if (!pids.length) return { areas: locs.map(l => l.area), plans: [] };
      const plans = chk(await sb.from("plans").select("*, provider:providers(id,name,kind,is_demo,is_active)").in("provider_id", pids).eq("category", category || "fiber"));
      return { areas: locs.map(l => l.area), plans: plans.filter(p => p.provider && p.provider.is_active).map(p => Object.assign(p, { technology: (cov.find(c => c.provider_id === p.provider_id) || {}).technology })) };
    },
    async cities() { return chk(await sb.from("cities").select("*").order("tier").order("name")); },
    async joinWaitlist(f) { return chk(await sb.rpc("join_waitlist", { p_city: f.city_id, p_name: f.name, p_phone: f.phone, p_pincode: f.pincode || null, p_interest: f.interest || null, p_consent: !!f.consent })); },
    async popularPins() { const l = chk(await sb.from("locations").select("pincode,area,city,zone").order("pincode")); const m = {}, cty = {}; l.forEach(x => { m[x.pincode] = m[x.pincode] ? m[x.pincode] + ", " + x.area : x.area; cty[x.pincode] = cty[x.pincode] || cityIdOfLoc(x); }); return Object.keys(m).map(pin => ({ pin, area: m[pin], city_id: cty[pin] })); },
    async requestConnection(f) {
      const r = chk(await sb.rpc("request_connection", { p_name: f.name, p_phone: f.phone, p_pincode: f.pincode, p_area: f.area || null, p_address: f.address || null,
        p_plan_id: f.plan_id || null, p_preferred_date: f.preferred_date || null, p_consent: !!f.consent, p_lat: f.lat || null, p_lng: f.lng || null, p_product: f.product || "broadband", p_sim: f.sim || null })); return one(r);
    },
    // apply_partner now inserts the partner AND its registration-fee charge, and returns { partner_id, charge }
    async applyPartner(f) { const r = one(chk(await sb.rpc("apply_partner", { p_type: f.type, p_name: f.name, p_firm: f.firm || null, p_phone: f.phone, p_email: f.email || null, p_pincodes: f.pincodes || null })));
      if (r && r.partner_id && f.city_id) await sb.rpc("set_partner_city", { p_partner: r.partner_id, p_phone: f.phone, p_city: f.city_id }); return r; },
    async payPublicCharge(id) { return this.payCharge(id, true); },
    async customerPay(f) { return one(chk(await sb.rpc("customer_create_payment", { p_lead: f.lead_id || null, p_desc: f.description, p_amount: Number(f.amount) }))); },
    async setMyProfile(f) { chk(await sb.rpc("set_my_profile", { p_name: f.name, p_email: f.email || null })); return loadMe(); },
    async myThreads() { return chk(await sb.rpc("my_chat_threads")); },
    async threadMessages(id) { return chk(await sb.rpc("chat_messages", { p_thread: id })); },
    async sendMessage(id, body) { return chk(await sb.rpc("send_chat_message", { p_thread: id, p_body: body })); },

    async myLeads() { return chk(await sb.from("leads").select(LEAD_SEL).eq("customer_id", me.id).order("created_at", { ascending: false })).map(normLead); },
    async myBookings() { return chk(await sb.from("bookings").select(BOOK_SEL).eq("customer_id", me.id)).map(normBook); },
    async myTickets() { return chk(await sb.from("tickets").select("*").eq("customer_id", me.id).order("created_at", { ascending: false })); },
    async raiseTicket(f) { return chk(await sb.rpc("raise_ticket", { p_booking: f.booking_id || null, p_type: f.type, p_category: f.category, p_description: f.description })); },
    // Modem control goes through the "genieacs" edge function. It holds each ACS address and API key (never sent to the browser),
    // checks the caller may act on this booking, finds the modem by ONT serial and posts the GenieACS task.
    async refreshDevice(id) { await this._acs({ action: "refresh", booking_id: id }); return chk(await sb.from("device_status").select("*").eq("booking_id", id).single()); },
    async deviceAction(id, action, p) { await this._acs(Object.assign({ action, booking_id: id }, p || {})); return chk(await sb.from("device_status").select("*").eq("booking_id", id).single()); },
    async deviceLog(id) { return chk(await sb.from("device_actions").select("*").eq("booking_id", id).order("created_at", { ascending: false }).limit(6)); },
    async adminAcs() { return chk(await sb.from("partners").select("id,name,firm,phone,type,acs_mode,acs_url,acs_key_set,acs_agreement,acs_updated_at").eq("type", "tip").order("name")); },
    async saveAcs(id, f) { return this._acs({ action: "save_acs", partner_id: id, mode: f.mode || null, url: f.url || null, key: f.key || null, agreement: !!f.agreement }); },
    async _acs(body) { const r = await sb.functions.invoke("genieacs", { body }); if (r.error) { let m = r.error.message; try { m = (await r.error.context.json()).error || m; } catch (e) {} throw new AppError(m); } return r.data; },

    async partnerLeads() { return chk(await sb.from("leads").select(LEAD_SEL).order("updated_at", { ascending: false })).map(normLead); },
    async leadDetail(id) { const l = normLead(chk(await sb.from("leads").select(LEAD_SEL).eq("id", id).single())); l.events = chk(await sb.from("lead_events").select("*").eq("lead_id", id).order("created_at")); return l; },
    async updateLeadStatus(id, s, note, next) { chk(await sb.rpc("update_lead_status", { p_lead: id, p_status: s, p_note: note || null, p_next_follow_up: next || null })); return true; },
    async partnerBookings() { return chk(await sb.from("bookings").select(BOOK_SEL).order("scheduled_date")).map(normBook); },
    async createBooking(id, date) { return chk(await sb.rpc("create_booking", { p_lead: id, p_date: date })); },
    async updateBookingStatus(id, s, ref, ont) { chk(await sb.rpc("update_booking_status", { p_booking: id, p_status: s, p_connection_ref: ref || null, p_ont_serial: ont || null })); return true; },
    async partnerTickets() { return chk(await sb.from("tickets").select("*, booking:bookings(" + BOOK_SEL + ")").order("created_at", { ascending: false })).map(t => Object.assign(t, { booking: normBook(one(t.booking) || {}) })); },
    async updateTicket(id, s, note) { chk(await sb.rpc("update_ticket_status", { p_ticket: id, p_status: s, p_note: note || null })); return true; },
    async myCommissions() { return chk(await sb.from("commissions").select("*, booking:bookings(" + BOOK_SEL + ")").order("created_at", { ascending: false })).map(c => Object.assign(c, { booking: normBook(one(c.booking) || {}) })); },
    async myPartner() { return chk(await sb.from("partners").select("*").eq("id", me.partner_id).single()); },

    async adminLeads() { return chk(await sb.from("leads").select(LEAD_SEL).order("created_at", { ascending: false })).map(normLead); },
    async assignLead(id, d, t) { chk(await sb.rpc("assign_lead", { p_lead: id, p_dsa: d || null, p_tip: t || null })); return true; },
    async adminPartners() { return chk(await sb.from("partners").select("*").order("type").order("name")); },
    async savePartner(f) {
      const row = { type: f.type, name: f.name, firm: f.firm || null, phone: f.phone, email: f.email || null, service_pincodes: f.service_pincodes || null, commission_per_install: Number(f.commission_per_install) || 0, kyc_verified: !!f.kyc_verified, lead_target: Number(f.lead_target) || null };
      chk(f.id ? await sb.from("partners").update(row).eq("id", f.id) : await sb.from("partners").insert(Object.assign(row, { status: "active" }))); return true;
    },
    async setPartnerStatus(id, s) { chk(await sb.from("partners").update({ status: s }).eq("id", id)); return true; },
    async approvePartner(id) { chk(await sb.rpc("admin_approve_partner", { p_partner: id })); return true; },
    async setAutoAssign(on) { chk(await sb.from("app_settings").update({ value: on ? 1 : 0 }).eq("key", "auto_assign")); return true; },
    async dsaAddLead(f) { const r = one(chk(await sb.rpc("dsa_add_lead", { p_name: f.name, p_phone: f.phone, p_pincode: f.pincode, p_area: f.area || null, p_address: f.address || null, p_plan_id: f.plan_id || null, p_consent: !!f.consent }))); return { ref_code: r.ref_code, tip: null }; },
    async getSettings() { const o = {}; chk(await sb.from("app_settings").select("key,value")).forEach(r => (o[r.key] = Number(r.value))); return o; },
    async saveSettings(o) { for (const k of ["registration_fee_tip", "registration_fee_dsa", "gst_percent", "lead_target_default", "tip_share_percent"]) chk(await sb.from("app_settings").update({ value: Number(o[k]) }).eq("key", k)); return true; },
    async myCharges() { return chk(await sb.from("charges").select("*").order("created_at", { ascending: false })); },
    async payCharge(id, isPublic) {   // Razorpay Checkout; the webhook confirms the payment, we then poll until the charge shows paid
      if (!window.Razorpay) await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = ok; s.onerror = () => no(new AppError("Could not load the payment page.")); document.head.appendChild(s); });
      const r = await sb.functions.invoke("razorpay-order", { body: { charge_id: id } });
      if (r.error) { let m = r.error.message; try { m = (await r.error.context.json()).error || m; } catch (e) {} throw new AppError(m); }
      const o = r.data;
      await new Promise((ok, no) => {
        const rz = new window.Razorpay({ key: o.key_id, order_id: o.order_id, amount: o.amount, currency: o.currency, name: o.name, description: o.description, prefill: o.prefill, theme: { color: "#1450E6" },
          handler: () => ok(), modal: { ondismiss: () => no(new AppError("Payment was cancelled.")) } });
        rz.on("payment.failed", resp => no(new AppError((resp.error && resp.error.description) || "Payment failed.")));
        rz.open();
      });
      for (let i = 0; i < 20; i++) { const c = isPublic ? one(chk(await sb.rpc("public_charge_status", { p_id: id }))) : chk(await sb.from("charges").select("*").eq("id", id).single()); if (c && c.status === "paid") return c; await new Promise(x => setTimeout(x, 2000)); }
      throw new AppError("Payment received by the bank. Confirmation is taking longer than usual; it will show here shortly.");
    },
    async adminCharges() { return chk(await sb.from("charges").select("*, partner:partners(id,name,type,phone), customer:profiles(id,full_name,phone)").order("created_at", { ascending: false })); },
    async adminCustomers() { return chk(await sb.from("profiles").select("id,full_name,phone").eq("role", "customer").order("full_name")); },
    async adminCreateCharge(f) { return chk(await sb.rpc("admin_create_charge", { p_partner: f.payer_type === "partner" ? f.partner_id : null, p_customer: f.payer_type === "customer" ? f.customer_id : null, p_kind: f.kind, p_desc: f.description, p_base: Number(f.base) })); },
    async adminSetCharge(id, action, ref) { chk(await sb.rpc("admin_set_charge", { p_id: id, p_action: action, p_reference: ref || null })); return true; },
    async adminNotifications() { return chk(await sb.from("notifications").select("*").order("id", { ascending: false }).limit(200)); },
    async geoReverse(lat, lng) { const r = await sb.functions.invoke("geo", { body: { action: "reverse", lat, lng } }); if (r.error) { let m = "Could not find your PIN code."; try { m = (await r.error.context.json()).error || m; } catch (e) {} throw new AppError(m); } return r.data; },
    async geoAreas(pin) { const r = await sb.functions.invoke("geo", { body: { action: "areas", pincode: pin } }); if (r.error) throw new AppError("Could not fetch areas."); return r.data; },
    async adminProviders() { return chk(await sb.from("providers").select("*").order("name")); },
    async saveProvider(f) { const row = { name: f.name, kind: f.kind, website: f.website || null }; chk(f.id ? await sb.from("providers").update(row).eq("id", f.id) : await sb.from("providers").insert(row)); return true; },
    async toggleProvider(id) { const p = chk(await sb.from("providers").select("is_active").eq("id", id).single()); chk(await sb.from("providers").update({ is_active: !p.is_active }).eq("id", id)); return true; },
    async adminPlans() { return chk(await sb.from("plans").select("*, provider:providers(id,name,kind,is_demo), submitter:partners!plans_submitted_partner_fkey(name)").order("price_monthly")); },
    async adminImportPlans(rows) { return chk(await sb.rpc("admin_import_plans", { p_rows: rows })); },
    async tipProviders() { const c = chk(await sb.from("coverage").select("provider:providers(id,name,kind)").eq("tip_partner_id", me.partner_id)); const m = {}; c.forEach(x => x.provider && (m[x.provider.id] = x.provider)); return Object.values(m); },
    async tipPlans() { const pv = (await this.tipProviders()).map(p => p.id); const all = chk(await sb.from("plans").select("*, provider:providers(id,name,kind,is_demo)").or(`provider_id.in.(${pv.join(",") || "00000000-0000-0000-0000-000000000000"}),submitted_partner.eq.${me.partner_id}`));
      return { live: all.filter(p => p.status === "live" && p.is_active), mine: all.filter(p => p.submitted_partner === me.partner_id) }; },
    async tipSubmitPlans(rows) { return chk(await sb.rpc("tip_submit_plans", { p_rows: rows })); },
    async adminReviewPlan(id, approve, note) { chk(await sb.rpc("admin_review_plan", { p_id: id, p_approve: approve, p_note: note || null })); return true; },
    async dsaActivateSim(id, ref) { chk(await sb.rpc("dsa_activate_sim", { p_lead: id, p_reference: ref })); return true; },
    async savePlan(f) {
      const row = { provider_id: f.provider_id, category: f.category || "fiber", plan_code: (f.plan_code || "").trim().toUpperCase() || null, data_per_day_gb: f.data_per_day_gb ? Number(f.data_per_day_gb) : null,
        voice: f.voice || null, sms_per_day: f.sms_per_day ? Number(f.sms_per_day) : null, status: "live", name: f.name, speed_mbps: Number(f.speed_mbps) > 0 ? Number(f.speed_mbps) : null, price_monthly: Number(f.price_monthly), data_limit_gb: f.data_limit_gb ? Number(f.data_limit_gb) : null,
        validity_days: Number(f.validity_days) || 30, ott_apps: (f.ott || "").split(",").map(s => s.trim()).filter(Boolean), tv_channels: Number(f.tv_channels) || 0, install_charge: Number(f.install_charge) || 0,
        source_url: f.source_url || null, notes: f.notes || null, verified_at: f.verified ? new Date().toISOString() : null, verified_by: f.verified ? me.id : null, updated_at: new Date().toISOString() };
      if (f.verified && !row.source_url) throw new AppError("Add the source link you verified the tariff from.");
      chk(f.id ? await sb.from("plans").update(row).eq("id", f.id) : await sb.from("plans").insert(row)); return true;
    },
    async togglePlan(id) { const p = chk(await sb.from("plans").select("is_active").eq("id", id).single()); chk(await sb.from("plans").update({ is_active: !p.is_active }).eq("id", id)); return true; },
    async adminLocations() { return chk(await sb.from("locations").select("*, coverage(*, provider:providers(id,name), tip:partners(id,name))").order("pincode")); },
    async saveLocation(f) { const other = f.city_id && f.city_id !== "indore", ct = other ? chk(await sb.from("cities").select("name").eq("id", f.city_id).single()) : null;
      chk(await sb.from("locations").insert({ pincode: f.pincode, area: f.area, zone: other ? null : f.zone || null, ...(ct ? { city: ct.name } : {}) })); return true; },
    async saveLocationZone(id, zone) { chk(await sb.from("locations").update({ zone: zone || null }).eq("id", id)); return true; },
    async saveCoverage(f) { chk(await sb.from("coverage").upsert({ location_id: f.location_id, provider_id: f.provider_id, tip_partner_id: f.tip_partner_id || null, technology: f.technology, is_active: true }, { onConflict: "location_id,provider_id" })); return true; },
    async removeCoverage(id) { chk(await sb.from("coverage").delete().eq("id", id)); return true; },
    async adminCommissions() { return chk(await sb.from("commissions").select("*, partner:partners(*), booking:bookings(*)").order("created_at", { ascending: false })).map(c => Object.assign(c, { booking: one(c.booking) })); },
    async setCommission(id, s) { chk(await sb.rpc("set_commission_status", { p_id: id, p_status: s })); return true; },
    async recordPayment(pid, ids, method, ref) { chk(await sb.rpc("record_payment", { p_partner: pid, p_commission_ids: ids, p_method: method, p_reference: ref })); return true; },
    async adminPayments() { return chk(await sb.from("payments").select("*, partner:partners(*)").order("paid_at", { ascending: false })); },
    async adminBookings() { return chk(await sb.from("bookings").select(BOOK_SEL)).map(normBook); },
    async adminTickets() { return chk(await sb.from("tickets").select("*")); },
    async adminCities() { const [cs, wl, pt, lc] = await Promise.all([this.cities(), this.adminWaitlist(), sb.from("partners").select("city_id,status"), sb.from("locations").select("pincode,city,zone")]);
      const P = chk(pt), L = chk(lc);
      return cs.map(c => Object.assign({}, c, { waiting: wl.filter(w => w.city_id === c.id && w.status === "waiting").length, notified: wl.filter(w => w.city_id === c.id && w.status === "notified").length,
        partners: P.filter(p => p.city_id === c.id && p.status !== "suspended").length, pins: [...new Set(L.filter(l => cityIdOfLoc(l) === c.id).map(l => l.pincode))].length })); },
    async adminWaitlist() { return chk(await sb.from("waitlist").select("*").order("created_at", { ascending: false })); },
    async adminLaunchCity(id) { return chk(await sb.rpc("admin_launch_city", { p_city: id })); },
    async adminSetCityStatus(id, status) { if (!["soon", "hidden"].includes(status)) throw new AppError("Use Launch to make a city live."); chk(await sb.from("cities").update({ status }).eq("id", id)); return true; },
    async adminAddCity(f) { const name = (f.name || "").trim(), id = citySlug(name); if (name.length < 2 || !id) throw new AppError("Enter the city or town name.");
      chk(await sb.from("cities").insert({ id, name, district: (f.district || "").trim() || name, tier: Number(f.tier) || 3, status: "soon" })); return id; }
  };
})();

const API = LIVE ? Live : Demo;


export { API, AppError, BOOK, BOOK_NEXT, BOOK_TONE, CATS, COMM, COMM_TONE, DB, DEMO_KEY, Demo, KIND, LEAD, LEAD_NEXT, LEAD_TONE, Live, MP_CITIES, PRODUCT_NAME, PW_RULE, SHEET_COLS, TICKET, TICKET_TONE, ZONES, ZONE_BY_PIN, ZONE_NAME, addDays, cityIdOfLoc, citySlug, demoHash, esc, fail, fdate, fdt, genTempPw, inr, isPhone, isPin, loadDemo, migrateCities, nowISO, planFromRow, productOf, pwOk, resetDemoData, saveDemo, seedDemo, todayISO, uuid };
