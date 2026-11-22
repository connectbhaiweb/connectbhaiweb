import { api } from './api';

export type Category = 'fiber' | 'air_fiber' | 'tv' | 'ott';
export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'fiber', label: 'Fiber' }, { key: 'air_fiber', label: 'Air Fiber' },
  { key: 'tv', label: 'TV' }, { key: 'ott', label: 'OTT' },
];

export type Plan = {
  id: number; name: string; speed_mbps: number | null; data_limit: string | null; price: number;
  install_charge: number; has_tv: boolean; category: { name: string; logo_url: string | null };
};
export type PinInfo = { pincode: string; serviceable: boolean; city: { name: string } | null; areas: { id: number; name: string }[] };

export const lookupPin = (pin: string) => api<PinInfo>('GET', `/pincodes/${pin}`, undefined, { anon: true });

export async function searchPlans(pin: string, type: Category) {
  const r = await api<{ items: Plan[] }>('GET', `/plans?pincode=${pin}&type=${type}&limit=50`, undefined, { anon: true });
  return r.items;
}

export type RequestForm = { name: string; phone: string; pincode: string; address?: string; plan_id?: number };
export const requestConnection = (f: RequestForm) =>
  api<{ id: number; ref_code: string }>('POST', '/leads', {
    customer_name: f.name.trim(), customer_phone: f.phone, pincode: f.pincode,
    address: f.address?.trim() || undefined, plan_id: f.plan_id, source: f.plan_id ? 'website' : 'callback',
  }, { anon: true });

export type MyLead = {
  id: number; ref_code: string; status: string; pincode: string; address: string | null; created_at: string;
  telephone_no: string | null; order_no: string | null;
  plan: { name: string; price: number; category?: { name: string } } | null;
  bookings?: { status: string; scheduled_at: string | null }[];
};
export const myLeads = () => api<{ items: MyLead[] }>('GET', '/leads?limit=50').then((r) => r.items);
export const deleteMyAccount = (phone: string) => api('DELETE', '/users/me', { phone });
