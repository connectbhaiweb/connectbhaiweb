import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CarePlanSyncService, isZabbixOnu } from './care-plan-sync.service';
import { CarePlanController } from './care-plan.controller';
import { ZabbixProvider } from './zabbix.provider';

const admin: any = { id: 1, role: 'admin' };
const mark = (serial: string) => ({ source: 'zabbix', serial });
const dev = (id: number, serial: string | null, extra: any = {}) => ({ id: BigInt(id), genieacs_device_id: null, serial_number: serial, last_status: null, is_active: true, online: null, ...extra });
const genieStatus = { online: true, last_seen_at: new Date(), rx_power_dbm: -15, wifi_ssid: 'Home', connected_clients: 1, device_id: 'A-M-S' };
const notFound = () => jest.fn().mockRejectedValue(new Error('Device not found in GenieACS'));

function make(o: { mock?: boolean; onus?: Record<string, boolean | null>; down?: boolean; off?: boolean; fetch?: jest.Mock; devices?: any[] } = {}) {
  const onus = new Map(Object.entries(o.onus ?? {}).map(([serial, online]) => [ZabbixProvider.key(serial), { serial, online, checked_at: new Date() }]));
  const list = jest.fn(o.down ? async () => { throw new Error('Zabbix 502'); } : async () => onus);
  const zbx: any = { isConfigured: !o.off, onus: list, find: async (s: string) => (await list()).get(ZabbixProvider.key(s)) ?? null };
  const acs: any = { isMock: !!o.mock, fetchStatus: o.fetch ?? notFound(), queueAction: jest.fn(), listDevices: jest.fn().mockResolvedValue([]) };
  const devices = o.devices ?? [];
  const update = jest.fn().mockImplementation(async ({ where, data }) => ({ ...devices.find((d) => d.id === where.id), id: where.id, ...data, last_status: data.last_status === Prisma.DbNull ? null : data.last_status }));
  const prisma: any = {
    carePlanDevice: { findMany: jest.fn().mockResolvedValue(devices), findFirst: jest.fn().mockResolvedValue(devices[0]), count: jest.fn().mockResolvedValue(devices.length), update },
    speedTest: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() }, deviceAction: { findFirst: jest.fn(), create: jest.fn() }, booking: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const sync = new CarePlanSyncService(prisma, acs, { get: (k: string) => ({ APP_ENV: 'test' } as any)[k] } as any, zbx);
  return { sync, c: new CarePlanController(prisma, acs, sync, {} as any, zbx), prisma, acs, update, zbx };
}

describe('Care Plan: ONUs whose status comes from Zabbix', () => {
  it('saves only Online / Offline for a serial GenieACS does not know', async () => {
    const { sync, update } = make({ onus: { GPON1: false } });
    await sync.pollOne(dev(1, 'gpon1'));
    expect(update.mock.calls[0][0].data).toEqual({ online: false, rx_power_dbm: null, wifi_ssid: null, connected_clients: null, last_status: mark('gpon1') });
  });

  it('GenieACS wins when both know the serial, and a modem with a GenieACS id never goes to Zabbix', async () => {
    const both = make({ onus: { S: false }, fetch: jest.fn().mockResolvedValue(genieStatus) });
    expect(await both.sync.pollOne(dev(1, 'S'))).toMatchObject({ online: true, wifi_ssid: 'Home', genieacs_device_id: 'A-M-S' });
    const linked = make({ onus: { S: false } });
    await expect(linked.sync.pollOne(dev(1, 'S', { genieacs_device_id: 'A-M-S' }))).rejects.toThrow('GenieACS');
    expect(linked.zbx.onus).not.toHaveBeenCalled();
  });

  it('drops the Zabbix mark once GenieACS knows the modem', async () => {
    const { sync, update } = make({ fetch: jest.fn().mockResolvedValue(genieStatus) });
    await sync.pollOne(dev(1, 'S', { last_status: mark('S') }));
    expect(update.mock.calls[0][0].data.last_status).toBe(Prisma.DbNull);
  });

  it('keeps the saved status when Zabbix cannot be reached, even in mock mode', async () => {
    for (const mock of [true, false]) {
      const { sync, update } = make({ mock, down: true });
      await expect(sync.pollOne(dev(1, 'S', { last_status: mark('S') }))).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    }
  });

  it('a known Zabbix ONU that disappears becomes "unknown"; an unknown serial keeps the GenieACS error', async () => {
    const gone = make();
    await gone.sync.pollOne(dev(1, 'S', { last_status: mark('S') }));
    expect(gone.update.mock.calls[0][0].data.online).toBeNull();
    const never = make();
    await expect(never.sync.pollOne(dev(1, 'S'))).rejects.toThrow('Device not found in GenieACS');
    expect(never.update).not.toHaveBeenCalled();
  });

  it('forgets the mark when the serial is changed', () => {
    expect(isZabbixOnu(dev(1, 'NEW', { last_status: mark('OLD') }))).toBe(false);
    expect(isZabbixOnu(dev(1, 'S', { last_status: mark('S') }))).toBe(true);
  });

  it('changes nothing while Zabbix is not configured', async () => {
    const { sync, zbx, acs } = make({ off: true, mock: true, fetch: jest.fn().mockResolvedValue(genieStatus), devices: [dev(1, 'S')] });
    await sync.pollOne(dev(1, 'S'));
    expect(acs.fetchStatus).toHaveBeenCalledWith('S');
    expect(await sync.run()).toBeNull();
    expect(zbx.onus).not.toHaveBeenCalled();
  });

  it('the timer in mock mode saves Zabbix statuses and never invented ones', async () => {
    const { sync, update, acs } = make({ mock: true, onus: { Z: true }, devices: [dev(1, 'Z'), dev(2, 'MODEM'), dev(3, null, { genieacs_device_id: 'G' })] });
    expect(await sync.run()).toEqual({ polled: 1, ok: 1, failed: 0 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(acs.fetchStatus).not.toHaveBeenCalled();
  });

  it('the list marks a just-installed ONU as Zabbix, and leaves other modems alone', async () => {
    const { c } = make({ onus: { Z: true }, devices: [dev(1, 'Z'), dev(2, 'MODEM', { online: true })] });
    const r = await c.list({} as any, admin);
    expect(r.items.map((d: any) => [d.source, d.online])).toEqual([['zabbix', true], ['genieacs', true]]);
  });

  it('the list still loads when Zabbix is down', async () => {
    const { c } = make({ down: true, devices: [dev(1, 'Z')] });
    expect((await c.list({} as any, admin)).items).toHaveLength(1);
  });

  it('refuses every command and the speed test, without calling GenieACS', async () => {
    const { c, acs, prisma } = make({ onus: { Z: true }, devices: [dev(1, 'Z', { online: true, last_status: mark('Z') })] });
    for (const action of ['reboot', 'change_wifi', 'factory_reset', 'refresh']) {
      await expect(c.action(1, { action, params: { ssid: 'x' } } as any, admin)).rejects.toThrow(BadRequestException);
    }
    await expect(c.speed(1, admin)).rejects.toThrow(/Online \/ Offline only/);
    expect(acs.queueAction).not.toHaveBeenCalled();
    expect(prisma.deviceAction.create).not.toHaveBeenCalled(); expect(prisma.speedTest.create).not.toHaveBeenCalled();
  });

  it('refuses commands for a just-installed ONU too', async () => {
    const { c } = make({ onus: { Z: true }, devices: [dev(1, 'Z')] });
    await expect(c.action(1, { action: 'reboot' } as any, admin)).rejects.toThrow(/Online \/ Offline only/);
  });

  it('refresh still reads the status, and says it is from Zabbix', async () => {
    const { c } = make({ onus: { Z: false }, devices: [dev(1, 'Z', { last_status: mark('Z') })] });
    expect(await c.refresh(1, admin)).toMatchObject({ source: 'zabbix', online: false });
  });

  it('the admin list adds Zabbix ONUs, once each, linked by serial', async () => {
    const { c, acs, prisma } = make({ onus: { GPON1: true, GPON2: false, BOTH: true } });
    acs.listDevices.mockResolvedValue([{ id: 'A', serial: 'both', online: true }]);
    prisma.carePlanDevice.findMany.mockResolvedValue([{ genieacs_device_id: null, serial_number: 'gpon2', is_active: true, lead: { id: 2, ref_code: 'CB2', customer_name: 'Ravi', care_plan: true } }]);
    const r = await c.acsDevices();
    expect(r.items.map((d: any) => [d.serial, d.source ?? 'genieacs', d.linked_to?.customer_name ?? null])).toEqual([['both', 'genieacs', null], ['GPON1', 'zabbix', null], ['GPON2', 'zabbix', 'Ravi']]);
  });

  it('the admin list still shows GenieACS modems when Zabbix is down, and says so', async () => {
    const { c, acs } = make({ down: true });
    acs.listDevices.mockResolvedValue([{ id: 'A', serial: 'S', online: true }]);
    const r = await c.acsDevices();
    expect(r.total).toBe(1);
    expect(r.zabbix_error).toMatch(/Zabbix/);
  });

  it('a recognised ONU is no longer offered for linking', async () => {
    const lead = { ref_code: 'CB1', customer_name: 'Asha', customer_phone: '9811000001' };
    const { c } = make({ devices: [{ id: 1, serial_number: 'Z', last_status: mark('Z'), lead }, { id: 2, serial_number: null, last_status: null, lead }] });
    expect((await c.linkCandidates()).items).toEqual([{ id: 2, serial_number: null, lead }]);
  });
});
