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
  it('runs actions and speed tests', async () => {
    expect((await mock.runAction('dev-1', 'reboot')).ok).toBe(true);
    const s = await mock.speedTest('dev-1');
    expect(s.download_mbps).toBeGreaterThan(0);
  });
});
