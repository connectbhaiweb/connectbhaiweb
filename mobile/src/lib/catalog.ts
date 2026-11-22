import type { ImageSourcePropType } from 'react-native';
import { api } from './api';

export type Category = 'fiber' | 'air_fiber' | 'tv' | 'ott';
export const CATEGORIES: { key: Category; label: string; long: string }[] = [
  { key: 'fiber', label: 'Fiber', long: 'Fiber broadband' }, { key: 'air_fiber', label: 'Air Fiber', long: 'Air Fiber' },
  { key: 'tv', label: 'TV', long: 'TV' }, { key: 'ott', label: 'OTT', long: 'OTT' },
];
export const inr = (n: number | string | null | undefined) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/* Official provider logos are bundled (the API's logo URLs can be SVG, which React Native cannot draw). */
const LOGOS: Record<string, ImageSourcePropType> = {
  bsnl: require('../../assets/logos/bsnl.png'),
  jio: require('../../assets/logos/jio.png'),
  airtel: require('../../assets/logos/airtel.png'),
};
export const logoFor = (name: string, url?: string | null): ImageSourcePropType | null =>
  LOGOS[name.toLowerCase()] ?? (url && /\.(png|jpe?g|webp)(\?|$)/i.test(url) ? { uri: url } : null);

type RawPlan = {
  id: number; name: string; speed_mbps: number | null; price: number; price_ex_gst?: number | null; install_charge: number | string;
  validity_days: number | null; tv_channels: number | null; ott_apps?: ({ name: string } | string)[];
  category: { name: string; type: string; logo_url: string | null };
};
export type Plan = {
  id: number; name: string; provider: string; type: Category; logo: ImageSourcePropType | null; speed: number | null;
  price: number; priceExGst: number | null; install: number; tv: number; ott: string[]; validity: number | null;
};
export const mapPlan = (p: RawPlan): Plan => ({
  id: p.id, name: p.name, provider: p.category.name, type: p.category.type as Category, logo: logoFor(p.category.name, p.category.logo_url),
  speed: p.speed_mbps, price: Number(p.price), priceExGst: p.price_ex_gst != null ? Number(p.price_ex_gst) : null, install: Number(p.install_charge) || 0,
  tv: p.tv_channels || 0, ott: (p.ott_apps ?? []).map((o) => (typeof o === 'string' ? o : o.name)), validity: p.validity_days,
});

export type PinInfo = { pincode: string; serviceable: boolean; city: { name: string } | null; areas: { id: number; name: string }[] };
export const lookupPin = (pin: string) => api<PinInfo>('GET', `/pincodes/${pin}`, undefined, { anon: true });

export async function searchPlans(pin: string, type: Category) {
  const r = await api<{ items: RawPlan[] }>('GET', `/plans?pincode=${pin}&type=${type}&limit=100`, undefined, { anon: true });
  return r.items.map(mapPlan);
}
/* PIN suggestions: one chip per PIN code, like the website. */
export async function popularPins() {
  const r = await api<{ name: string; pincode: string }[]>('GET', '/cities/1/areas', undefined, { anon: true }).catch(() => []);
  const seen = new Map<string, string>();
  (Array.isArray(r) ? r : []).forEach((a) => { if (!seen.has(a.pincode)) seen.set(a.pincode, a.name.split(',')[0]); });
  return [...seen].slice(0, 8).map(([pin, area]) => ({ pin, area }));
}
/* "Ddu nagar, Vijay Nagar" from the areas of a PIN */
export const areaNames = (info: PinInfo) =>
  [...new Set(info.areas.flatMap((a) => a.name.split(',').map((x) => x.trim()).filter((x) => x && x.toLowerCase() !== (info.city?.name ?? '').toLowerCase())))].slice(0, 3).join(', ');

export type RequestForm = { name: string; phone: string; pincode: string; address?: string; plan_id?: number };
export const requestConnection = (f: RequestForm) =>
  api<{ id: number; ref_code: string }>('POST', '/leads', {
    customer_name: f.name.trim(), customer_phone: f.phone, pincode: f.pincode,
    address: f.address?.trim() || undefined, plan_id: f.plan_id, source: f.plan_id ? 'website' : 'callback',
  }, { anon: true });

export const deleteMyAccount = (phone: string) => api('DELETE', '/users/me', { phone });
