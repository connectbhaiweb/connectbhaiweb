/* Tiny external store that lets server-rendered React components (Header, CompareBar) react to state owned by
   the browser-only app module (session user, compare selection). SSR-safe: no browser APIs at import time. */
const SERVER_SNAPSHOT = { user: null, compareCount: 0, showCompare: false };
let snapshot = SERVER_SNAPSHOT;
const listeners = new Set();

export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const getSnapshot = () => snapshot;
export const getServerSnapshot = () => SERVER_SNAPSHOT;

export function publish(next) {
  const merged = { ...snapshot, ...next };
  const same = Object.keys(merged).every(k => k === "user"
    ? (merged.user && snapshot.user ? merged.user.role === snapshot.user.role && merged.user.full_name === snapshot.user.full_name : merged.user === snapshot.user)
    : merged[k] === snapshot[k]);
  if (same) return;
  snapshot = merged;
  listeners.forEach(fn => fn());
}
