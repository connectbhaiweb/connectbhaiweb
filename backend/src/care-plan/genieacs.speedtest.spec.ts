import { GenieAcsProvider } from './genieacs.provider';

const cfg = (extra: Record<string, any> = {}) => ({ get: (k: string) => ({ GENIEACS_NBI_URL: 'http://acs.test:7557', SPEEDTEST_POLL_MS: 0, SPEEDTEST_MAX_MS: 50, ...extra } as any)[k] ?? '' } as any);
const val = (v: any) => ({ _value: v });

/** A fake GenieACS: tasks are accepted; an object reads as empty until the test has been started on it (setParameterValues), then as whatever the test says it holds.
    `fresh: false` = the modem already holds an older result before the new run starts. */
function fakeAcs(objects: Record<string, () => any>, opts: { fresh?: boolean } = {}) {
  const calls: { url: string; body?: any }[] = [];
  const started = new Set<string>();
  const f = jest.fn(async (url: string, init: any = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), body });
    if (String(url).includes('/tasks')) {
      if (body?.name === 'setParameterValues') started.add(body.parameterValues[0][0].split('.')[1]);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    const m = /projection=([^&]+)/.exec(String(url));
    const path = decodeURIComponent(m![1]);                       // InternetGatewayDevice.<Object>
    const name = path.split('.')[1];
    const hold = opts.fresh === false || started.has(name);
    return { ok: true, status: 200, json: async () => [{ _id: 'X', InternetGatewayDevice: { [name]: hold ? objects[name]() : {} } }] };
  });
  global.fetch = f as any;
  return { calls };
}
const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

describe('GenieAcsProvider.speedTest (TR-143)', () => {
  it('mock mode: numbers are invented and flagged simulated', async () => {
    const r = await new GenieAcsProvider({ get: () => '' } as any).speedTest('dev-1');
    expect(r.simulated).toBe(true); expect(r.download_mbps).toBeGreaterThan(0);
  });

  it('times the download from the modem timestamps and reports ping', async () => {
    const { calls } = fakeAcs({
      DownloadDiagnostics: () => ({ DiagnosticsState: val('Completed'), BOMTime: val('2026-11-11T12:00:00.000000'), EOMTime: val('2026-11-11T12:00:01.000000'), TestBytesReceived: val(1_250_000) }),
      IPPingDiagnostics: () => ({ DiagnosticsState: val('Complete'), SuccessCount: val(4), AverageResponseTime: val(25) }),
    });
    const r = await new GenieAcsProvider(cfg()).speedTest('X');
    expect(r).toEqual({ download_mbps: 10, upload_mbps: null, ping_ms: 25, simulated: false });
    const set = calls.find((c) => c.body?.name === 'setParameterValues')!.body;
    expect(set.parameterValues).toEqual(expect.arrayContaining([
      ['InternetGatewayDevice.DownloadDiagnostics.DownloadURL', 'http://speedtest.tele2.net/10MB.zip', 'xsd:string'],
      ['InternetGatewayDevice.DownloadDiagnostics.DiagnosticsState', 'Requested', 'xsd:string']]));
  });

  it('uses the configured test file and ping host', async () => {
    const { calls } = fakeAcs({
      DownloadDiagnostics: () => ({ DiagnosticsState: val('Completed'), BOMTime: val('2026-11-11T12:00:00.5'), EOMTime: val('2026-11-11T12:00:01.5'), TotalBytesReceived: val(2_500_000) }),
      IPPingDiagnostics: () => ({ DiagnosticsState: val('Complete'), SuccessCount: val(1), AverageResponseTime: val(9) }),
    });
    await new GenieAcsProvider(cfg({ SPEEDTEST_FILE_URL: 'http://files.test/25MB.bin', SPEEDTEST_PING_HOST: '1.1.1.1' })).speedTest('X');
    const sets = calls.filter((c) => c.body?.name === 'setParameterValues').flatMap((c) => c.body.parameterValues);
    expect(sets).toEqual(expect.arrayContaining([['InternetGatewayDevice.DownloadDiagnostics.DownloadURL', 'http://files.test/25MB.bin', 'xsd:string'], ['InternetGatewayDevice.IPPingDiagnostics.Host', '1.1.1.1', 'xsd:string']]));
  });

  it('a failing ping does not fail the speed test', async () => {
    fakeAcs({
      DownloadDiagnostics: () => ({ DiagnosticsState: val('Completed'), BOMTime: val('2026-11-11T12:00:00'), EOMTime: val('2026-11-11T12:00:02'), TestBytesReceived: val(5_000_000) }),
      IPPingDiagnostics: () => ({ DiagnosticsState: val('Error_CannotResolveHostName') }),
    });
    const r = await new GenieAcsProvider(cfg()).speedTest('X');
    expect(r.download_mbps).toBe(20); expect(r.ping_ms).toBeNull();
  });

  it('throws the modem error', async () => {
    fakeAcs({ DownloadDiagnostics: () => ({ DiagnosticsState: val('Error_NoResponse') }), IPPingDiagnostics: () => ({}) });
    await expect(new GenieAcsProvider(cfg()).speedTest('X')).rejects.toThrow('Error_NoResponse');
  });

  it('times out when the modem never finishes', async () => {
    fakeAcs({ DownloadDiagnostics: () => ({ DiagnosticsState: val('Requested') }), IPPingDiagnostics: () => ({}) });
    await expect(new GenieAcsProvider(cfg({ SPEEDTEST_MAX_MS: 1 })).speedTest('X')).rejects.toThrow('did not finish');
  });

  it('ignores an old Completed result until the modem reports a new run', async () => {
    let polls = 0;
    fakeAcs({
      DownloadDiagnostics: () => (++polls <= 3
        ? { DiagnosticsState: val('Completed'), BOMTime: val('2026-11-10T09:00:00'), EOMTime: val('2026-11-10T09:00:01'), TestBytesReceived: val(1) }      // yesterday's run
        : { DiagnosticsState: val('Completed'), BOMTime: val('2026-11-11T12:00:00'), EOMTime: val('2026-11-11T12:00:01'), TestBytesReceived: val(1_250_000) }),
      IPPingDiagnostics: () => ({ DiagnosticsState: val('Complete'), SuccessCount: val(1), AverageResponseTime: val(5) }),
    }, { fresh: false });
    expect((await new GenieAcsProvider(cfg({ SPEEDTEST_MAX_MS: 5000 })).speedTest('X')).download_mbps).toBe(10);
  });

  it('refuses a result with no usable bytes or time', async () => {
    fakeAcs({ DownloadDiagnostics: () => ({ DiagnosticsState: val('Completed'), BOMTime: val('2026-11-11T12:00:00'), EOMTime: val('2026-11-11T12:00:00'), TestBytesReceived: val(0) }), IPPingDiagnostics: () => ({}) });
    await expect(new GenieAcsProvider(cfg()).speedTest('X')).rejects.toThrow('usable result');
  });
});

describe('GenieAcsProvider.elapsedSeconds', () => {
  it('keeps microseconds, handles time zones, and rejects unset or backwards times', () => {
    expect(GenieAcsProvider.elapsedSeconds('2026-11-11T12:00:00.250000', '2026-11-11T12:00:01.750000')).toBeCloseTo(1.5, 6);
    expect(GenieAcsProvider.elapsedSeconds('2026-11-11T12:00:00+05:30', '2026-11-11T12:00:02+05:30')).toBe(2);
    expect(GenieAcsProvider.elapsedSeconds('0001-01-01T00:00:00Z', '2026-11-11T12:00:00')).toBeNull();
    expect(GenieAcsProvider.elapsedSeconds('2026-11-11T12:00:05', '2026-11-11T12:00:01')).toBeNull();
    expect(GenieAcsProvider.elapsedSeconds(undefined, '2026-11-11T12:00:01')).toBeNull();
  });
});
