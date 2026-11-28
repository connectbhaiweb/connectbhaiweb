/* Where the website's links go in the app. Home sections are reached by name, like the website's data-scroll. */
import { router, type Href } from 'expo-router';

import type { Role } from '../lib/api/base';

export type HomeSection = 'search' | 'partners' | 'faq' | 'cities';
let pending: HomeSection | null = null;
const listeners = new Set<() => void>();

/** Opens the public home page (also for a signed-in partner, like the website's "?site=1"). */
export function goHome(section?: HomeSection) {
  pending = section || null;
  router.dismissTo({ pathname: '/', params: { site: '1' } });
  listeners.forEach((f) => f());
}
export const takeSection = () => {
  const s = pending;
  pending = null;
  return s;
};
export const onSectionRequest = (f: () => void) => {
  listeners.add(f);
  return () => void listeners.delete(f);
};

export const ROLE_PATH: Record<Role, Href> = { customer: '/my', dsa: '/dsa', tip: '/tip', admin: '/admin' };
export const goTo = (path: Href) => router.navigate(path);
export const goDashboard = (role: Role) => router.navigate(ROLE_PATH[role]);
