import { ConflictException } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';

const admin: any = { id: 1, role: 'admin' };
const record = { id: 7, is_active: true, online: true, genieacs_device_id: 'A-M-S1', serial_number: 'S1', lead: { ref_code: 'CB7', customer_name: 'Asha', pincode: '452001' } };
function make(opts: { queue?: any; open?: any } = {}) {
  const update = jest.fn().mockImplementation(async ({ data }) => ({ id: 1, ...data }));
  const prisma: any = {
    carePlanDevice: { findFirst: jest.fn().mockResolvedValue(record) },
    deviceAction: { findFirst: jest.fn().mockResolvedValue(opts.open ?? null), create: jest.fn().mockImplementation(async ({ data }) => ({ id: 1, ...data })), update, findUnique: jest.fn().mockResolvedValue({ id: 1, status: 'sent' }) },
  };
  const acs: any = { isMock: false, queueAction: opts.queue ?? jest.fn().mockResolvedValue({ executed: false, taskId: 'T1' }) };
  const jobs: any = { enqueue: jest.fn().mockResolvedValue(undefined) };
  return { c: new CarePlanController(prisma, acs, {} as any, jobs), prisma, acs, jobs, update };
}

describe('POST /care-plan/devices/:id/actions (modem commands run in the background)', () => {
  it('queues the command with GenieACS, marks it sent and starts the background job; it does not wait for the modem', async () => {
    const { c, acs, jobs, update } = make();
    await c.action(7, { action: 'reboot' } as any, admin);
    expect(acs.queueAction).toHaveBeenCalledWith('A-M-S1', 'reboot', undefined);
    expect(update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 'sent' } });
    expect(jobs.enqueue).toHaveBeenCalledWith('deviceaction', { action_id: '1', task_id: 'T1' }, { maxAttempts: 1 });
  });
  it('a Wi-Fi change stores the new name but never the password, and the job payload has no password either', async () => {
    const { c, prisma, jobs } = make();
    await c.action(7, { action: 'change_wifi', params: { ssid: 'MyHome', password: 'SuperSecret123' } } as any, admin);
    expect(JSON.stringify(prisma.deviceAction.create.mock.calls[0][0])).not.toContain('SuperSecret123');
    expect(JSON.stringify(jobs.enqueue.mock.calls[0])).not.toContain('SuperSecret123');
  });
  it('a non-restart command the modem ran at once is done straight away, with no job', async () => {
    const { c, jobs, update } = make({ queue: jest.fn().mockResolvedValue({ executed: true, taskId: null }) });
    await c.action(7, { action: 'change_wifi', params: { ssid: 'MyHome' } } as any, admin);
    expect(update.mock.calls[0][0].data.status).toBe('done');
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });
  it('a restart the modem ran at once still waits for the modem to boot again (job started)', async () => {
    const { c, jobs } = make({ queue: jest.fn().mockResolvedValue({ executed: true, taskId: null }) });
    await c.action(7, { action: 'reboot' } as any, admin);
    expect(jobs.enqueue).toHaveBeenCalledWith('deviceaction', { action_id: '1', task_id: null }, { maxAttempts: 1 });
  });
  it('records a failure when GenieACS cannot be reached', async () => {
    const { c, jobs, update } = make({ queue: jest.fn().mockRejectedValue(new Error('down')) });
    await c.action(7, { action: 'reboot' } as any, admin);
    expect(update.mock.calls[0][0].data).toMatchObject({ status: 'failed', error: 'GenieACS could not be reached' });
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });
  it('refuses a second command of the same kind while one still waits for the modem', async () => {
    const { c, acs } = make({ open: { id: 9 } });
    await expect(c.action(7, { action: 'reboot' } as any, admin)).rejects.toThrow(ConflictException);
    expect(acs.queueAction).not.toHaveBeenCalled();
  });
});
