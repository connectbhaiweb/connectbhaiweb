import { SpeedTestRunner } from './speed-test.runner';

const row = (over: any = {}) => ({ id: 1n, status: 'running', device: { id: 7, genieacs_device_id: 'A-M-S1', serial_number: 'S1' }, ...over });
function make(found: any, test: jest.Mock) {
  const update = jest.fn().mockResolvedValue({});
  const prisma: any = { speedTest: { findUnique: jest.fn().mockResolvedValue(found), update } };
  const jobs: any = { register: jest.fn() };
  return { r: new SpeedTestRunner(prisma, { speedTest: test } as any, jobs), update, jobs, test };
}

describe('SpeedTestRunner (the background job)', () => {
  it('registers itself with the job queue under the name "speedtest"', () => {
    expect(make(row(), jest.fn()).jobs.register).toHaveBeenCalledWith('speedtest', expect.any(Function));
  });
  it('writes the modem result to the row and marks it done', async () => {
    const { r, update, test } = make(row(), jest.fn().mockResolvedValue({ download_mbps: 42.5, upload_mbps: null, ping_ms: 12 }));
    await r.run({ speed_test_id: '1' });
    expect(test).toHaveBeenCalledWith('A-M-S1');
    expect(update).toHaveBeenCalledWith({ where: { id: 1n }, data: expect.objectContaining({ status: 'done', download_mbps: 42.5, ping_ms: 12, error: null }) });
  });
  it('records a failure as the result (status failed + reason) instead of throwing', async () => {
    const { r, update } = make(row(), jest.fn().mockRejectedValue(new Error('The modem did not finish the test in time')));
    await expect(r.run({ speed_test_id: '1' })).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith({ where: { id: 1n }, data: expect.objectContaining({ status: 'failed', error: 'The modem did not finish the test in time' }) });
  });
  it('does nothing for a test that already finished (a job handed back after a restart must not run twice)', async () => {
    const { r, update, test } = make(row({ status: 'done' }), jest.fn());
    await r.run({ speed_test_id: '1' });
    expect(test).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
});
