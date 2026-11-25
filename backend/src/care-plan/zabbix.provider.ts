import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ZabbixOnu { serial: string; online: boolean | null; checked_at: Date | null; hostid: string; name: string }
/** An ONU with the details of the OLT it hangs on, for the admin's Zabbix list. */
export interface ZabbixListedOnu extends ZabbixOnu { olt: string | null; zone: string | null; partner: string | null }

type Tag = { tag: string; value: string };
type Item = { hostid: string; key_: string; name?: string; lastvalue: string; lastclock: string; tags?: Tag[] };
type Host = { hostid: string; name: string; tags?: Tag[] };

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
  private cache: { at: number; value: Promise<ZabbixOnu[]> } | null = null;
  constructor(private cfg: ConfigService) {}

  get isConfigured() { return !!(this.cfg.get<string>('ZABBIX_API_URL') && this.cfg.get<string>('ZABBIX_API_TOKEN')); }

  /** Serial numbers are compared without spaces around them and ignoring case. */
  static key(serial: string) { return serial.trim().toUpperCase(); }

  /** Every ONU, with or without a serial number. Kept for 30 s (a failure too, so a dead server is not asked on every page). */
  private all(): Promise<ZabbixOnu[]> {
    if (!this.isConfigured) return Promise.resolve([]);
    if (this.cache && Date.now() - this.cache.at < ZabbixProvider.CACHE_MS) return this.cache.value;
    const value = this.load();
    value.catch(() => undefined);   // the caller handles the error; this only stops an "unhandled rejection" for the cached copy
    this.cache = { at: Date.now(), value };
    return value;
  }

  /** Every ONU that has a serial number, by `key(serial)`. */
  async onus(): Promise<Map<string, ZabbixOnu>> {
    const out = new Map<string, ZabbixOnu>();
    for (const o of await this.all()) {
      // the same serial on two ports (an ONU that was moved): the port that is up wins
      if (o.serial && out.get(ZabbixProvider.key(o.serial))?.online !== true) out.set(ZabbixProvider.key(o.serial), o);
    }
    return out;
  }

  async find(serial: string) { return (await this.onus()).get(ZabbixProvider.key(serial)) ?? null; }

  /** The admin's list: every ONU once (those without a serial too), with its OLT name and the OLT's `zone` and `partner` tags. */
  async list(): Promise<ZabbixListedOnu[]> {
    const rows = [...(await this.onus()).values(), ...(await this.all()).filter((o) => !o.serial)];
    if (!rows.length) return [];
    const hosts: Host[] = await this.call('host.get', { output: ['hostid', 'name'], selectTags: 'extend', hostids: [...new Set(rows.map((o) => o.hostid))] });
    const byId = new Map(hosts.map((h) => [h.hostid, h]));
    return rows
      .map((o) => {
        const h = byId.get(o.hostid), tag = (name: string) => h?.tags?.find((t) => t.tag === name)?.value ?? null;
        return { ...o, olt: h?.name ?? null, zone: tag('zone'), partner: tag('partner') };
      })
      .sort((x, y) => `${x.olt} ${x.name}`.localeCompare(`${y.olt} ${y.name}`, 'en', { numeric: true }));
  }

  /** One read-only Zabbix API call. */
  private async call(method: 'item.get' | 'host.get', params: object): Promise<any[]> {
    const r = await fetch(this.cfg.get<string>('ZABBIX_API_URL')!, {
      method: 'POST',
      headers: { 'content-type': 'application/json-rpc', authorization: `Bearer ${this.cfg.get<string>('ZABBIX_API_TOKEN')}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`Zabbix ${r.status}`);
    const body: any = await r.json();
    if (body.error || !Array.isArray(body.result)) throw new Error(`Zabbix: ${body.error?.message ?? 'unexpected answer'}`);
    return body.result;
  }

  private async load() {
    return this.read(await this.call('item.get', { output: ['hostid', 'key_', 'name', 'lastvalue', 'lastclock'], selectTags: 'extend', monitored: true, search: { key_: ['onu.serial[', 'onu.status['] }, searchByAny: true, startSearch: true }));
  }

  private read(items: Item[]) {
    const tagOf = (i: Item, name: string) => i.tags?.find((t) => t.tag === name)?.value;
    const slot = (i: Item) => {
      const pon = tagOf(i, 'pon'), onu = tagOf(i, 'onu_id');
      return pon && onu ? `${i.hostid}/${pon}/${onu}` : null;
    };
    const status = new Map(items.filter((i) => i.key_.startsWith('onu.status[')).map((i) => [slot(i), i]));
    const out: ZabbixOnu[] = [];
    for (const i of items) {
      const at = slot(i), serial = (i.lastvalue ?? '').trim();
      if (!i.key_.startsWith('onu.serial[') || !at) continue;
      const s = status.get(at);
      const checked = s && Number(s.lastclock) ? new Date(Number(s.lastclock) * 1000) : null;
      const online = !checked ? null : s!.lastvalue === '1' ? true : ['2', '6', '7'].includes(s!.lastvalue) ? false : null;
      // Zabbix names the port "ONU 1/4 (<serial>) Serial": the part before the bracket is the ONU's name
      const name = i.name?.replace(/\s*\(.*$/, '').trim() || `ONU ${tagOf(i, 'pon')}/${tagOf(i, 'onu_id')}`;
      out.push({ serial, online, checked_at: checked, hostid: i.hostid, name });
    }
    return out;
  }
}
