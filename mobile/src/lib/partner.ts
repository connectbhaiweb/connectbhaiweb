import { api } from './api';
import { all, mapLead, type Lead, type LeadStatus } from './customer';

export type { Lead, LeadStatus };
export const loadLeads = () => all<any>('/leads').then((l) => l.map(mapLead));
export const loadLead = (id: number) => api<any>('GET', `/leads/${id}`).then(mapLead);

export type Dash = { leads: Record<string, number>; bookings: Record<string, number>; commission: Record<string, number> };
export async function loadDash(): Promise<Dash> {
  const d = await api<any>('GET', '/reports/dashboard');
  const L = d.leads ?? {}, B = d.bookings ?? {};
  return {
    leads: { new: L.new || 0, contacted: L.contacted || 0, follow_up: L.followup || 0, booked: L.scheduled || 0, installed: L.installed || 0, lost: (L.lost || 0) + (L.cancelled || 0) },
    bookings: { scheduled: (B.scheduled || 0) + (B.rescheduled || 0), installed: B.completed || 0 },
    commission: { pending: 0, approved: 0, paid: 0, ...(d.commission ?? {}) },
  };
}

/** Moves a lead along the status machine. Server name for "follow up" is `followup`. */
export const setStatus = (id: number, status: 'contacted' | 'follow_up' | 'lost', o: { note?: string; followUp?: Date } = {}) =>
  api('PATCH', `/leads/${id}/status`, {
    status: status === 'follow_up' ? 'followup' : status, note: o.note || undefined,
    followup_at: o.followUp ? o.followUp.toISOString() : undefined, lost_reason: status === 'lost' ? o.note || undefined : undefined,
  });

export const bookInstall = (leadId: number, when: Date) => api('POST', '/bookings', { lead_id: leadId, scheduled_at: when.toISOString() });

export type TipOption = { id: number; name: string; firm: string; covers: boolean };
export const tipOptions = (id: number) =>
  api<any[]>('GET', `/leads/${id}/tip-options`).then((r) => r.map((t): TipOption => ({ id: t.id, name: t.name, firm: t.business_name || '', covers: !!t.covers_pin })));
export const assignTip = (id: number, tipId: number, telephoneNo: string, orderNo: string) =>
  api('PATCH', `/leads/${id}/assign`, { tip_user_id: tipId, telephone_no: telephoneNo, order_no: orderNo });

export type Commission = { id: number; amount: number; status: string; leadRef: string; customer: string; paidAt: string | null; createdAt: string };
export const loadCommissions = () =>
  all<any>('/commissions').then((r) => r.map((c): Commission => ({ id: c.id, amount: Number(c.amount), status: c.status, leadRef: c.lead?.ref_code ?? '', customer: c.lead?.customer_name ?? '', paidAt: c.paid_at ?? null, createdAt: c.created_at })));

export const addLead = (f: { name: string; phone: string; pincode: string; address?: string }) =>
  api<{ ref_code: string }>('POST', '/leads', { customer_name: f.name.trim(), customer_phone: f.phone, pincode: f.pincode, address: f.address || undefined });

/** Quick date choices instead of a calendar widget. */
export const dayChoices = (): { label: string; date: Date }[] => {
  const at = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); if (d === 0) x.setHours(23, 59, 0, 0); else x.setHours(18, 0, 0, 0); return x; };
  return [{ label: 'Today', date: at(0) }, { label: 'Tomorrow', date: at(1) }, { label: 'In 3 days', date: at(3) }, { label: 'Next week', date: at(7) }];
};

export const startInstall = (bookingId: number) => api('POST', `/bookings/${bookingId}/start`, {});
export const completeInstall = (bookingId: number, f: { connectionId: string; routerSerial?: string; notes?: string }) =>
  api('POST', `/bookings/${bookingId}/complete`, { connection_id: f.connectionId.trim(), router_serial: f.routerSerial?.trim() || undefined, notes: f.notes?.trim() || undefined });

export type Fee = { id: number; ref: string; description: string; amount: number; status: string; paidAt: string | null; createdAt: string };
export const loadFees = () =>
  all<any>('/charges').then((r) => r.map((c): Fee => ({
    id: c.id, ref: c.invoice_no || `CH-${String(c.id).padStart(6, '0')}`, description: c.description || 'Fee', amount: Number(c.total_amount),
    status: c.status === 'pending' ? 'due' : c.status, paidAt: c.paid_at ?? null, createdAt: c.created_at,
  })));

/* ---------- admin ---------- */
export type Partner = { id: number; name: string; firm: string; phone: string; role: 'dsa' | 'tip'; status: string; code: string; active: boolean; pincode: string };
export const loadPartners = (role: 'dsa' | 'tip') =>
  all<any>(`/users?role=${role}`).then((r) => r.map((u): Partner => ({
    id: u.id, name: u.name, firm: u.business_name || '', phone: u.phone, role, status: u.partner_status || 'pending',
    code: u.partner_code || '', active: u.is_active !== false, pincode: u.pincode || '',
  })));
export const setPartnerStatus = (id: number, status: 'approved' | 'rejected' | 'suspended', reason?: string) =>
  api('PATCH', `/users/${id}/partner-status`, { status, reason: reason || undefined });
export const assignDsa = (leadId: number, dsaId: number) => api('PATCH', `/leads/${leadId}/assign`, { dsa_user_id: dsaId });
