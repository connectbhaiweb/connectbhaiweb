import { api } from './api';
import { mapPlan, type Plan } from './catalog';

/* Customer data, mapped the same way as the website's rest.js (mapLead / mapBooking / mapCharge). */
async function all<T>(path: string): Promise<T[]> {
  const first = await api<{ items: T[]; total: number }>('GET', `${path}${path.includes('?') ? '&' : '?'}page=1&limit=100`);
  const items = [...first.items];
  const pages = Math.min(Math.ceil((first.total || 0) / 100), 50);
  for (let p = 2; p <= pages; p++) items.push(...(await api<{ items: T[] }>('GET', `${path}${path.includes('?') ? '&' : '?'}page=${p}&limit=100`)).items);
  return items;
}

export type Person = { id: number; name: string; firm: string; phone: string };
const person = (u: any): Person | null => (u ? { id: u.id, name: u.name, firm: u.business_name || '', phone: u.phone || '' } : null);

export type LeadStatus = 'new' | 'assigned' | 'contacted' | 'follow_up' | 'booked' | 'installed' | 'lost';
const LS: Record<string, LeadStatus> = { new: 'new', contacted: 'contacted', followup: 'follow_up', scheduled: 'booked', installed: 'installed', lost: 'lost', cancelled: 'lost' };

export type Lead = {
  id: number; ref: string; status: LeadStatus; pincode: string; area: string | null; address: string | null; createdAt: string; assignedAt: string | null;
  plan: Plan | null; telephoneNo: string; orderNo: string; carePlan: boolean; dsa: Person | null; tip: Person | null;
  booking: { id: number; status: 'scheduled' | 'installed' | 'cancelled'; scheduledAt: string | null; installedAt: string | null } | null;
  payment: { amount: number; paidAt: string | null } | null;
};
const mapLead = (l: any): Lead => {
  const bk = Array.isArray(l.bookings) && l.bookings[0] ? l.bookings[0] : null;
  return {
    id: l.id, ref: l.ref_code, pincode: l.pincode, area: l.area?.name ?? null, address: l.address, createdAt: l.created_at, assignedAt: l.updated_at,
    status: l.status === 'new' && (l.brought_by_user_id || l.tip_user_id) ? 'assigned' : (LS[l.status] ?? 'new'),
    plan: l.plan ? mapPlan({ ...l.plan, category: l.plan.category }) : null, telephoneNo: l.telephone_no || '', orderNo: l.order_no || '', carePlan: !!l.care_plan,
    dsa: person(l.dsa), tip: person(l.tip),
    booking: bk ? { id: bk.id, status: bk.status === 'completed' ? 'installed' : bk.status === 'cancelled' ? 'cancelled' : 'scheduled', scheduledAt: bk.scheduled_at, installedAt: bk.completed_at } : null,
    payment: l.charges?.[0] ? { amount: Number(l.charges[0].total_amount), paidAt: l.charges[0].paid_at } : null,
  };
};

export type Charge = { id: number; ref: string; description: string; amount: number; status: 'due' | 'paid' | 'failed' | string; paidAt: string | null };
const mapCharge = (c: any): Charge => ({
  id: c.id, ref: c.invoice_no || 'CH-' + String(c.id).padStart(6, '0'), description: c.description, amount: Number(c.total_amount),
  status: c.status === 'pending' ? 'due' : c.status, paidAt: c.paid_at,
});

export type Device = { leadId: number; online: boolean | null; rxDbm: number | null; lastSeen: string | null };

export type CustomerData = { leads: Lead[]; charges: Charge[]; devices: Device[] };
export async function loadCustomer(): Promise<CustomerData> {
  const [leads, charges, devices] = await Promise.all([
    all<any>('/leads').then((l) => l.map(mapLead)),
    all<any>('/charges').then((c) => c.map(mapCharge)).catch(() => []),
    all<any>('/care-plan/devices').then((d) => d.map((x): Device => ({ leadId: x.lead_id, online: x.online ?? null, rxDbm: x.rx_power_dbm != null ? Number(x.rx_power_dbm) : null, lastSeen: x.last_seen_at }))).catch(() => []),
  ]);
  return { leads, charges, devices };
}

/* ---------- display helpers (from the website's customer/format.js) ---------- */
export const STEPS: [string, string][] = [['new', 'Requested'], ['assigned', 'Assigned'], ['contacted', 'Contacted'], ['booked', 'Booked'], ['installed', 'Installed']];
export const STEP_OF: Record<string, number> = { new: 0, assigned: 1, contacted: 2, follow_up: 2, booked: 3, installed: 4 };
export const leadChip = (st: LeadStatus): readonly [string, 'blue' | 'green' | 'red' | 'amber'] =>
  ({ new: ['Request received', 'blue'], assigned: ['Agent assigned', 'blue'], contacted: ['Agent in touch', 'blue'], follow_up: ['Follow-up planned', 'amber'],
    booked: ['Installation in progress', 'blue'], installed: ['Installed', 'green'], lost: ['Closed', 'red'] } as const)[st] ?? [st, 'blue'];
const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const fDate = (d?: string | null) => (d ? `${day(d)}, ${new Date(d).getFullYear()}` : '—');
export const fDayTime = (d?: string | null) => (d ? `${day(d)}, ${new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}` : '');
export const planTitle = (p: Plan | null) => (p ? [p.provider, p.name, p.speed ? `${p.speed} Mbps` : ''].filter(Boolean).join(' ') : 'No plan chosen yet');
export const fmtPhone = (p: string) => '+91 ' + p.replace(/^(\d{5})(\d{5})$/, '$1 $2');
