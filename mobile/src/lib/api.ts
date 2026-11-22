import * as SecureStore from 'expo-secure-store';

export type Role = 'customer' | 'dsa' | 'tip' | 'admin';
export type User = { id: number; role: Role; phone: string; name: string; [k: string]: unknown };
type Tokens = { access_token: string; refresh_token: string };

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const KEY = 'cb-tokens';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

let tokens: Tokens | null = null;
let onLoggedOut: () => void = () => {};
export const setLoggedOutHandler = (fn: () => void) => { onLoggedOut = fn; };

const save = async (t: Tokens | null) => {
  tokens = t;
  if (t) await SecureStore.setItemAsync(KEY, JSON.stringify(t));
  else await SecureStore.deleteItemAsync(KEY);
};

export async function loadTokens() {
  try { tokens = JSON.parse((await SecureStore.getItemAsync(KEY)) ?? 'null'); } catch { tokens = null; }
  return tokens !== null;
}

const msgOf = (b: any) =>
  (b && (Array.isArray(b.message) ? b.message.join(' · ') : b.message)) || 'Something went wrong. Please try again.';

async function raw(method: string, path: string, body?: unknown, token?: string) {
  let r: Response;
  try {
    r = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No internet connection. Please try again.', 0);
  }
  const data = await r.json().catch(() => null);
  return { r, data };
}

let refreshing: Promise<boolean> | null = null;
const refresh = () =>
  (refreshing ??= (async () => {
    if (!tokens) return false;
    const { r, data } = await raw('POST', '/auth/refresh', { refresh_token: tokens.refresh_token });
    if (!r.ok) { await save(null); return false; }
    await save({ access_token: data.access_token, refresh_token: data.refresh_token });
    return true;
  })().finally(() => { refreshing = null; }));

export async function api<T = any>(method: string, path: string, body?: unknown, opt: { anon?: boolean } = {}): Promise<T> {
  let { r, data } = await raw(method, path, body, opt.anon ? undefined : tokens?.access_token);
  if (r.status === 401 && !opt.anon && tokens) {
    if (await refresh()) ({ r, data } = await raw(method, path, body, tokens?.access_token));
    else onLoggedOut();
  }
  if (!r.ok) {
    throw new ApiError(
      r.status === 429 ? 'Too many attempts. Please wait a minute and try again.'
        : r.status === 401 && !opt.anon ? 'Please log in again.' : msgOf(data),
      r.status,
    );
  }
  return data as T;
}

export const requestOtp = (phone: string) => api('POST', '/auth/otp/request', { phone }, { anon: true });

export async function verifyOtp(phone: string, code: string, name?: string): Promise<User> {
  const d = await api<Tokens & { user: User }>('POST', '/auth/otp/verify', { phone, code, name }, { anon: true });
  await save({ access_token: d.access_token, refresh_token: d.refresh_token });
  return d.user;
}

export const fetchMe = () => api<User>('GET', '/users/me');
export const hasSession = () => tokens !== null;
export const logout = () => save(null);
