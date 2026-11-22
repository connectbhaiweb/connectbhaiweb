import { api } from './api';

/* Tickets (complaints and service requests) and chat, same API calls as the website's rest.js. */
export type Ticket = { id: number; code: string; category: string; status: string; description: string; createdAt: string };
export const loadTickets = async (): Promise<Ticket[]> => {
  const r = await api<{ items: any[] }>('GET', '/tickets?limit=100');
  return r.items.map((t) => ({ id: t.id, code: t.ticket_code, category: String(t.category || 'other').replace(/_/g, ' '), status: t.status, description: t.description || t.subject, createdAt: t.created_at }));
};
export const CATEGORIES: [string, string][] = [['No internet', 'no_internet'], ['Slow speed', 'slow_speed'], ['Frequent disconnection', 'other'], ['Billing', 'billing'], ['Shift connection', 'shifting'], ['Plan change', 'other'], ['Other', 'other']];
export const raiseTicket = (f: { leadId?: number; category: string; description: string }) =>
  api<{ ticket_code: string }>('POST', '/tickets', { lead_id: f.leadId, category: f.category, subject: f.description.trim().slice(0, 150), description: f.description.trim() });

export type Thread = { id: string; type: 'lead' | 'support'; key: number; title: string; sub: string; unread: number; last: { body: string; sender: string } | null };
export const loadThreads = async (): Promise<Thread[]> => {
  const rows = await api<any[]>('GET', '/chat/threads');
  return rows.map((t) => ({
    id: `${t.type === 'lead' ? 'lead' : 'support'}:${t.id}`, type: t.type === 'lead' ? 'lead' : 'support', key: t.id, title: t.title, sub: t.sub, unread: t.unread || 0,
    last: t.last ? { body: t.last.body, sender: t.last.sender_name || '' } : null,
  }));
};
export type Msg = { id: number; senderId: number; senderName: string; body: string; at: string };
const split = (id: string) => { const [k, key] = id.split(':'); return { type: k === 'lead' ? 'lead' : 'support', key }; };
export async function loadMessages(id: string): Promise<Msg[]> {
  const { type, key } = split(id);
  const m = await api<any[]>('GET', `/chat/${type}/${key}/messages`);
  api('POST', `/chat/${type}/${key}/read`, {}).catch(() => {});
  return m.map((x) => ({ id: x.id, senderId: x.sender_user_id, senderName: x.sender?.name || '', body: x.body, at: x.created_at }));
}
export const sendMessage = (id: string, body: string) => { const { type, key } = split(id); return api('POST', `/chat/${type}/${key}/messages`, { body: body.trim() }); };
