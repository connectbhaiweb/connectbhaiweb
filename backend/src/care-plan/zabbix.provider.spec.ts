import { ZabbixProvider } from './zabbix.provider';

const secs = (msAgo = 0) => String(Math.floor((Date.now() - msAgo) / 1000));
const tags = (pon: string, onu: string) => [{ tag: 'pon', value: pon }, { tag: 'onu_id', value: onu }, { tag: 'component', value: 'onu' }];
const serial = (onu: string, value: string, hostid = '1') => ({ hostid, key_: `onu.serial[1.${onu}]`, lastvalue: value, lastclock: secs(), tags: tags('1', onu) });
const status = (onu: string, value: string, msAgo = 0, hostid = '1') => ({ hostid, key_: `onu.status[${Number(onu) + 4}]`, lastvalue: value, lastclock: secs(msAgo), tags: tags('1', onu) });

const env = { ZABBIX_API_URL: 'http://zabbix.test/api_jsonrpc.php', ZABBIX_API_TOKEN: 'test-token' };
const make = (values: Record<string, string> = env) => new ZabbixProvider({ get: (k: string) => values[k] } as any);
let fetchMock: jest.SpyInstance;
const answer = (body: unknown, ok = true) => { fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok, status: ok ? 200 : 502, json: async () => body } as any); };
afterEach(() => jest.restoreAllMocks());

describe('ZabbixProvider', () => {
  it('is off without both settings, and then never calls anything', async () => {
    answer({ result: [] });
    for (const v of [{}, { ZABBIX_API_URL: env.ZABBIX_API_URL }, { ZABBIX_API_TOKEN: 'x' }]) {
      const z = make(v as any);
      expect(z.isConfigured).toBe(false);
      expect((await z.onus()).size).toBe(0);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only reads (item.get), sending the token as a Bearer header', async () => {
    answer({ result: [] });
    await make().onus();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(env.ZABBIX_API_URL);
    expect(init.headers.authorization).toBe('Bearer test-token');
    expect(JSON.parse(init.body).method).toBe('item.get');
    expect(init.body).not.toContain('test-token');
  });

  it('pairs each serial with the status of the same PON port: 1 is online, 2 is offline', async () => {
    answer({ result: [serial('2', 'GPON00000002'), status('3', '2'), serial('3', 'GPON00000003'), status('2', '1')] });
    const onus = await make().onus();
    expect(onus.get('GPON00000002')!.online).toBe(true);
    expect(onus.get('GPON00000003')!.online).toBe(false);
  });

  it('does not mix up the same port number on two OLTs', async () => {
    answer({ result: [serial('1', 'AAA', '1'), status('1', '1', 0, '1'), serial('1', 'BBB', '2'), status('1', '2', 0, '2')] });
    const onus = await make().onus();
    expect([onus.get('AAA')!.online, onus.get('BBB')!.online]).toEqual([true, false]);
  });

  it('shows the status Zabbix has, however old the reading is', async () => {
    answer({ result: [serial('1', 'OLD1'), status('1', '1', 5 * 3600_000), serial('2', 'OLD2'), status('2', '2', 20 * 3600_000)] });
    const onus = await make().onus();
    expect(['OLD1', 'OLD2'].map((s) => onus.get(s)!.online)).toEqual([true, false]);
  });

  it('reports "unknown" only when Zabbix has no up or down value', async () => {
    const neverRead = { ...status('2', '0'), lastclock: '0' };
    answer({ result: [serial('1', 'NONE'), serial('2', 'NEVER'), neverRead, serial('4', 'ODD'), status('4', '4')] });
    const onus = await make().onus();
    expect(['NONE', 'NEVER', 'ODD'].map((s) => onus.get(s)!.online)).toEqual([null, null, null]);
  });

  it('skips ONUs that have no serial number', async () => {
    answer({ result: [serial('1', ''), status('1', '2')] });
    expect((await make().onus()).size).toBe(0);
  });

  it('finds a serial whatever its case or surrounding spaces', async () => {
    answer({ result: [serial('1', 'GPON00abc'), status('1', '1')] });
    const z = make();
    expect((await z.find('  gpon00ABC '))!.online).toBe(true);
    expect(await z.find('nothing')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);   // answered from the 30 s copy
  });

  it('keeps the port that is up when a serial shows on two ports', async () => {
    answer({ result: [serial('1', 'MOVED'), status('1', '1'), serial('2', 'MOVED'), status('2', '2')] });
    expect((await make().find('MOVED'))!.online).toBe(true);
  });

  it('throws on an HTTP error or a Zabbix error, and does not ask again at once', async () => {
    answer({}, false);
    const z = make();
    await expect(z.onus()).rejects.toThrow('Zabbix 502');
    await expect(z.onus()).rejects.toThrow('Zabbix 502');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    answer({ error: { message: 'Not authorised.' } });
    await expect(make().onus()).rejects.toThrow('Not authorised');
  });
});
