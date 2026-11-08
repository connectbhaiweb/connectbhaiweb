import type { Lead, Plan } from './api';

export const inr = (n: number | string | null | undefined) => (n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }));

export const fDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fDayTime = (s?: string | null) => (s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

export const planTitle = (p?: Plan | null) => (p ? p.name : 'Connection request');
export const planPrice = (p?: Plan | null) => (p ? `${inr(p.price)}/month` : '');

export const phoneDigits = (s: string) => s.replace(/\D/g, '').slice(-10);

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'grey';
/* API lead status → label and colour (the API calls follow-up "followup" and booked "scheduled") */
const LEAD: Record<string, [string, Tone]> = {
  new: ['New request', 'blue'], contacted: ['Contacted', 'blue'], followup: ['Follow-up', 'amber'], scheduled: ['Installation booked', 'amber'],
  installed: ['Installed', 'green'], lost: ['Closed', 'red'], cancelled: ['Cancelled', 'red'],
};
export const leadChip = (status: string): [string, Tone] => LEAD[status] || [status, 'grey'];

/* Booking progress steps for the customer, in the order of the website */
export const STEPS = ['Request placed', 'Installer assigned', 'Installer called', 'Installation booked', 'Installed'];
export const stepOf = (l: Lead) => ({ new: 1, contacted: 2, followup: 2, scheduled: 3, installed: 4 } as Record<string, number>)[l.status] ?? 0;

export const ticketTone = (s: string): Tone => (s === 'resolved' || s === 'closed' ? 'green' : s === 'in_progress' ? 'amber' : 'blue');
export const chargeTone = (s: string): Tone => (s === 'paid' ? 'green' : s === 'pending' || s === 'due' ? 'amber' : s === 'failed' ? 'red' : 'grey');
export const chargeLabel = (s: string) => (s === 'pending' ? 'due' : s);
export const pretty = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
