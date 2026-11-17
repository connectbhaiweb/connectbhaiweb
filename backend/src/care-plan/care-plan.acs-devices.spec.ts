import { ServiceUnavailableException } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';

const listed = (id: string, serial: string | null) => ({ id, manufacturer: 'Realtek', model: 'SY', serial, firmware: null, last_inform: null, online: true, rx_power_dbm: -15, wifi_ssid: null, ip: null });
function make(devices: any[], linked: any[], bookings: any[] = [], opts: { fail?: boolean; mock?: boolean } = {}) {
  const acs: any = { isMock: !!opts.mock, listDevices: opts.fail ? jest.fn().mockRejectedValue(new Error('down')) : jest.fn().mockResolvedValue(devices) };
  const prisma: any = { carePlanDevice: { findMany: jest.fn().mockResolvedValue(linked) }, booking: { findMany: jest.fn().mockResolvedValue(bookings) } };
  return new CarePlanController(prisma, acs, {} as any, {} as any);
}

describe('GET /care-plan/acs-devices', () => {
  it('marks modems that are linked by GenieACS id or by serial, and leaves the others unlinked', async () => {
    const c = make([listed('A', 'S1'), listed('B', 'S2'), listed('C', 'S3')], [
      { genieacs_device_id: 'A', serial_number: null, is_active: true, lead: { id: 1, ref_code: 'CB1', customer_name: 'Asha', care_plan: true } },
      { genieacs_device_id: null, serial_number: 'S2', is_active: true, lead: { id: 2, ref_code: 'CB2', customer_name: 'Ravi', care_plan: false } }]);
    const r = await c.acsDevices();
    expect(r.total).toBe(3);
    expect(r.items.map((x: any) => x.linked_to?.customer_name ?? null)).toEqual(['Asha', 'Ravi', null]);
  });
  it('shows whether Care Plan is active, and matches a modem to the serial typed on a booking', async () => {
    const c = make([listed('A', 'S1'), listed('C', 'S3')], [{ genieacs_device_id: 'A', serial_number: null, is_active: true, lead: { id: 1, ref_code: 'CB1', customer_name: 'Asha', care_plan: false } }],
      [{ router_serial: 'S3', lead: { id: 9, ref_code: 'CB9', customer_name: 'Nilesh', care_plan: false } }]);
    const r = await c.acsDevices();
    expect(r.items.map((x: any) => [x.linked_to?.id, x.linked_to?.care_plan_active])).toEqual([[1, false], [9, false]]);
  });
  it('says so when GenieACS cannot be reached', async () => {
    await expect(make([], [], [], { fail: true }).acsDevices()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('reports mock mode', async () => { expect((await make([], [], [], { mock: true }).acsDevices()).mock).toBe(true); });
});
