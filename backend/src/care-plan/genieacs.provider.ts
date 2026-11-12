import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DeviceStatus { online: boolean; last_seen_at: Date; rx_power_dbm: number | null; wifi_ssid: string | null; connected_clients: number; device_id?: string; raw?: any }
export interface AcsListedDevice { id: string; manufacturer: string | null; model: string | null; serial: string | null; firmware: string | null; last_inform: string | null; online: boolean; rx_power_dbm: number | null; wifi_ssid: string | null; ip: string | null }
export interface SpeedResult { download_mbps: number | null; upload_mbps: number | null; ping_ms: number | null; simulated?: boolean }
export interface ActionResult { ok: boolean; error?: string }
export interface AcsHealth { status: 'up' | 'down' | 'mock'; reachable: boolean; mock: boolean; latency_ms?: number; checked_at: string; detail?: string }

/**
 * GenieACS (TR-069) gateway. With GENIEACS_NBI_URL set it talks to the real NBI; otherwise it returns
 * deterministic mock data so the whole Care Plan flow works in dev/test.
 */
@Injectable()
export class GenieAcsProvider {
  private readonly logger = new Logger(GenieAcsProvider.name);
  constructor(private cfg: ConfigService) {}
  private get base() { return this.cfg.get<string>('GENIEACS_NBI_URL') || ''; }
  get isMock() { return !this.base; }
  private headers() {
    const token = this.cfg.get<string>('GENIEACS_API_TOKEN');
    const u = this.cfg.get<string>('GENIEACS_USERNAME');
    // Token (Bearer) wins: it is what the gateway in front of the NBI checks. Basic auth kept for self-hosted ACS setups.
    return { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : u ? { authorization: 'Basic ' + Buffer.from(`${u}:${this.cfg.get('GENIEACS_PASSWORD')}`).toString('base64') } : {}) };
  }
  private seed(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

  private healthCache: { at: number; value: AcsHealth } | null = null;

  /**
   * Is the GenieACS NBI (port 7557) reachable and answering? GenieACS has no health endpoint of its own,
   * so we run the cheapest NBI query (one device id) with a short timeout. Cached for 10s so a public
   * uptime monitor cannot hammer the ACS.
   */
  async health(): Promise<AcsHealth> {
    if (this.isMock) return { status: 'mock', reachable: false, mock: true, checked_at: new Date().toISOString(), detail: 'GENIEACS_NBI_URL is not set; using mock device data' };
    if (this.healthCache && Date.now() - this.healthCache.at < 10_000) return this.healthCache.value;
    const started = Date.now();
    let value: AcsHealth;
    try {
      const r = await fetch(`${this.base}/devices?limit=1&projection=${encodeURIComponent('_id')}`, { headers: this.headers(), signal: AbortSignal.timeout(3000) });
      const latency_ms = Date.now() - started;
      if (r.ok) value = { status: 'up', reachable: true, mock: false, latency_ms, checked_at: new Date().toISOString() };
      else if (r.status === 401 || r.status === 403) value = { status: 'down', reachable: true, mock: false, latency_ms, checked_at: new Date().toISOString(), detail: `GenieACS rejected credentials (${r.status}); check GENIEACS_API_TOKEN` };
      else value = { status: 'down', reachable: true, mock: false, latency_ms, checked_at: new Date().toISOString(), detail: `GenieACS answered HTTP ${r.status}` };
    } catch (e: any) {
      const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      this.logger.warn(`GenieACS health check failed: ${e?.message}`);
      value = { status: 'down', reachable: false, mock: false, latency_ms: Date.now() - started, checked_at: new Date().toISOString(), detail: timeout ? 'GenieACS did not answer within 3s' : 'GenieACS unreachable' };
    }
    this.healthCache = { at: Date.now(), value };
    return value;
  }

  /** Where the modem keeps its optical receive power differs by make (Huawei "Interafce" typo, China Telecom X_CT-COM on Syrotech/Realtek, TR-181 Device.Optical). null when none of them is present, never a fake 0 dBm. */
  static readonly RX_POWER_PATHS = [
    'InternetGatewayDevice.WANDevice.1.X_CT-COM_GponInterfaceConfig.RXPower',
    'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower',
    'InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RXPower',
    'Device.Optical.Interface.1.Stats.OpticalSignalLevel',
  ];
  private rxPower(v: (p: string) => any): number | null {
    for (const path of GenieAcsProvider.RX_POWER_PATHS) {
      const raw = v(path);
      const n = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  /** A modem counts as online if it contacted GenieACS within this window. Modem here checks in about every 30 s; keep it above your modems' periodic-inform interval. Override with ACS_ONLINE_WINDOW_SECONDS. */
  private get onlineWindowMs() { const n = Number(this.cfg.get('ACS_ONLINE_WINDOW_SECONDS')); return (Number.isFinite(n) && n > 0 ? n : 120) * 1000; }

  async fetchStatus(deviceId: string): Promise<DeviceStatus> {
    if (this.isMock) {
      const h = this.seed(deviceId);
      return { online: h % 7 !== 0, last_seen_at: new Date(), rx_power_dbm: -(18 + (h % 90) / 10), wifi_ssid: `ConnectBhai-${deviceId.slice(-4)}`, connected_clients: 1 + (h % 9) };
    }
    const r = await fetch(`${this.base}/devices?query=${encodeURIComponent(JSON.stringify({ $or: [{ _id: deviceId }, { '_deviceId._SerialNumber': deviceId }] }))}`, { headers: this.headers(), signal: AbortSignal.timeout(8000) });   // the id GenieACS knows is OUI-ProductClass-Serial; a Care Plan record may only hold the serial   // never wait forever on the modem server
    if (!r.ok) throw new Error(`GenieACS ${r.status}`);
    const d: any = (await r.json())[0];
    if (!d) throw new Error('Device not found in GenieACS');
    const lastInform = new Date(d._lastInform);
    const v = (p: string) => p.split('.').reduce((o: any, k) => o?.[k], d)?._value;
    return {
      device_id: String(d._id), online: Date.now() - lastInform.getTime() < this.onlineWindowMs, last_seen_at: lastInform,
      rx_power_dbm: this.rxPower(v),
      wifi_ssid: v('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID') ?? v('Device.WiFi.SSID.1.SSID') ?? null,
      connected_clients: Number(v('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations') ?? 0),
    };
  }

  /** Every modem GenieACS knows (up to 500), linked to a customer or not. Read-only. Empty in mock mode. Throws when GenieACS cannot be reached. */
  async listDevices(): Promise<AcsListedDevice[]> {
    if (this.isMock) return [];
    const paths = ['InternetGatewayDevice.DeviceInfo.SoftwareVersion', 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress', 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
      ...GenieAcsProvider.RX_POWER_PATHS];
    const projection = ['_id', '_lastInform', '_deviceId', ...paths].join(',');
    const r = await fetch(`${this.base}/devices?projection=${encodeURIComponent(projection)}&limit=500`, { headers: this.headers(), signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`GenieACS ${r.status}`);
    const rows: any[] = await r.json();
    return rows.map((d) => {
      const v = (p: string) => p.split('.').reduce((o: any, k) => o?.[k], d)?._value;
      const last = d._lastInform ? new Date(d._lastInform) : null;
      return {
        id: String(d._id), manufacturer: d._deviceId?._Manufacturer ?? null, model: d._deviceId?._ProductClass ?? null, serial: d._deviceId?._SerialNumber ?? null,
        firmware: v(paths[0]) ?? null, last_inform: last ? last.toISOString() : null, online: !!last && Date.now() - last.getTime() < this.onlineWindowMs,
        rx_power_dbm: this.rxPower(v), wifi_ssid: v(paths[1]) ?? null, ip: v(paths[2]) || v(paths[3]) || null,
      };
    });
  }

  /** The GenieACS task for a Care Plan action. The Wi-Fi password only ever travels inside this task: it is never written to our database. */
  private actionTask(action: string, params: Record<string, any> = {}) {
    return action === 'reboot' ? { name: 'reboot' } :
      action === 'factory_reset' ? { name: 'factoryReset' } :
      action === 'refresh' ? { name: 'refreshObject', objectName: '' } :
      { name: 'setParameterValues', parameterValues: [
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', params.ssid, 'xsd:string'],
        ...(params.password ? [['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase', params.password, 'xsd:string']] : []),
      ] };
  }

  /**
   * Hands a command to GenieACS and returns within a few seconds. If the modem answers the connection request the command has already run (executed);
   * otherwise GenieACS keeps it queued (taskId) and the modem takes it at its next check-in, usually within a minute. Throws if GenieACS cannot be reached.
   */
  async queueAction(deviceId: string, action: string, params: Record<string, any> = {}): Promise<{ executed: boolean; taskId: string | null }> {
    if (this.isMock) return { executed: true, taskId: null };
    const r = await this.nbi(`/devices/${encodeURIComponent(deviceId)}/tasks?connection_request&timeout=4000`, { method: 'POST', body: JSON.stringify(this.actionTask(action, params)), ms: 10_000 });
    if (r.status === 202) return { executed: false, taskId: ((await r.json().catch(() => null)) as any)?._id ?? null };
    return { executed: true, taskId: null };
  }
  /** True while GenieACS still holds the task (the modem has not collected it). */
  isTaskQueued(id: string) { return this.isQueued(id); }
  /** Takes a queued task back (best effort), so a command that was given up on never runs later by surprise. */
  async cancelTask(id: string) { await this.withdraw([id]); }
  /** The newest fault GenieACS recorded for the modem (a task the modem refused), or null. */
  async deviceFault(deviceId: string): Promise<{ code: string; message: string; at: Date } | null> {
    if (this.isMock) return null;
    const r = await this.nbi(`/faults?query=${encodeURIComponent(JSON.stringify({ device: deviceId }))}`, { ms: 8_000 });
    const rows: any[] = await r.json();
    const f = rows.sort((x, y) => String(y.timestamp).localeCompare(String(x.timestamp)))[0];
    return f ? { code: String(f.code ?? ''), message: String(f.message ?? 'The modem refused the command'), at: new Date(f.timestamp) } : null;
  }
  /** When GenieACS last saw the modem boot (a reboot is confirmed by this moving forward). */
  async lastBoot(deviceId: string): Promise<Date | null> {
    if (this.isMock) return new Date();
    const r = await this.nbi(`/devices?query=${encodeURIComponent(JSON.stringify({ _id: deviceId }))}&projection=_lastBoot`, { ms: 8_000 });
    const t = ((await r.json()) as any[])[0]?._lastBoot;
    return t ? new Date(t) : null;
  }

  async runAction(deviceId: string, action: string, params: Record<string, any> = {}): Promise<ActionResult> {
    if (this.isMock) return { ok: true };
    const task = this.actionTask(action, params);
    try {
      const r = await fetch(`${this.base}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, { method: 'POST', headers: this.headers(), body: JSON.stringify(task), signal: AbortSignal.timeout(15_000) });
      return r.ok ? { ok: true } : { ok: false, error: `GenieACS ${r.status}` };
    } catch (e: any) { this.logger.error(e?.message); return { ok: false, error: e?.name === 'TimeoutError' ? 'The modem did not answer in time' : 'GenieACS unreachable' }; }
  }

  /** The modem's own line test (TR-143): it downloads a test file and we time it. Mock mode returns invented numbers, flagged simulated. */
  async speedTest(deviceId: string): Promise<SpeedResult> {
    if (this.isMock) {
      const h = this.seed(deviceId + Date.now());
      return { download_mbps: 40 + (h % 400) / 2, upload_mbps: 20 + (h % 200) / 2, ping_ms: 4 + (h % 30), simulated: true };
    }
    const url = this.cfg.get<string>('SPEEDTEST_FILE_URL') || 'http://speedtest.tele2.net/10MB.zip';   // plain http: most modems cannot do https for this
    const host = this.cfg.get<string>('SPEEDTEST_PING_HOST') || '8.8.8.8';
    const dl = await this.runDiagnostic(deviceId, 'DownloadDiagnostics', [['DownloadURL', url, 'xsd:string']], 'Completed');
    const bytes = Number(dl.TestBytesReceived?._value ?? dl.TotalBytesReceived?._value);
    const secs = GenieAcsProvider.elapsedSeconds(dl.BOMTime?._value, dl.EOMTime?._value);
    if (!(bytes > 0) || secs == null || !(secs > 0)) throw new Error('The modem finished but did not report a usable result');
    const download_mbps = Math.round((bytes * 8) / secs / 1e6 * 100) / 100;
    let ping_ms: number | null = null;   // a failed ping never fails the whole test
    try {
      const pg = await this.runDiagnostic(deviceId, 'IPPingDiagnostics', [['Host', host, 'xsd:string'], ['NumberOfRepetitions', 4, 'xsd:unsignedInt'], ['Timeout', 2000, 'xsd:unsignedInt']], 'Complete');
      const avg = Number(pg.AverageResponseTime?._value);
      if (Number(pg.SuccessCount?._value) > 0 && Number.isFinite(avg)) ping_ms = avg;
    } catch (e: any) { this.logger.warn(`ping diagnostic failed: ${e?.message}`); }
    return { download_mbps, upload_mbps: null, ping_ms, simulated: false };   // upload needs a server that accepts a PUT from the modem; not offered yet
  }

  /** Seconds between two TR-143 timestamps (ISO 8601, up to microseconds). null when either is missing or unset. */
  static elapsedSeconds(from?: string, to?: string): number | null {
    const us = (t?: string) => {
      const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d:?\d\d)?$/.exec(String(t ?? '').trim());
      if (!m) return null;
      const base = Date.parse(m[1] + (m[3] && m[3] !== 'Z' ? (m[3].includes(':') ? m[3] : m[3].slice(0, 3) + ':' + m[3].slice(3)) : 'Z'));
      return Number.isNaN(base) || base < 0 ? null : base * 1000 + Number((m[2] ?? '').padEnd(6, '0') || 0);
    };
    const a = us(from), b = us(to);
    return a == null || b == null || b <= a ? null : (b - a) / 1e6;
  }

  private async nbi(path: string, init: RequestInit & { ms?: number } = {}) {
    const r = await fetch(`${this.base}${path}`, { ...init, headers: this.headers(), signal: AbortSignal.timeout(init.ms ?? 30_000) });
    if (!r.ok) throw new Error(`GenieACS ${r.status}`);
    return r;
  }
  /** Sends a task and returns its id when GenieACS only queued it (the modem did not answer in time), so the caller can withdraw it. */
  private async task(deviceId: string, body: object, ms = 25_000): Promise<string | null> {
    const r = await this.nbi(`/devices/${encodeURIComponent(deviceId)}/tasks?connection_request&timeout=${ms - 3000}`, { method: 'POST', body: JSON.stringify(body), ms });
    if (r.status !== 202) return null;
    const t: any = await r.json().catch(() => null);
    return t?._id ?? null;
  }
  private async withdraw(ids: string[]) {   // best effort: never leave a queued download or refresh behind to run later on the customer's modem
    await Promise.all(ids.map((id) => this.nbi(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE', ms: 10_000 }).catch(() => undefined)));
  }
  /** True while GenieACS still holds the task (the modem has not collected it). A failed look counts as still queued, so we never pile up refreshes. */
  private async isQueued(id: string): Promise<boolean> {
    try { const r = await this.nbi(`/tasks?query=${encodeURIComponent(JSON.stringify({ _id: id }))}&projection=_id`, { ms: 8_000 }); return ((await r.json()) as any[]).length > 0; } catch { return true; }
  }
  private async readObject(deviceId: string, path: string): Promise<any> {
    const r = await this.nbi(`/devices?query=${encodeURIComponent(JSON.stringify({ _id: deviceId }))}&projection=${encodeURIComponent(path)}`, { ms: 10_000 });
    return path.split('.').reduce((o: any, k) => o?.[k], (await r.json())[0]) ?? {};
  }
  /** Sets the TR-143 parameters, asks the modem to start (DiagnosticsState=Requested), then waits for it to report `done`. Throws on an Error_* state or a timeout. */
  private async runDiagnostic(deviceId: string, name: 'DownloadDiagnostics' | 'IPPingDiagnostics', params: [string, string | number, string][], done: string): Promise<any> {
    const root = `InternetGatewayDevice.${name}`;
    const queued: string[] = [];   // tasks GenieACS could only queue; withdrawn if the test does not finish
    let refreshId: string | null = null, polls = 0;   // refreshId = a refresh GenieACS has queued but the modem has not collected yet
    try {
      const prior = await this.readObject(deviceId, root).catch(() => ({}));
      const before = prior?.BOMTime?._value;
      const stateAt = (o: any) => { const t = Date.parse(o?.DiagnosticsState?._timestamp ?? ''); return Number.isNaN(t) ? 0 : t; };
      const priorAt = stateAt(prior);   // an Error left by an earlier run keeps this timestamp until the modem reports again: it is not the answer to THIS request
      const set = await this.task(deviceId, { name: 'setParameterValues', parameterValues: [...params.map(([k, v, t]) => [`${root}.${k}`, v, t]), [`${root}.DiagnosticsState`, 'Requested', 'xsd:string']] });
      if (set) queued.push(set);
      const gap = Number(this.cfg.get('SPEEDTEST_POLL_MS') ?? 3000), deadline = Date.now() + Number(this.cfg.get('SPEEDTEST_MAX_MS') ?? 120_000);   // the modem only checks in about once a minute: task, download and a later refresh each wait for one
      do {
        await new Promise((r) => setTimeout(r, gap));
        // this modem does not push its result: it has to be asked for it. A refresh queued before the download ends reads zeros, so once the modem has collected one (the task leaves the queue) another is asked for, every 5th look
        if (refreshId && !(await this.isQueued(refreshId))) refreshId = null;
        if (!refreshId && polls++ % 5 === 4) {
          const id = await this.task(deviceId, { name: 'refreshObject', objectName: root }, 12_000).catch(() => null);
          if (id) { queued.push(id); refreshId = id; }
        }
        const o = await this.readObject(deviceId, root);
        const state = o.DiagnosticsState?._value;
        if (typeof state === 'string' && state.startsWith('Error') && (!priorAt || stateAt(o) > priorAt)) throw new Error(`The modem reported ${state}`);   // stale Error from a previous run: keep waiting for the modem's new report
        if (state === done && (name !== 'DownloadDiagnostics' || o.BOMTime?._value !== before || !before)) return o;
      } while (Date.now() < deadline);
      throw new Error('The modem did not finish the test in time');
    } catch (e) {
      await this.withdraw(queued);
      throw e;
    }
  }
}
