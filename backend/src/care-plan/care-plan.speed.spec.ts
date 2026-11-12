import { BadRequestException, ConflictException } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';

const admin: any = { id: 1, role: 'admin' };
const record = (over: any = {}) => ({ id: 7, is_active: true, genieacs_device_id: 'A-M-S1', serial_number: 'S1', lead: { ref_code: 'CB7', customer_name: 'Asha', pincode: '452001' }, ...over });
function make(opts: { rec?: any; mock?: boolean; running?: any } = {}) {
  const create = jest.fn().mockImplementation(async ({ data }) => ({ id: 1, ...data }));
  const prisma: any = {
    carePlanDevice: { findFirst: jest.fn().mockResolvedValue(opts.rec ?? record()) },
    speedTest: { create, updateMany: jest.fn().mockResolvedValue({ count: 0 }), findFirst: jest.fn().mockResolvedValue(opts.running ?? null), findUnique: jest.fn().mockResolvedValue({ id: 1, care_plan_device_id: 7, status: 'running' }) },
  };
  const jobs: any = { enqueue: jest.fn().mockResolvedValue(undefined) };
  return { c: new CarePlanController(prisma, { isMock: !!opts.mock } as any, {} as any, jobs), create, jobs, prisma };
}

describe('POST /care-plan/devices/:id/speed-test (runs in the background)', () => {
  it('answers at once with a running row and queues the background job; it does not wait for the modem', async () => {
    const { c, create, jobs } = make();
    const r: any = await c.speed(7, admin);
    expect(create).toHaveBeenCalledWith({ data: { care_plan_device_id: 7, status: 'running' } });
    expect(jobs.enqueue).toHaveBeenCalledWith('speedtest', { speed_test_id: '1' }, { maxAttempts: 1 });
    expect(r).toMatchObject({ status: 'running', simulated: false });
  });
  it('flags mock mode as simulated', async () => {
    expect(((await make({ mock: true, rec: record({ genieacs_device_id: null }) }).c.speed(7, admin)) as any).simulated).toBe(true);
  });
  it('refuses a modem that is not linked to GenieACS yet (real mode)', async () => {
    await expect(make({ rec: record({ genieacs_device_id: null }) }).c.speed(7, admin)).rejects.toThrow(BadRequestException);
  });
  it('never starts a second test while one is still running on that modem', async () => {
    const { c, create, jobs } = make({ running: { id: 5 } });
    await expect(c.speed(7, admin)).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled(); expect(jobs.enqueue).not.toHaveBeenCalled();
  });
  it('closes a test whose job died long ago as failed, so the next one can start', async () => {
    const { c, prisma } = make();
    await c.speed(7, admin);
    expect(prisma.speedTest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'failed', error: 'The test did not finish in time' } }));
  });
});
