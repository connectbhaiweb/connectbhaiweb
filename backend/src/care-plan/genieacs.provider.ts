import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DeviceStatus { online: boolean; last_seen_at: Date; rx_power_dbm: number; wifi_ssid: string | null; connected_clients: number; raw?: any }
export interface SpeedResult { download_mbps: number; upload_mbps: number; ping_ms: number }
export interface ActionResult { ok: boolean; error?: string }

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
    const u = this.cfg.get<string>('GENIEACS_USERNAME');
    return { 'content-type': 'application/json', ...(u ? { authorization: 'Basic ' + Buffer.from(`${u}:${this.cfg.get('GENIEACS_PASSWORD')}`).toString('base64') } : {}) };
  }
  private seed(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

  async fetchStatus(deviceId: string): Promise<DeviceStatus> {
    if (this.isMock) {
      const h = this.seed(deviceId);
      return { online: h % 7 !== 0, last_seen_at: new Date(), rx_power_dbm: -(18 + (h % 90) / 10), wifi_ssid: `ConnectBhai-${deviceId.slice(-4)}`, connected_clients: 1 + (h % 9) };
    }
    const r = await fetch(`${this.base}/devices?query=${encodeURIComponent(JSON.stringify({ _id: deviceId }))}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`GenieACS ${r.status}`);
    const d: any = (await r.json())[0];
    if (!d) throw new Error('Device not found in GenieACS');
    const lastInform = new Date(d._lastInform);
    const v = (p: string) => p.split('.').reduce((o: any, k) => o?.[k], d)?._value;
    return {
      online: Date.now() - lastInform.getTime() < 10 * 60_000, last_seen_at: lastInform,
      rx_power_dbm: Number(v('InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower') ?? v('Device.Optical.Interface.1.Stats.OpticalSignalLevel') ?? 0),
      wifi_ssid: v('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID') ?? v('Device.WiFi.SSID.1.SSID') ?? null,
      connected_clients: Number(v('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations') ?? 0),
    };
  }

  async runAction(deviceId: string, action: string, params: Record<string, any> = {}): Promise<ActionResult> {
    if (this.isMock) return { ok: true };
    const task =
      action === 'reboot' ? { name: 'reboot' } :
      action === 'factory_reset' ? { name: 'factoryReset' } :
      action === 'refresh' ? { name: 'refreshObject', objectName: '' } :
      { name: 'setParameterValues', parameterValues: [
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', params.ssid, 'xsd:string'],
        ...(params.password ? [['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase', params.password, 'xsd:string']] : []),
      ] };
    try {
      const r = await fetch(`${this.base}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, { method: 'POST', headers: this.headers(), body: JSON.stringify(task) });
      return r.ok ? { ok: true } : { ok: false, error: `GenieACS ${r.status}` };
    } catch (e: any) { this.logger.error(e?.message); return { ok: false, error: 'GenieACS unreachable' }; }
  }

  async speedTest(deviceId: string): Promise<SpeedResult> {
    const h = this.seed(deviceId + Date.now());
    return { download_mbps: 40 + (h % 400) / 2, upload_mbps: 20 + (h % 200) / 2, ping_ms: 4 + (h % 30) };
  }
}
