/* Port of frontend/src/lib/connectbhai/paging.js: server-driven data for the dashboards. The web file also rebuilds
   these numbers in memory for its demo and Supabase back ends; the app only talks to the REST API, which computes
   every one of them, so only the calls are ported. */
import type { Api } from './rest';
import type { PageFilter } from './types';

/** The last n calendar months as "YYYY-MM", oldest first. */
export function monthKeys(n: number) {
  const d = new Date();
  const a: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    a.push(x.getUTCFullYear() + '-' + String(x.getUTCMonth() + 1).padStart(2, '0'));
  }
  return a;
}

export const dashboard = (API: Api, opt?: { months?: number; pins?: number }) => API.dashboard(opt);

const PAGES = {
  leads: 'pageLeads', bookings: 'pageBookings', tickets: 'pageTickets', charges: 'pageCharges', commissions: 'pageCommissions',
  customers: 'pageCustomers', team: 'pageTeam', messages: 'pageMessages', partners: 'pagePartners',
} as const;
export type PageKind = keyof typeof PAGES;

/* ONE page of a list, filtered by status and search text on the server. */
export function fetchPage<K extends PageKind>(API: Api, kind: K, f: PageFilter = {}) {
  return API[PAGES[kind]](f) as ReturnType<Api[(typeof PAGES)[K]]>;
}

export const partnerTotals = (API: Api) => API.partnerTotals();
export const customerSummaries = (API: Api, ids: string[]) => API.customerSummaries(ids);
export const money = (API: Api, months?: number) => API.money({ months });
export const payables = (API: Api) => API.payables();
export const carePlanSummary = (API: Api) => API.carePlanSummary();
