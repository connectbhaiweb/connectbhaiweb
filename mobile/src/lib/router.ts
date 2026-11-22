import { api } from '@/lib/api';

export type SpeedResult = { status: string; down: number | null; up: number | null; ping: number | null; error: string | null; simulated: boolean };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const restartRouter = (id: number) => api('POST', `/care-plan/devices/${id}/actions`, { action: 'reboot' });
export const changeWifi = (id: number, ssid: string, password: string) =>
  api('POST', `/care-plan/devices/${id}/actions`, { action: 'change_wifi', params: { ssid, password: password || undefined } });

/** Starts the modem's own line test and waits for the server to finish it (1-3 minutes on a real modem). */
export async function runSpeedTest(id: number, maxMs = 6 * 60 * 1000): Promise<SpeedResult> {
  const row = await api<{ id: number; status: string }>('POST', `/care-plan/devices/${id}/speed-test`, {});
  const end = Date.now() + maxMs;
  let t: any = row, simulated = false;
  while (t && t.status === 'running') {
    if (Date.now() > end) throw new Error('The speed test is still running. Check again in a minute.');
    await sleep(4000);
    const x = await api<any>('GET', `/care-plan/devices/${id}`);
    simulated = !!x.simulated;
    t = (x.speed_tests ?? []).find((r: any) => String(r.id) === String(row.id)) ?? t;
  }
  if (t?.status === 'failed') throw new Error(t.error || 'The speed test failed.');
  return { status: t.status, down: t.download_mbps != null ? Number(t.download_mbps) : null, up: t.upload_mbps != null ? Number(t.upload_mbps) : null, ping: t.ping_ms ?? null, error: null, simulated };
}
