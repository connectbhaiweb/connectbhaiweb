/* Port of the "tokens + HTTP" part of frontend/src/lib/connectbhai/rest.js: same headers, one silent token refresh
   on 401, the same short reuse of identical GETs, and the same error messages. */
import { AppError } from './base';

export { AppError };
export type Tokens = { access_token: string; refresh_token: string };
export type TokenStore = {
  load: () => Promise<Tokens | null>;
  save: (tokens: Tokens | null) => Promise<void>;
};
export type RequestOptions = { anon?: boolean };
export type Query = Record<string, string | number | boolean | null | undefined>;

const TIMEOUT_MS = 30000;
const GET_TTL = 8000;
/* Chat, notifications and live device data are never reused. */
const NO_CACHE = /\/(chat|messages|notifications|devices|care)/;

const messageOf = (body: any): string =>
  (body && (Array.isArray(body.message) ? body.message.join(' · ') : body.message)) || 'Something went wrong. Please try again.';

export const queryString = (query?: Query): string => {
  const parts = Object.entries(query || {})
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? '?' + parts.join('&') : '';
};

export function createHttp(config: { baseUrl: string; store: TokenStore; fetcher?: typeof fetch; onSignedOut?: () => void }) {
  const { baseUrl, store } = config;
  let tokens: Tokens | null = null;
  let refreshing: Promise<boolean> | null = null;
  const getCache = new Map<string, { p: Promise<any>; t: number }>();
  const signedOut = new Set<() => void>(config.onSignedOut ? [config.onSignedOut] : []);

  async function setTokens(next: Tokens | null) {
    tokens = next;
    getCache.clear();
    try {
      await store.save(next);
    } catch {
      /* the login then lasts only until the app is closed */
    }
  }
  async function loadTokens() {
    tokens = await store.load();
    return tokens;
  }

  async function raw(method: string, path: string, body: unknown, access?: string) {
    if (!baseUrl) throw new AppError('The app has no server address. Set EXPO_PUBLIC_API_URL.');
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await (config.fetcher || fetch)(baseUrl + path, {
        method,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(access ? { authorization: 'Bearer ' + access } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: abort.signal,
      });
    } catch {
      throw new AppError('Cannot reach the Connect Bhai server. Check that the API is running.');
    } finally {
      clearTimeout(timer);
    }
    let data: any = null;
    try {
      data = await response.json();
    } catch {
      /* empty body */
    }
    return { response, data };
  }

  /* Requests that fail together share one refresh, so the refresh token is only used once. */
  function refresh(): Promise<boolean> {
    refreshing ||= (async () => {
      if (!tokens?.refresh_token) return false;
      const { response, data } = await raw('POST', '/auth/refresh', { refresh_token: tokens.refresh_token });
      if (!response.ok) {
        await setTokens(null);
        signedOut.forEach((f) => f());
        return false;
      }
      await setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
      return true;
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function send<T>(method: string, path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    let { response, data } = await raw(method, path, body, options.anon ? undefined : tokens?.access_token);
    if (response.status === 401 && !options.anon && tokens && (await refresh())) {
      ({ response, data } = await raw(method, path, body, tokens?.access_token));
    }
    if (!response.ok) {
      throw new AppError(
        response.status === 401 && !options.anon
          ? 'Please log in again.'
          : response.status === 429
            ? 'Too many attempts. Please wait a minute and try again.'
            : messageOf(data),
      );
    }
    return data as T;
  }

  function request<T>(method: string, path: string, body: unknown, options?: RequestOptions): Promise<T> {
    if (method !== 'GET') {
      if (!/^\/chat\//.test(path)) getCache.clear(); // marking a chat read changes nothing the cached lists show
      return send<T>(method, path, body, options);
    }
    if (NO_CACHE.test(path)) return send<T>(method, path, body, options);
    const key = (tokens?.access_token ? 'u:' : 'a:') + path;
    const hit = getCache.get(key);
    if (hit && Date.now() - hit.t < GET_TTL) return hit.p;
    const p = send<T>(method, path, body, options);
    getCache.set(key, { p, t: Date.now() });
    p.catch(() => getCache.delete(key));
    return p;
  }

  return {
    loadTokens,
    setTokens,
    hasTokens: () => !!tokens,
    onSignedOut(f: () => void) {
      signedOut.add(f);
      return () => void signedOut.delete(f);
    },
    /** Pull to refresh: forget the reused answers. */
    clearCache: () => getCache.clear(),
    get: <T = any>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
    post: <T = any>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body || {}, options),
    patch: <T = any>(path: string, body?: unknown) => request<T>('PATCH', path, body || {}),
    put: <T = any>(path: string, body?: unknown) => request<T>('PUT', path, body || {}),
    del: <T = any>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  };
}
export type Http = ReturnType<typeof createHttp>;
