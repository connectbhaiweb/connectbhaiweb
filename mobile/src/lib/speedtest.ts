/** Wi-Fi speed test with plain fetch against Cloudflare's speed endpoints (the website uses Cloudflare's speed-test module). */
const BASE = 'https://speed.cloudflare.com';
export type SpeedRes = { down: number | null; up: number | null; ping: number | null; jit: number | null };
export type Phase = 'ping' | 'download' | 'upload';

const mbps = (bytes: number, ms: number) => (bytes * 8) / (ms / 1000) / 1e6;

async function latency(n: number) {
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = Date.now();
    await fetch(`${BASE}/__down?bytes=0&r=${s}${i}`, { cache: 'no-store' });
    t.push(Date.now() - s);
  }
  const ping = Math.min(...t);
  const jit = t.slice(1).reduce((a, v, i) => a + Math.abs(v - t[i]), 0) / Math.max(1, t.length - 1);
  return { ping, jit };
}
async function download(onLive: (v: number) => void, ms = 7000) {
  const start = Date.now(); let bytes = 0, best = 0;
  while (Date.now() - start < ms) {
    const s = Date.now();
    const r = await fetch(`${BASE}/__down?bytes=8000000&r=${s}`, { cache: 'no-store' });
    const b = await r.arrayBuffer();
    bytes += b.byteLength; const v = mbps(b.byteLength, Date.now() - s);
    best = Math.max(best, v); onLive(mbps(bytes, Date.now() - start));
  }
  return mbps(bytes, Date.now() - start);
}
async function upload(onLive: (v: number) => void, ms = 5000) {
  const start = Date.now(); let bytes = 0;
  const body = new Uint8Array(1_500_000);
  while (Date.now() - start < ms) {
    await fetch(`${BASE}/__up`, { method: 'POST', body, cache: 'no-store' });
    bytes += body.byteLength; onLive(mbps(bytes, Date.now() - start));
  }
  return mbps(bytes, Date.now() - start);
}

export async function runSpeedTest(onPhase: (p: Phase) => void, onLive: (v: number) => void): Promise<SpeedRes> {
  onPhase('ping'); const { ping, jit } = await latency(8);
  onPhase('download'); const down = await download(onLive);
  onPhase('upload'); const up = await upload(onLive);
  return { down, up, ping, jit };
}
