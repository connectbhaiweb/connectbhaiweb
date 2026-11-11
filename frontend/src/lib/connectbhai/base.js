/* Connect Bhai · shared helpers, labels and constants. Used by every back end and by the screens (re-exported from ./api).
   Split out of api.js so the in-browser demo can be left out of a build that talks to the real API. */
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


const PW_RULE = "At least 8 characters, with a letter and a number.";
const pwOk = p => typeof p === "string" && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
export { esc, inr, fdate, fdt, uuid, todayISO, addDays, isPhone, isPin, nowISO, AppError, fail, LEAD, LEAD_TONE, LEAD_NEXT, BOOK, BOOK_TONE, BOOK_NEXT, TICKET, TICKET_TONE, COMM, COMM_TONE, ZONES, ZONE_NAME, ZONE_BY_PIN, KIND, MP_CITIES, citySlug, cityIdOfLoc, CATS, productOf, PRODUCT_NAME, SHEET_COLS, planFromRow, PW_RULE, pwOk };
