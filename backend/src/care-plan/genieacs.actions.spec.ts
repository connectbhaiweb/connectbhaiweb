import { GenieAcsProvider } from './genieacs.provider';

const cfg = { get: (k: string) => ({ GENIEACS_NBI_URL: 'http://acs.test:7557' } as any)[k] ?? '' } as any;
const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });
const reply = (status: number, body: any) => ({ ok: status < 400, status, json: async () => body });

describe('GenieAcsProvider modem commands', () => {
  it('queueAction: a 202 means GenieACS only queued it, and gives the task id to follow', async () => {
    const f = jest.fn().mockResolvedValue(reply(202, { _id: 'T1' })); global.fetch = f as any;
    expect(await new GenieAcsProvider(cfg).queueAction('A-M-S1', 'reboot')).toEqual({ executed: false, taskId: 'T1' });
    expect(f.mock.calls[0][0]).toContain('/devices/A-M-S1/tasks?connection_request&timeout=4000');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ name: 'reboot' });
  });
  it('queueAction: a 200 means the modem answered and ran it at once', async () => {
    global.fetch = jest.fn().mockResolvedValue(reply(200, {})) as any;
    expect(await new GenieAcsProvider(cfg).queueAction('A-M-S1', 'change_wifi', { ssid: 'Home', password: 'pw123456' })).toEqual({ executed: true, taskId: null });
  });
  it('queueAction: sets SSID and passphrase in one task', async () => {
    const f = jest.fn().mockResolvedValue(reply(200, {})); global.fetch = f as any;
    await new GenieAcsProvider(cfg).queueAction('A', 'change_wifi', { ssid: 'Home', password: 'pw123456' });
    expect(JSON.parse(f.mock.calls[0][1].body).parameterValues.map((p: any) => p[1])).toEqual(['Home', 'pw123456']);
  });
  it('queueAction throws when GenieACS cannot be reached or refuses', async () => {
    global.fetch = jest.fn().mockResolvedValue(reply(401, {})) as any;
    await expect(new GenieAcsProvider(cfg).queueAction('A', 'reboot')).rejects.toThrow('GenieACS 401');
  });
  it('deviceFault returns the newest fault, or null', async () => {
    global.fetch = jest.fn().mockResolvedValue(reply(200, [{ code: 'a', message: 'old', timestamp: '2026-11-12T08:00:00Z' }, { code: 'b', message: 'new', timestamp: '2026-11-12T09:00:00Z' }])) as any;
    expect((await new GenieAcsProvider(cfg).deviceFault('A'))?.message).toBe('new');
    global.fetch = jest.fn().mockResolvedValue(reply(200, [])) as any;
    expect(await new GenieAcsProvider(cfg).deviceFault('A')).toBeNull();
  });
  it('lastBoot reads the modem boot time', async () => {
    global.fetch = jest.fn().mockResolvedValue(reply(200, [{ _id: 'A', _lastBoot: '2026-11-12T09:03:00.000Z' }])) as any;
    expect((await new GenieAcsProvider(cfg).lastBoot('A'))?.toISOString()).toBe('2026-11-12T09:03:00.000Z');
  });
});
