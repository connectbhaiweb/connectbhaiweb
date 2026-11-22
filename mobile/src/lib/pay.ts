import { api } from '@/lib/api';

type Order = { charge_id: number; order_id: string; amount: number; currency: string; key_id: string; mock?: boolean };
type Who = { name?: string | null; phone?: string | null };

/** Pays the plan price of a lead. The server prices it; the app only opens checkout. */
export async function payPlan(leadId: number, who: Who): Promise<void> {
  const charge = await api<{ id: number }>('POST', '/charges/customer', { lead_id: leadId });
  await payCharge(charge.id, who);
}

/** Pays any charge that already exists (a TIP's fee to Connect Bhai, or a customer's plan charge). */
export async function payCharge(id: number, who: Who, token?: string): Promise<void> {
  const body = token ? { payment_token: token } : {};   // a new TIP pays the registration fee before they can log in
  const opt = token ? { anon: true } : {};
  const o = await api<Order>('POST', `/charges/${id}/pay`, body, opt);
  if (o.mock) {
    await api('POST', `/charges/${id}/mock-pay`, body, opt);
    return;
  }
  let Checkout: { open: (opts: Record<string, unknown>) => Promise<{ razorpay_payment_id: string; razorpay_signature: string }> };
  try {
    Checkout = (await import('react-native-razorpay')).default as unknown as typeof Checkout;
  } catch {
    throw new Error('Payments are not available in this build.');
  }
  const digits = String(who.phone ?? '').replace(/\D/g, '').slice(-10);
  let res;
  try {
    res = await Checkout.open({
      key: o.key_id, order_id: o.order_id, amount: o.amount, currency: o.currency,
      name: 'Connect Bhai', description: 'Plan payment', theme: { color: '#1450E6' },
      ...(digits.length === 10 ? { prefill: { name: who.name ?? '', contact: `+91${digits}` } } : {}),
    });
  } catch (e) {
    const err = e as { description?: string; error?: { description?: string } };
    throw new Error(err.description || err.error?.description || 'Payment was cancelled.');
  }
  await api('POST', `/charges/${id}/verify`, { ...body, razorpay_payment_id: res.razorpay_payment_id, razorpay_signature: res.razorpay_signature }, opt);
}
