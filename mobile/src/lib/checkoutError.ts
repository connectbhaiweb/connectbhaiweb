/* The Razorpay app SDK reports failures as { code, description }. The description is plain text or a JSON
   string holding { error: { description, reason } }. This turns both into the website's messages.

   Seen on Android with test keys: when the customer closes the window (with or without a declined attempt
   first), it sends code 0 and the description text "undefined". The website says "Payment was cancelled."
   when its window is closed, so the app does the same. iOS still has to be checked. */
export function checkoutErrorMessage(error: unknown): string {
  const { code, description: text } = (error || {}) as { code?: unknown; description?: unknown };
  const raw = String(text ?? '');
  let description = raw;
  let reason = '';
  try {
    const parsed = JSON.parse(raw);
    description = parsed?.error?.description || '';
    reason = parsed?.error?.reason || '';
  } catch {
    /* plain text */
  }
  if (description === 'undefined') description = '';
  if (reason === 'payment_cancelled' || /cancell?ed/i.test(description) || (code === 0 && !description)) return 'Payment was cancelled.';
  return description || 'Payment failed. Please try again.';
}
