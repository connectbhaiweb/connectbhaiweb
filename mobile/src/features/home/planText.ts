/* How a plan reads on cards and in dialogs. Port of the plan helpers in the website's ui.js. */
import { inr } from '../../lib/api/base';
import type { Plan } from '../../lib/api/types';

export const isSpeedCat = (c: string) => ['fiber', 'air_fiber'].includes(c);
export const dataTxt = (p: Plan) => (p.data_limit_gb ? p.data_limit_gb.toLocaleString('en-IN') + ' GB' : 'Unlimited');
export const speedTxt = (p: Plan) => (Number(p.speed_mbps) > 0 ? p.speed_mbps + ' Mbps' : '');
export const joinDot = (...a: (string | null | undefined | false)[]) => a.filter(Boolean).join(' · ');
export const priceUnit = (p: Plan) => (p.category === 'sim_prepaid' ? `/${p.validity_days} days` : '/month');
export const budgetOf = (p: Plan) => (p.price_ex_gst != null ? Number(p.price_ex_gst) : Number(p.price_monthly));
/** BSNL plans carry a "Recommended" mark. */
export const isRecommended = (p: Plan) => /^bsnl\b/i.test(String(p.provider?.brand || p.provider?.name || '').trim());

export function planBig(p: Plan): [string, string] {
  if (isSpeedCat(p.category)) return [Number(p.speed_mbps) > 0 ? String(p.speed_mbps) : '—', 'Mbps'];
  if (p.category === 'tv') return [String(p.tv_channels), 'channels'];
  if (p.category === 'ott') return [String(p.ott_apps.length), 'apps'];
  return p.data_per_day_gb ? [String(p.data_per_day_gb), 'GB/day'] : [String(p.data_limit_gb || '∞'), 'GB/month'];
}
export function planFacts(p: Plan): [string, string][] {
  const inst: [string, string] = ['Installation', Number(p.install_charge) ? inr(p.install_charge) : 'Free'];
  if (isSpeedCat(p.category)) return [['Data', dataTxt(p)], inst, ['TV channels', p.tv_channels ? p.tv_channels + '+' : '—']];
  if (p.category === 'tv') return [['Validity', `${p.validity_days} days`], inst];
  if (p.category === 'ott') return [['Validity', `${p.validity_days} days`]];
  return [['Validity', `${p.validity_days} days`], ['Calls', p.voice || '—'], ['SMS', p.sms_per_day ? p.sms_per_day + '/day' : '—']];
}
export const ctaFor = (p: Plan) => (p.category.startsWith('sim') ? 'Book SIM' : p.category === 'ott' ? 'Get this pack' : p.category === 'air_fiber' ? 'Book Air Fiber' : 'Request connection');
export const planSummary = (p?: Plan | null) =>
  !p ? '' : isSpeedCat(p.category) ? joinDot(speedTxt(p), dataTxt(p))
    : p.category === 'tv' ? (p.tv_channels ? `${p.tv_channels} channels` : '')
    : p.category === 'ott' ? (p.ott_apps.length ? `${p.ott_apps.length} apps` : '')
    : joinDot(p.data_per_day_gb ? p.data_per_day_gb + ' GB/day' : (p.data_limit_gb || '∞') + ' GB', p.validity_days ? `${p.validity_days} days` : '');
export const planLine = (p?: Plan | null) =>
  p ? joinDot(p.provider?.name, p.name, planSummary(p), p.price_monthly != null ? inr(p.price_monthly) + (p.category === 'sim_prepaid' ? '' : '/mo') : '') : 'No plan chosen (callback)';

export type Filters = { speed: number; price: number; ott: boolean; tv: boolean; providers: string[]; sort: 'price' | 'speed' | 'value' };
export const startFilters = (results: Plan[]): Filters => {
  const maxP = Math.max(300, ...results.map(budgetOf));
  return { speed: 0, price: Math.ceil(maxP / 100) * 100, ott: false, tv: false, providers: [], sort: 'price' };
};
export function filterPlans(results: Plan[], f: Filters) {
  const list = results.filter(
    (p) => (p.speed_mbps || 0) >= f.speed && budgetOf(p) <= f.price && (!f.ott || p.ott_apps.length > 0) && (!f.tv || p.tv_channels > 0) && (!f.providers.length || f.providers.includes(p.provider_id)),
  );
  const sorters = {
    price: (a: Plan, b: Plan) => a.price_monthly - b.price_monthly,
    speed: (a: Plan, b: Plan) => (b.speed_mbps || 0) - (a.speed_mbps || 0),
    value: (a: Plan, b: Plan) => a.price_monthly / (a.speed_mbps || 1) - b.price_monthly / (b.speed_mbps || 1),
  };
  return list.sort(sorters[f.sort] || sorters.price);
}
