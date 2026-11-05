import { calcGst } from './money';

describe('calcGst', () => {
  it('splits 18% into CGST+SGST for the home state (MP = 23)', () => {
    expect(calcGst(1000, 18, '23')).toEqual({ base_amount: 1000, gst_percent: 18, cgst_amount: 90, sgst_amount: 90, igst_amount: 0, total_amount: 1180 });
  });
  it('treats a payer with no GST state as home state', () => {
    const g = calcGst(500, 18, null);
    expect(g.igst_amount).toBe(0);
    expect(g.cgst_amount + g.sgst_amount).toBe(90);
  });
  it('charges IGST for another state', () => {
    expect(calcGst(1000, 18, '27')).toMatchObject({ cgst_amount: 0, sgst_amount: 0, igst_amount: 180, total_amount: 1180 });
  });
  it('rounds to paise and keeps cgst+sgst equal to the whole GST on odd amounts', () => {
    const g = calcGst(199, 18, '23'); // gst 35.82
    expect(g.cgst_amount + g.sgst_amount).toBeCloseTo(35.82, 2);
    expect(g.total_amount).toBe(234.82);
  });
  it('handles zero GST and zero base', () => {
    expect(calcGst(0, 18, '23').total_amount).toBe(0);
    expect(calcGst(100, 0, '23').total_amount).toBe(100);
  });
  it('respects a different home state', () => {
    expect(calcGst(100, 18, '23', '27').igst_amount).toBe(18);
  });
});
