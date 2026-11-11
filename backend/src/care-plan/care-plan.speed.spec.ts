import { BadGatewayException, BadRequestException, ConflictException } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';

const admin: any = { id: 1, role: 'admin' };
const record = (over: any = {}) => ({ id: 7, is_active: true, genieacs_device_id: 'A-M-S1', serial_number: 'S1', lead: { ref_code: 'CB7', customer_name: 'Asha', pincode: '452001' }, ...over });
function make(opts: { rec?: any; mock?: boolean; test?: jest.Mock } = {}) {
  const create = jest.fn().mockImplementation(async ({ data }) => ({ id: 1, ...data }));
  const prisma: any = { carePlanDevice: { findFirst: jest.fn().mockResolvedValue(opts.rec ?? record()) }, speedTest: { create } };
  const acs: any = { isMock: !!opts.mock, speedTest: opts.test ?? jest.fn().mockResolvedValue({ download_mbps: 42.5, upload_mbps: null, ping_ms: 18, simulated: false }) };
  return { c: new CarePlanController(prisma, acs, {} as any), create, acs };
}

describe('POST /care-plan/devices/:id/speed-test', () => {
  it('saves the real result, with no upload figure, and says it is not simulated', async () => {
    const { c, create, acs } = make();
    const r = await c.speed(7, admin);
    expect(acs.speedTest).toHaveBeenCalledWith('A-M-S1');
    expect(create).toHaveBeenCalledWith({ data: { care_plan_device_id: 7, download_mbps: 42.5, upload_mbps: null, ping_ms: 18 } });
    expect(r).toMatchObject({ download_mbps: 42.5, simulated: false });
  });
  it('flags invented numbers as simulated in mock mode', async () => {
    const { c } = make({ mock: true, rec: record({ genieacs_device_id: null }), test: jest.fn().mockResolvedValue({ download_mbps: 80, upload_mbps: 40, ping_ms: 9, simulated: true }) });
    expect((await c.speed(7, admin)).simulated).toBe(true);
  });
  it('refuses a modem that is not linked to GenieACS yet (real mode)', async () => {
    await expect(make({ rec: record({ genieacs_device_id: null }) }).c.speed(7, admin)).rejects.toThrow(BadRequestException);
  });
  it('turns a modem failure into a clear 502 and saves nothing', async () => {
    const { c, create } = make({ test: jest.fn().mockRejectedValue(new Error('The modem did not finish the test in time')) });
    await expect(c.speed(7, admin)).rejects.toThrow(BadGatewayException);
    await expect(c.speed(7, admin)).rejects.toThrow(/did not finish/);
    expect(create).not.toHaveBeenCalled();
  });
  it('never runs two tests on the same modem at once', async () => {
    let release!: (v: any) => void;
    const { c } = make({ test: jest.fn().mockImplementation(() => new Promise((r) => { release = r; })) });
    const first = c.speed(7, admin);
    await new Promise((r) => setImmediate(r));
    await expect(c.speed(7, admin)).rejects.toThrow(ConflictException);
    release({ download_mbps: 1, upload_mbps: null, ping_ms: null, simulated: false }); await first;
  });
});
