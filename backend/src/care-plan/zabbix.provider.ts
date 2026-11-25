import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ZabbixOnu { serial: string; online: boolean | null; checked_at: Date | null }

type Item = { hostid: string; key_: string; lastvalue: string; lastclock: string; tags?: { tag: string; value: string }[] };

/**
 * Zabbix gateway for ONUs that have no TR-069 (so GenieACS never hears from them). Read-only, and status only.
 * The OLT host carries two items per ONU, tied together by the tags `pon` and `onu_id`:
 *   onu.serial[..]  the ONU serial number (how a customer is matched)
 *   onu.status[..]  SNMP ifOperStatus: 1 = up, 2 = down
 * The status is shown as Zabbix has it, however old its last reading is; "unknown" only when Zabbix has no up / down value.
 * With ZABBIX_API_URL or ZABBIX_API_TOKEN empty it is switched off and nothing changes.
 */
@Injectable()
export class ZabbixProvider {
  private static readonly CACHE_MS = 30_000;
  private cache: { at: number; value: Promise<Map<string, ZabbixOnu>> } | null = null;
  constructor(private cfg: ConfigService) {}

  get isConfigured() { return !!(this.cfg.get<string>('ZABBIX_API_URL') && this.cfg.get<string>('ZABBIX_API_TOKEN')); }

  /** Serial numbers are compared without spaces around them and ignoring case. */
  static key(serial: string) { return serial.trim().toUpperCase(); }

  /** Every ONU with a serial number, by `key(serial)`. Kept for 30 s (a failure too, so a dead server is not asked on every page). */
  onus(): Promise<Map<string, ZabbixOnu>> {
    if (!this.isConfigured) return Promise.resolve(new Map());
    if (this.cache && Date.now() - this.cache.at < ZabbixProvider.CACHE_MS) return this.cache.value;
    const value = this.load();
    value.catch(() => undefined);   // the caller handles the error; this only stops an "unhandled rejection" for the cached copy
    this.cache = { at: Date.now(), value };
    return value;
  }

  async find(serial: string) { return (await this.onus()).get(ZabbixProvider.key(serial)) ?? null; }

  private async load() {
    const r = await fetch(this.cfg.get<string>('ZABBIX_API_URL')!, {
      method: 'POST',
      headers: { 'content-type': 'application/json-rpc', authorization: `Bearer ${this.cfg.get<string>('ZABBIX_API_TOKEN')}` },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'item.get',
        params: { output: ['hostid', 'key_', 'lastvalue', 'lastclock'], selectTags: 'extend', monitored: true, search: { key_: ['onu.serial[', 'onu.status['] }, searchByAny: true, startSearch: true },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`Zabbix ${r.status}`);
    const body: any = await r.json();
    if (body.error || !Array.isArray(body.result)) throw new Error(`Zabbix: ${body.error?.message ?? 'unexpected answer'}`);
    return this.read(body.result);
  }

  private read(items: Item[]) {
    const slot = (i: Item) => {
      const tag = (name: string) => i.tags?.find((t) => t.tag === name)?.value;
      const pon = tag('pon'), onu = tag('onu_id');
      return pon && onu ? `${i.hostid}/${pon}/${onu}` : null;
    };
    const status = new Map(items.filter((i) => i.key_.startsWith('onu.status[')).map((i) => [slot(i), i]));
    const out = new Map<string, ZabbixOnu>();
    for (const i of items) {
      const at = slot(i), serial = (i.lastvalue ?? '').trim();
      if (!i.key_.startsWith('onu.serial[') || !at || !serial) continue;
      const s = status.get(at);
      const checked = s && Number(s.lastclock) ? new Date(Number(s.lastclock) * 1000) : null;
      const online = !checked ? null : s!.lastvalue === '1' ? true : ['2', '6', '7'].includes(s!.lastvalue) ? false : null;
      // the same serial on two ports (an ONU that was moved): the port that is up wins
      if (out.get(ZabbixProvider.key(serial))?.online !== true) out.set(ZabbixProvider.key(serial), { serial, online, checked_at: checked });
    }
    return out;
  }
}
