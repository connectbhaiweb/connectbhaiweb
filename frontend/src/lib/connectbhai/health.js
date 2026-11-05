/* Backend health helpers. The NestJS API serves /health (liveness) and /health/ready (checks MySQL) OUTSIDE the /api/v1 prefix. */
import { API_URL } from "./config";
export { API_URL };
export const API_ORIGIN = API_URL ? API_URL.replace(/\/api\/v\d+\/?$/, "").replace(/\/$/, "") : null;

/** Returns { api: 'up'|'down', db: 'up'|'down'|'unknown', ms } */
export async function checkBackend(signal) {
  if (!API_ORIGIN) return { api: "down", db: "unknown", ms: null, error: "NEXT_PUBLIC_API_URL is not set" };
  const t0 = performance.now();
  try {
    const r = await fetch(API_ORIGIN + "/health/ready", { cache: "no-store", signal });
    const ms = Math.round(performance.now() - t0);
    let body = null; try { body = await r.json(); } catch (e) { /* ignore */ }
    const db = body && (body.database || (body.info && body.info.database && body.info.database.status)) || (r.ok ? "up" : "down");
    return { api: "up", db: db === "up" ? "up" : "down", ms, body };
  } catch (e) {
    return { api: "down", db: "unknown", ms: null, error: e && e.message };
  }
}
