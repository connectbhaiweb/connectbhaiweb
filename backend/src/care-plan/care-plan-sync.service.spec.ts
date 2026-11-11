import { CarePlanSyncService } from './care-plan-sync.service';

const status = { online: true, last_seen_at: new Date(), rx_power_dbm: -15, wifi_ssid: 'Home', connected_clients: 1 };
function make(opts: { mock?: boolean; devices?: any[]; fetch?: jest.Mock } = {}) {
  const update = jest.fn().mockResolvedValue({});
  const findMany = jest.fn().mockResolvedValue(opts.devices ?? []);
  const acs: any = { isMock: !!opts.mock, fetchStatus: opts.fetch ?? jest.fn().mockResolvedValue(status) };
  const prisma: any = { carePlanDevice: { findMany, update } };
  const cfg: any = { get: (k: string) => ({ APP_ENV: 'test' } as any)[k] };
  return { svc: new CarePlanSyncService(prisma, acs, cfg), update, findMany, acs };
}
const dev = (id: number, gid: string | null, serial: string | null = null) => ({ id: BigInt(id), genieacs_device_id: gid, serial_number: serial });

describe('CarePlanSyncService', () => {
  it('saves the status of every linked modem', async () => {
    const { svc, update, acs } = make({ devices: [dev(1, 'A'), dev(2, null, 'SER2')] });
    const r = await svc.run();
    expect(r).toEqual({ polled: 2, ok: 2, failed: 0 });
    expect(acs.fetchStatus).toHaveBeenCalledWith('A'); expect(acs.fetchStatus).toHaveBeenCalledWith('SER2');
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][0].data).toMatchObject({ online: true, rx_power_dbm: -15, wifi_ssid: 'Home' });
  });
  it('one modem failing does not stop the others', async () => {
    const fetch = jest.fn().mockRejectedValueOnce(new Error('Device not found in GenieACS')).mockResolvedValue(status);
    const { svc, update } = make({ devices: [dev(1, 'A'), dev(2, 'B')], fetch });
    expect(await svc.run()).toEqual({ polled: 2, ok: 1, failed: 1 });
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('does nothing in mock mode, so invented numbers are never saved by the timer', async () => {
    const { svc, findMany, update } = make({ mock: true, devices: [dev(1, 'A')] });
    expect(await svc.run()).toBeNull(); expect(findMany).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
  it('never overlaps itself', async () => {
    let release!: () => void;
    const fetch = jest.fn().mockImplementation(() => new Promise((res) => { release = () => res(status); }));
    const { svc } = make({ devices: [dev(1, 'A')], fetch });
    const first = svc.run();
    await new Promise((r) => setImmediate(r));
    expect(await svc.run()).toBeNull();      // second call while the first is still reading
    release(); await first;
  });
  it('only asks for active Care Plan devices', async () => {
    const { svc, findMany } = make();
    await svc.pollAll();
    expect(findMany.mock.calls[0][0].where).toEqual({ is_active: true, lead: { care_plan: true } });
  });
});
