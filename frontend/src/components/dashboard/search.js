/* Top-bar search. Pages of the role always match by name; roles with a React page also search their own records
   through the existing API (customer: bookings, complaints, payments; DSA: leads and customers; TIP: leads, installs, tickets; admin: leads, DSAs, TIPs, plans, locations). Returns [{ kind, title, sub, href }]. */
import { ROLES, hrefOf } from "./nav";

const has = (q, ...xs) => xs.some(x => x != null && String(x).toLowerCase().includes(q));

async function customer(API, q) {
  const [leads, tickets, charges] = await Promise.all([API.myLeads(), API.myTickets(), API.myCharges()]);
  const plan = p => (p ? [p.provider && p.provider.name, p.name, p.speed_mbps ? p.speed_mbps + " Mbps" : ""].filter(Boolean).join(" ") : "No plan chosen");
  return [
    ...leads.filter(l => has(q, l.ref_code, l.pincode, l.area, l.status, l.plan && l.plan.name, l.plan && l.plan.provider && l.plan.provider.name, l.booking && l.booking.ref_code))
      .map(l => ({ kind: "Booking", title: l.ref_code, sub: `${plan(l.plan)} · ${l.pincode}${l.area ? ", " + l.area : ""}`, href: `/my/bookings?ref=${encodeURIComponent(l.ref_code)}` })),
    ...tickets.filter(t => has(q, t.ref_code, t.category, t.description))
      .map(t => ({ kind: "Complaint", title: t.ref_code, sub: t.category, href: "/my/support" })),
    ...charges.filter(c => has(q, c.ref_code, c.description))
      .map(c => ({ kind: "Payment", title: c.ref_code, sub: c.description, href: "/my/payments" })),
  ];
}
const leadHit = (q, l) => has(q, l.ref_code, l.name, l.phone, l.pincode, l.area, l.booking && l.booking.ref_code, l.plan && l.plan.name);
const leadSub = l => [l.status.replace("_", "-"), l.pincode, l.area].filter(Boolean).join(" · ");
async function dsa(API, q) {
  const leads = await API.partnerLeads();
  return leads.filter(l => leadHit(q, l)).map(l => ({ kind: l.status === "installed" ? "Customer" : "Lead", title: `${l.name} · ${l.ref_code}`, sub: leadSub(l), href: l.status === "installed" ? "/dsa/customers" : "/dsa/leads" }));
}
async function tip(API, q) {
  const [leads, bookings, tickets] = await Promise.all([API.partnerLeads(), API.partnerBookings(), API.partnerTickets()]);
  return [
    ...leads.filter(l => !l.booking && leadHit(q, l)).map(l => ({ kind: "Lead", title: `${l.name} · ${l.ref_code}`, sub: leadSub(l), href: "/tip/leads" })),
    ...bookings.filter(b => has(q, b.ref_code, b.connection_ref, b.lead && b.lead.name, b.lead && b.lead.phone, b.lead && b.lead.pincode)).map(b => ({ kind: b.status === "installed" ? "Customer" : "Install", title: `${b.lead ? b.lead.name : ""} · ${b.ref_code}`, sub: `${b.status.replace("_", " ")} · ${b.lead ? b.lead.pincode : ""}`, href: b.status === "installed" ? "/tip/customers" : "/tip/bookings" })),
    ...tickets.filter(t => has(q, t.ref_code, t.category, t.description)).map(t => ({ kind: "Ticket", title: t.ref_code, sub: t.category, href: "/tip/tickets" })),
  ];
}
async function admin(API, q) {
  const [leads, DSAs, TIPs, plans, locs] = await Promise.all([API.adminLeads(), API.adminPartners(), API.adminPlans().catch(() => []), API.adminLocations().catch(() => [])]);
  return [
    ...leads.filter(l => leadHit(q, l)).map(l => ({ kind: "Lead", title: `${l.name} · ${l.ref_code}`, sub: leadSub(l), href: "/admin/leads" })),
    ...partners.filter(p => has(q, p.name, p.firm, p.phone, p.service_pincodes)).map(p => ({ kind: p.type.toUpperCase(), title: p.name, sub: `${p.firm || ""} · ${p.status}`, href: "/admin/partners" })),
    ...plans.filter(p => has(q, p.name, p.plan_code, p.provider && p.provider.name)).map(p => ({ kind: "Plan", title: p.name, sub: `${(p.provider && p.provider.name) || ""} · ₹${p.price_monthly}`, href: "/admin/plans" })),
    ...locs.filter(l => has(q, l.pincode, l.area, l.city)).map(l => ({ kind: "Location", title: `${l.pincode} · ${l.area}`, sub: l.city, href: "/admin/locations" })),
  ];
}
const BY_ROLE = { customer, dsa, tip, admin };

export async function search(role, raw) {
  const q = String(raw || "").trim().toLowerCase();
  if (!q) return [];
  const pages = ROLES[role].items.filter(i => has(q, i.label, i.short, i.tab)).map(i => ({ kind: "Page", title: i.label, sub: "Open page", href: hrefOf(role, i.tab) }));
  let found = [];
  if (BY_ROLE[role]) { try { const { API } = await import("@/lib/connectbhai/api"); found = await BY_ROLE[role](API, q); } catch (e) { found = []; } }
  return [...found, ...pages].slice(0, 8);
}
