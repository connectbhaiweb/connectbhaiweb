/* The Razorpay window: what is sent to it and what comes back. The window itself is passed in (lib/razorpay.ts). */
export type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  theme: { color: string };
  prefill?: { name: string; contact: string; email?: string };
};
export type CheckoutResult = { razorpay_payment_id: string; razorpay_signature: string };
export type Checkout = (options: CheckoutOptions) => Promise<CheckoutResult>;
export type Payer = { name?: string; phone?: string; email?: string } | null | undefined;

/** Pre-fills the Razorpay window with who is paying, so it never asks for contact details. */
export function checkoutPrefill(who: Payer): Pick<CheckoutOptions, 'prefill'> {
  const digits = String(who?.phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return {};
  const email = String(who?.email || '').trim();
  return {
    prefill: {
      name: String(who?.name || '').trim(),
      contact: '+91' + digits,
      ...(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? { email } : {}),
    },
  };
}
