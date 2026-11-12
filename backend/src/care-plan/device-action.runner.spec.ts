import { DeviceActionRunner } from './device-action.runner';

const row = (over: any = {}) => ({ id: 1n, action: 'change_wifi', status: 'sent', created_at: new Date('2026-11-12T09:00:00Z'), device: { id: 7, genieacs_device_id: 'A-M-S1', serial_number: 'S1' }, ...over });
function make(found: any, acs: Record<string, any> = {}, cfg: Record<string, any> = {}) {
  const update = jest.fn().mockResolvedValue({});
  const prisma: any = { deviceAction: { findUnique: jest.fn().mockResolvedValue(found), update } };
  const jobs: any = { register: jest.fn() };
  const a: any = { isTaskQueued: jest.fn().mockResolvedValue(false), deviceFault: jest.fn().mockResolvedValue(null), cancelTask: jest.fn().mockResolvedValue(undefined), lastBoot: jest.fn().mockResolvedValue(new Date('2026-11-12T09:03:00Z')), ...acs };
  const config: any = { get: (k: string) => ({ DEVICE_ACTION_POLL_MS: 0, DEVICE_ACTION_MAX_MS: 30, DEVICE_ACTION_BOOT_MS: 30, ...cfg } as any)[k] };
  return { r: new DeviceActionRunner(prisma, a, jobs, config), update, jobs, acs: a };
}
const data = (u: jest.Mock) => u.mock.calls[0][0].data;

describe('DeviceActionRunner (follows a modem command in the background)', () => {
  it('registers with the job queue as "deviceaction"', () => { expect(make(row()).jobs.register).toHaveBeenCalledWith('deviceaction', expect.any(Function)); });

  it('marks a Wi-Fi change done once the modem has collected the task', async () => {
    const { r, update } = make(row());
    await r.run({ action_id: '1', task_id: 'T1' });
    expect(data(update)).toMatchObject({ status: 'done', error: null });
  });
  it('keeps waiting while the task is still queued, then finishes when the modem collects it', async () => {
    let n = 0;
    const { r, update, acs } = make(row(), { isTaskQueued: jest.fn().mockImplementation(async () => ++n < 4) }, { DEVICE_ACTION_MAX_MS: 5000 });
    await r.run({ action_id: '1', task_id: 'T1' });
    expect(acs.isTaskQueued).toHaveBeenCalledTimes(4);
    expect(data(update).status).toBe('done');
  });
  it('fails with the reason, and takes the command back, when the modem never checks in', async () => {
    const { r, update, acs } = make(row(), { isTaskQueued: jest.fn().mockResolvedValue(true) });
    await r.run({ action_id: '1', task_id: 'T1' });
    expect(acs.cancelTask).toHaveBeenCalledWith('T1');
    expect(data(update)).toMatchObject({ status: 'failed' });
    expect(data(update).error).toMatch(/did not check in/);
  });
  it('fails when GenieACS recorded a fault for the modem after the command was sent', async () => {
    const { r, update, acs } = make(row(), { isTaskQueued: jest.fn().mockResolvedValue(true), deviceFault: jest.fn().mockResolvedValue({ code: 'cwmp.9005', message: 'Invalid parameter name', at: new Date('2026-11-12T09:01:00Z') }) });
    await r.run({ action_id: '1', task_id: 'T1' });
    expect(acs.cancelTask).toHaveBeenCalledWith('T1');
    expect(data(update).error).toMatch(/refused the command: Invalid parameter name/);
  });
  it('a restart is done only after the modem boots again', async () => {
    const { r, update } = make(row({ action: 'reboot' }));
    await r.run({ action_id: '1', task_id: 'T1' });
    expect(data(update).status).toBe('done');
  });
  it('a restart that never comes back is reported failed', async () => {
    const { r, update } = make(row({ action: 'reboot' }), { lastBoot: jest.fn().mockResolvedValue(new Date('2026-11-12T08:00:00Z')) });
    await r.run({ action_id: '1', task_id: null });
    expect(data(update).error).toMatch(/not come back/);
  });
  it('does nothing for a command that already finished', async () => {
    const { r, update, acs } = make(row({ status: 'done' }));
    await r.run({ action_id: '1', task_id: 'T1' });
    expect(update).not.toHaveBeenCalled(); expect(acs.isTaskQueued).not.toHaveBeenCalled();
  });
});
