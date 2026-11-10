import { GenieAcsProvider } from './genieacs.provider';

const mock = new GenieAcsProvider({ get: () => '' } as any);
describe('GenieAcsProvider (mock mode)', () => {
  it('is mock without an NBI url', () => expect(mock.isMock).toBe(true));
  it('returns stable status for the same device', async () => {
    const a = await mock.fetchStatus('dev-1'); const b = await mock.fetchStatus('dev-1');
    expect(a.rx_power_dbm).toBe(b.rx_power_dbm);
    expect(a.rx_power_dbm).toBeLessThan(0);
    expect(a.connected_clients).toBeGreaterThan(0);
  });
  it('health reports mock mode without calling out', async () => {
    const h = await mock.health();
    expect(h.status).toBe('mock'); expect(h.mock).toBe(true);
  });
  it('runs actions and speed tests', async () => {
    expect((await mock.runAction('dev-1', 'reboot')).ok).toBe(true);
    const s = await mock.speedTest('dev-1');
    expect(s.download_mbps).toBeGreaterThan(0);
  });
});

describe('GenieAcsProvider.health (real NBI url)', () => {
  const live = () => new GenieAcsProvider({ get: (k: string) => ({ GENIEACS_NBI_URL: 'http://acs.test:7557' } as any)[k] ?? '' } as any);
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('is up when the NBI answers 200, and calls a cheap query', async () => {
    const f = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = f as any;
    const h = await live().health();
    expect(h.status).toBe('up'); expect(h.reachable).toBe(true); expect(h.latency_ms).toBeGreaterThanOrEqual(0);
    expect(String(f.mock.calls[0][0])).toContain('/devices?limit=1');
  });
  it('sends the token as a Bearer header', async () => {
    const f = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = f as any;
    await new GenieAcsProvider({ get: (k: string) => ({ GENIEACS_NBI_URL: 'http://acs.test', GENIEACS_API_TOKEN: 'tok123' } as any)[k] ?? '' } as any).health();
    expect(f.mock.calls[0][1].headers.authorization).toBe('Bearer tok123');
  });
  it('is down but reachable when credentials are rejected', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as any;
    const h = await live().health();
    expect(h.status).toBe('down'); expect(h.reachable).toBe(true); expect(h.detail).toMatch(/credentials/);
  });
  it('is down and unreachable when the connection fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;
    const h = await live().health();
    expect(h.status).toBe('down'); expect(h.reachable).toBe(false);
  });
  it('reports a timeout distinctly', async () => {
    const e: any = new Error('timed out'); e.name = 'TimeoutError';
    global.fetch = jest.fn().mockRejectedValue(e) as any;
    expect((await live().health()).detail).toMatch(/3s/);
  });
  it('caches for 10s so monitors cannot hammer the ACS', async () => {
    const f = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = f as any;
    const p = live(); await p.health(); await p.health();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
