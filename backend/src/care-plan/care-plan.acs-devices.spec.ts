import { ServiceUnavailableException } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';

const listed = (id: string, serial: string | null) => ({ id, manufacturer: 'Realtek', model: 'SY', serial, firmware: null, last_inform: null, online: true, rx_power_dbm: -15, wifi_ssid: null, ip: null });
function make(devices: any[], linked: any[], opts: { fail?: boolean; mock?: boolean } = {}) {
  const acs: any = { isMock: !!opts.mock, listDevices: opts.fail ? jest.fn().mockRejectedValue(new Error('down')) : jest.fn().mockResolvedValue(devices) };
  const prisma: any = { carePlanDevice: { findMany: jest.fn().mockResolvedValue(linked) } };
  return new CarePlanController(prisma, acs, {} as any, {} as any);
}

describe('GET /care-plan/acs-devices', () => {
  it('marks modems that are linked by GenieACS id or by serial, and leaves the others unlinked', async () => {
    const c = make([listed('A', 'S1'), listed('B', 'S2'), listed('C', 'S3')], [
      { genieacs_device_id: 'A', serial_number: null, lead: { ref_code: 'CB1', customer_name: 'Asha' } },
      { genieacs_device_id: null, serial_number: 'S2', lead: { ref_code: 'CB2', customer_name: 'Ravi' } }]);
    const r = await c.acsDevices();
    expect(r.total).toBe(3);
    expect(r.items.map((x: any) => x.linked_to?.customer_name ?? null)).toEqual(['Asha', 'Ravi', null]);
  });
  it('says so when GenieACS cannot be reached', async () => {
    await expect(make([], [], { fail: true }).acsDevices()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('reports mock mode', async () => { expect((await make([], [], { mock: true }).acsDevices()).mock).toBe(true); });
});
