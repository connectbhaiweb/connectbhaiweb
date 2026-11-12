import { ConflictException } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';

const admin: any = { id: 1, role: 'admin' };
function make(taken: any = null) {
  const findFirst = jest.fn().mockResolvedValueOnce({ id: 7, lead: { ref_code: 'CB7', customer_name: 'Asha', pincode: '452001' } }).mockResolvedValue(taken);   // 1st: the record being edited, then the "already used?" check
  const update = jest.fn().mockResolvedValue({ id: 7 });
  const findMany = jest.fn().mockResolvedValue([{ id: 7, serial_number: null, lead: { ref_code: 'CB7', customer_name: 'Asha', customer_phone: '9811000001' } }]);
  const prisma: any = { carePlanDevice: { findFirst, update, findMany } };
  return { c: new CarePlanController(prisma, {} as any, {} as any, {} as any), findFirst, update, findMany };
}

describe('Care Plan: linking a modem to a customer', () => {
  it('lists active records that have no modem yet', async () => {
    const { c, findMany } = make();
    const r = await c.linkCandidates();
    expect(r.items).toHaveLength(1);
    expect(findMany.mock.calls[0][0].where).toEqual({ genieacs_device_id: null, is_active: true });
  });
  it('links the modem when nobody else has it', async () => {
    const { c, update } = make(null);
    await c.update(7, { genieacs_device_id: 'A-M-S1', serial_number: 'S1', model: 'SY' } as any, admin);
    expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { genieacs_device_id: 'A-M-S1', serial_number: 'S1', model: 'SY' } });
  });
  it('refuses a modem that is already linked to another customer', async () => {
    const { c, update } = make({ lead: { ref_code: 'CB9' } });
    await expect(c.update(7, { genieacs_device_id: 'A-M-S1' } as any, admin)).rejects.toThrow(ConflictException);
    await expect(make({ lead: { ref_code: 'CB9' } }).c.update(7, { serial_number: 'S1' } as any, admin)).rejects.toThrow(/CB9/);
    expect(update).not.toHaveBeenCalled();
  });
});
