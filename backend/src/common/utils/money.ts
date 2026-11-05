export interface GstSplit { base_amount: number; gst_percent: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * GST on a base amount. Payer in the home state (default 23 = Madhya Pradesh) pays CGST+SGST (half each);
 * any other state pays IGST. A payer with no GST state is treated as home state.
 */
export function calcGst(base: number, percent: number, payerStateCode?: string | null, homeStateCode = '23'): GstSplit {
  const b = r2(base);
  const gst = r2((b * percent) / 100);
  const inter = !!payerStateCode && payerStateCode !== homeStateCode;
  const half = r2(gst / 2);
  return {
    base_amount: b,
    gst_percent: percent,
    cgst_amount: inter ? 0 : half,
    sgst_amount: inter ? 0 : r2(gst - half),
    igst_amount: inter ? gst : 0,
    total_amount: r2(b + gst),
  };
}
