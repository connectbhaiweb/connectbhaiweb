"use client";
import { useDashData } from "./useDashData";
import { dashboard, fetchPage } from "@/lib/connectbhai/paging";

/* QA: the sidebar / bottom-nav badges used to be read only from the page on screen, so they vanished on every tab that does
   not print them. These loaders fetch the same numbers the role's home page shows (same formulas), on their own, and reload
   after every action (cb:render) like the pages do. A page that shows its own counts still wins (DashboardShell). */
const unread = ts => (ts || []).reduce((n, t) => n + (Number(t.unread) || 0), 0);
const threads = API => (API.myThreads ? API.myThreads().catch(() => []) : Promise.resolve([]));

async function customer(API) {
  const [leads, tickets, charges, th] = await Promise.all([API.myLeads(), API.myTickets(), API.myCharges(), threads(API)]);
  return { bookings: leads.length, support: tickets.filter(t => ["open", "in_progress"].includes(t.status)).length,
    payments: charges.filter(c => ["due", "failed"].includes(c.status)).length, chat: unread(th) };
}
async function dsa(API) {
  const [stats, th] = await Promise.all([dashboard(API, "dsa", { months: 1, pins: 1 }), threads(API)]);
  const L = stats.leads;
  return { leads: L.new + (L.assigned || 0), chat: unread(th), commission: stats.commission_count, payments: 0 };
}
async function tip(API) {
  const [stats, th] = await Promise.all([dashboard(API, "tip", { months: 1, pins: 1 }), threads(API)]);
  const L = stats.leads, cc = stats.charges_count || {};
  return { leads: L.contacted + L.follow_up + (L.assigned || 0), tickets: stats.open_tickets, chat: unread(th), bookings: stats.installs_pending,
    payments: (cc.pending || 0) + (cc.due || 0) + (cc.failed || 0) };
}
async function admin(API) {
  const [stats, dsaApps, tipApps, cities, th] = await Promise.all([dashboard(API, "admin", { months: 1, pins: 1 }),
    fetchPage(API, "admin", "partners", { type: "dsa", status: "pending", limit: 1 }), fetchPage(API, "admin", "partners", { type: "tip", status: "pending", limit: 1 }),
    API.adminCities ? API.adminCities().catch(() => []) : [], threads(API)]);
  return { leads: stats.leads.new, partners: dsaApps.total + tipApps.total, plans: 0, cities: (cities || []).reduce((n, c) => n + (Number(c.waiting) || 0), 0), chat: unread(th) };
}
const LOAD = { customer, dsa, tip, admin };
const none = async () => ({});

/** Live badge counts for the signed-in role; {} until loaded or when signed out. */
export function useRoleCounts(role) {
  const { data } = useDashData(role || "none", LOAD[role] || none, !!LOAD[role]);
  return data || {};
}
