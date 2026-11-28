import { createHttp, type Tokens } from '../src/lib/api/http';
import { createRest } from '../src/lib/api/rest';
import type { Checkout } from '../src/lib/api/checkout';

export type Call = { method: string; path: string; body: any; auth?: string };
export const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;

/** The real data layer on top of a pretend server: handler answers each request, calls records them. */
export function fakeApi(handler: (call: Call) => Response | unknown, options: { checkout?: Checkout; upload?: typeof fetch } = {}) {
  let saved: Tokens | null = null;
  const calls: Call[] = [];
  const kv = new Map<string, string>();
  const http = createHttp({
    baseUrl: 'http://api',
    store: { load: async () => saved, save: async (t) => void (saved = t) },
    fetcher: (async (url: string, init: RequestInit) => {
      const call: Call = {
        method: String(init.method), path: url.replace('http://api', ''), body: init.body ? JSON.parse(String(init.body)) : undefined,
        auth: (init.headers as Record<string, string>).authorization,
      };
      calls.push(call);
      const out = handler(call);
      return out && typeof out === 'object' && 'json' in out ? (out as Response) : reply(200, out ?? {});
    }) as typeof fetch,
  });
  const API = createRest({
    http,
    checkout: options.checkout || (async () => ({ razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' })),
    storage: { getItem: async (k) => kv.get(k) ?? null, setItem: async (k, v) => void kv.set(k, v) },
    filePart: (f) => 'file:' + f.name,
    fetcher: options.upload,
    wait: async () => {},
  });
  return { API, http, calls, saved: () => saved, put: (t: Tokens) => (saved = t) };
}

export const apiUser = (role: string, over: Record<string, unknown> = {}) => ({ id: 7, role, name: 'Asha', phone: '9000000042', email: null, ...over });

/** Logs the pretend server's user in, then forgets the login calls. */
export async function loggedIn(role: string, handler: (call: Call) => Response | unknown, options?: Parameters<typeof fakeApi>[1]) {
  const s = fakeApi((call) => (call.path === '/auth/login' ? { access_token: 'a', refresh_token: 'r', user: apiUser(role) } : handler(call)), options);
  await s.API.signInPassword('9000000042', 'x');
  s.calls.length = 0;
  return s;
}
