/* Server-driven data for the dashboards.
   - dashboard(API, role, opt): the KPI / chart numbers. With the REST API they are computed by the server (GET /reports/dashboard);
     the in-browser demo and Supabase layers hold everything in memory anyway, so there the same shape is built from their lists.
   - fetchPage(API, role, kind, f): ONE page of leads / bookings / tickets / charges / commissions / customers / partners, filtered by
     status and search text. REST: the API does it. Demo / Supabase: filtered in memory (same result, nothing to download). */

const mKey = iso => String(iso || "").slice(0, 7);
function monthKeys(n) {
  const d = new Date(), a = [];
  for (let i = n - 1; i >= 0; i--) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)); a.push(x.getUTCFullYear() + "-" + String(x.getUTCMonth() + 1).padStart(2, "0")); }
  return a;
}
const count = (a, f) => a.reduce((n, x) => n + (f(x) ? 1 : 0), 0);
const total = (a, f) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);

async function lists(API, role) {
  const safe = p => Promise.resolve(p).catch(() => []);
  if (role === "admin") return Promise.all([API.adminLeads(), API.adminBookings(), API.adminTickets(), API.adminCommissions(), API.adminCharges(), API.adminPartners()]);
  if (role === "customer") return Promise.all([API.myLeads(), API.myBookings(), API.myTickets(), [], API.myCharges(), []]);
  return Promise.all([API.partnerLeads(), API.partnerBookings(), role === "tip" ? API.partnerTickets() : [], safe(API.myCommissions()), safe(API.myCharges()), []]);
}

async function statsFromLists(API, role, opt) {
  const months = (opt && opt.months) || 6, pins = (opt && opt.pins) || 4;
  const [leads, bookings, tickets, comms, charges, partners] = await lists(API, role);
  const inst = bookings.filter(b => b.status === "installed"), keys = monthKeys(months), cur = keys[keys.length - 1];
  const st = k => count(leads, l => l.status === k);
  const ps = [...new Set(leads.map(l => l.pincode).filter(Boolean))].map(pin => ({ pincode: pin, leads: count(leads, l => l.pincode === pin), installs: count(inst, b => b.lead && b.lead.pincode === pin), areas: [] })).sort((a, b) => b.leads - a.leads).slice(0, pins);
  const cm = comms.filter(c => c.status !== "rejected"), by = (arr, k, v) => arr.filter(x => x.status === k);
  const given = role === "dsa" ? leads.filter(l => l.source !== "dsa") : leads;
  const paid = charges.filter(c => c.status === "paid");
  const sums = (arr, f) => arr.reduce((o, x) => { o[x.status] = (o[x.status] || 0) + (Number(f(x)) || 0); return o; }, {});
  return {
    leads: { new: st("new"), contacted: st("contacted"), follow_up: st("follow_up"), booked: st("booked"), installed: st("installed"), lost: st("lost"), assigned: st("assigned") }, leads_total: leads.length,
    followups_due: count(leads, l => l.status === "follow_up" && l.next_follow_up && l.next_follow_up <= new Date().toISOString().slice(0, 10)),
    leads_month: count(leads, l => mKey(l.created_at) === cur), leads_given: given.length, leads_given_month: count(given, l => mKey(l.created_at) === cur),
    installs_billing: total(inst, b => (b.plan ? b.plan.price_monthly : 0)),
    unassigned: count(leads, l => l.status === "new" && !l.assigned_dsa_id && !l.assigned_tip_id),
    bookings: { scheduled: count(bookings, b => ["scheduled", "in_progress"].includes(b.status)), installed: inst.length, cancelled: count(bookings, b => b.status === "cancelled") },
    installs_total: inst.length, installs_month: count(inst, b => mKey(b.installed_at) === cur), installs_pending: count(bookings, b => ["scheduled", "in_progress"].includes(b.status)),
    tickets: { open: count(tickets, t => t.status === "open"), in_progress: count(tickets, t => t.status === "in_progress") }, open_tickets: count(tickets, t => ["open", "in_progress"].includes(t.status)),
    by_month: keys.map(k => ({ month: k, leads: count(leads, l => mKey(l.created_at) === k), installs: count(inst, b => mKey(b.installed_at) === k) })),
    top_pins: ps,
    partners: partners.map(p => ({ role: p.type, partner_status: p.status === "active" ? "approved" : p.status, count: 1 })),
    commission: { pending: total(by(cm, "pending"), c => c.amount), approved: total(by(cm, "approved"), c => c.amount), paid: total(by(cm, "paid"), c => c.amount), rejected: 0 }, commission_count: comms.length,
    tip_fee_base: total(charges.filter(c => c.partner_id && !["waived", "cancelled"].includes(c.status)), c => c.base_amount),
    charges: sums(charges, c => c.amount), charges_count: Object.fromEntries(["due", "paid", "failed"].map(k => [k, count(charges, c => c.status === k)])), last_paid_at: paid[0] ? paid[0].paid_at || paid[0].created_at : null,
  };
}
export async function dashboard(API, role, opt) { return API.dashboard ? API.dashboard(opt) : statsFromLists(API, role, opt); }

const norm = s => String(s == null ? "" : s).toLowerCase();
const blob = o => norm(Object.values(o).filter(v => v != null && typeof v !== "object").join(" ")) + " " + norm(o.lead ? Object.values(o.lead).join(" ") : "") + " " + norm(o.partner ? Object.values(o.partner).join(" ") : "") + " " + norm(o.customer ? Object.values(o.customer).join(" ") : "");
const compact = s => s.replace(/[\s,+\-().]/g, "");

async function listFor(API, role, kind, f) {
  switch (kind) {
    case "leads": return role === "admin" ? API.adminLeads() : role === "customer" ? API.myLeads() : API.partnerLeads();
    case "bookings": return role === "admin" ? API.adminBookings() : role === "customer" ? API.myBookings() : API.partnerBookings();
    case "tickets": return role === "admin" ? API.adminTickets() : role === "customer" ? API.myTickets() : role === "tip" ? API.partnerTickets() : [];
    case "charges": return role === "admin" ? API.adminCharges() : API.myCharges();
    case "commissions": return role === "admin" ? API.adminCommissions() : API.myCommissions();
    case "customers": return API.adminCustomers();
    case "team": return f.role === "customer" ? API.adminCustomers() : (await API.adminTeam()).filter(u => !f.role || u.role === f.role);
    case "messages": return API.adminNotifications();
    case "partners": return (await API.adminPartners()).filter(p => !f.type || p.type === f.type);
    default: return [];
  }
}
const OPEN_L = ["new", "assigned", "contacted", "follow_up", "booked"];
export async function fetchPage(API, role, kind, f) {
  f = f || {};
  const method = "page" + kind[0].toUpperCase() + kind.slice(1);
  if (API[method]) return API[method](f);
  let rows = await listFor(API, role, kind, f);
  if (f.unassigned) rows = rows.filter(l => l.status === "new" && !l.assigned_dsa_id && !l.assigned_tip_id);
  if (f.pincode) rows = rows.filter(r => r.pincode === f.pincode);
  if (f.device) { const lk = b => !!(b.ont_serial && b.device && b.device.acs); rows = rows.filter(b => f.device === "offline" ? b.device && b.device.state === "offline" : f.device === "weak" ? lk(b) && b.device.rx_dbm != null && b.device.rx_dbm < -25 : f.device === "reboots" ? lk(b) && (b.device.reboots_7d || 0) >= 3 : !lk(b)); }
  if (f.status && f.status !== "all") {
    if (f.status === "tobook") rows = rows.filter(l => ["assigned", "contacted", "follow_up"].includes(l.status));
    else if (f.status === "due") rows = rows.filter(l => l.status === "follow_up" && l.next_follow_up && l.next_follow_up <= new Date().toISOString().slice(0, 10));
    else if (f.status === "open" && kind === "leads") rows = rows.filter(l => OPEN_L.includes(l.status));
    else if (f.status === "open_all") rows = rows.filter(t => ["open", "in_progress"].includes(t.status));
    else rows = rows.filter(r => r.status === f.status);
  }
  if (f.from || f.to) rows = rows.filter(b => b.scheduled_date && (!f.from || b.scheduled_date >= f.from.slice(0, 10)) && (!f.to || b.scheduled_date < f.to.slice(0, 10)));
  const words = norm(f.q).split(/\s+/).filter(Boolean);
  if (words.length) rows = rows.filter(r => { const h = blob(r), hc = compact(h); return words.every(w => h.includes(w) || hc.includes(compact(w))); });
  if (f.sort === "followup") rows = [...rows].sort((a, b) => (a.next_follow_up || "9").localeCompare(b.next_follow_up || "9") || String(b.updated_at).localeCompare(String(a.updated_at)));
  const limit = f.limit || 10, page = f.page || 1;
  return { items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
}

/* Per-partner numbers for the admin lists: { tip: {id: {leads, installs, paid_amount, paid_count}}, dsa: {id: {leads, installs, comm_paid, comm_count}} } */
export async function partnerTotals(API) {
  if (API.partnerTotals) return API.partnerTotals();
  const [partners, leads, bookings, charges, comms] = await Promise.all([API.adminPartners(), API.adminLeads(), API.adminBookings(), API.adminCharges(), API.adminCommissions()]);
  const out = { tip: {}, dsa: {} };
  partners.forEach(p => {
    const isT = p.type === "tip", inst = bookings.filter(b => b.status === "installed" && (isT ? b.tip_partner_id : b.dsa_partner_id) === p.id).length;
    const paid = charges.filter(c => c.partner_id === p.id && c.status === "paid"), cm = comms.filter(c => c.partner_id === p.id && c.status !== "rejected");
    out[p.type][p.id] = { leads_month: leads.filter(l => (isT ? l.assigned_tip_id : l.assigned_dsa_id) === p.id && mKey(l.created_at) === monthKeys(1)[0]).length, leads: leads.filter(l => (isT ? l.assigned_tip_id : l.assigned_dsa_id) === p.id).length, installs: inst, paid_amount: total(paid, c => c.amount), paid_count: paid.length, comm_paid: total(cm.filter(c => c.status === "paid"), c => c.amount), comm_count: cm.length };
  });
  return out;
}
/* { [customerId]: { requests, latest } } for the customers on the current page */
export async function customerSummaries(API, ids) {
  if (API.customerSummaries) return API.customerSummaries(ids);
  const leads = await API.adminLeads(), out = {};
  ids.forEach(id => { const ls = leads.filter(l => l.customer_id === id); out[id] = { requests: ls.length, latest: ls[0] || null }; });
  return out;
}

/* Admin money numbers: { collected:{YYYY-MM:n}, paid_out:{…}, by_kind:{kind:n}, delivered:{…}, due } and the DSAs with approved commission to pay. */
export async function money(API, months) {
  if (API.money) return API.money({ months });
  const [charges, comms, leads] = await Promise.all([API.adminCharges(), API.adminCommissions(), API.adminLeads()]), add = (o, k, v) => { if (k) o[k] = (o[k] || 0) + (Number(v) || 0); };
  const out = { collected: {}, paid_out: {}, by_kind: {}, delivered: {}, due: 0 };
  charges.forEach(c => { if (c.status === "paid") { add(out.collected, mKey(c.paid_at), c.amount); add(out.by_kind, c.kind, c.amount); } else if (["due", "failed"].includes(c.status)) out.due += Number(c.amount) || 0; });
  comms.forEach(c => { if (c.status === "paid") add(out.paid_out, mKey(c.paid_at || c.created_at), c.amount); });
  leads.forEach(l => { if (l.assigned_dsa_id || l.assigned_tip_id) add(out.delivered, mKey(l.created_at), 1); });
  return out;
}
export async function payables(API) {
  if (API.payables) return API.payables();
  const by = {}; (await API.adminCommissions()).filter(c => c.status === "approved").forEach(c => { const x = (by[c.partner_id] = by[c.partner_id] || { partner_id: c.partner_id, partner: c.partner, count: 0, total: 0, ids: [] }); x.count++; x.total += Number(c.amount); x.ids.push(c.id); });
  return Object.values(by);
}

/* Care plan page numbers: { installed, linked, online, offline, weak, unlinked, zones:[{pincode,n,on,off,weak}], tips:{id:n} } */
export async function carePlanSummary(API, role) {
  if (API.carePlanSummary) return API.carePlanSummary();
  const list = (await listFor(API, role, "bookings", {})).filter(b => b.status === "installed"), lk = b => !!(b.ont_serial && b.device && b.device.acs), zones = {};
  list.forEach(b => { const z = zones[b.lead && b.lead.pincode] = zones[b.lead && b.lead.pincode] || { pincode: b.lead && b.lead.pincode, n: 0, on: 0, off: 0, weak: 0 }; z.n++; if (b.device) { if (b.device.state === "online") z.on++; if (b.device.state === "offline") z.off++; if (lk(b) && b.device.rx_dbm != null && b.device.rx_dbm < -25) z.weak++; } });
  const linked = list.filter(lk).length;
  return { installed: list.length, linked, online: list.filter(b => b.device && b.device.state === "online").length, offline: list.filter(b => b.device && b.device.state === "offline").length, weak: list.filter(b => lk(b) && b.device.rx_dbm != null && b.device.rx_dbm < -25).length, unlinked: list.length - linked, zones: Object.values(zones).filter(z => z.pincode), tips: {} };
}
