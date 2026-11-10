/** Tiny in-memory cache for data that rarely changes and is read by every visitor (plans, cities). Entries expire after `ttlMs`; `clear()` after an admin edit. */
export class TtlCache {
  private m = new Map<string, { v: unknown; t: number }>();
  constructor(private ttlMs = 60_000, private max = 500) {}
  async get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.m.get(key);
    if (hit && Date.now() - hit.t < this.ttlMs) return hit.v as T;
    const v = await load();
    if (this.m.size >= this.max) this.m.clear();
    this.m.set(key, { v, t: Date.now() });
    return v;
  }
  clear() { this.m.clear(); }
}
