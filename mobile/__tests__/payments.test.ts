import { checkoutPrefill } from '../src/lib/api/checkout';
import { checkoutErrorMessage } from '../src/lib/checkoutError';
import { apiUser, fakeApi, loggedIn } from '../test-utils/fakeApi';

const charge = (status: string) => ({ id: 4, status, total_amount: '590.00', base_amount: '500', description: 'Fee' });
const order = (mock: boolean) => ({ mock, key_id: 'rzp_test_x', order_id: 'order_1', amount: 59000, currency: 'INR' });

test('a plan payment is priced by the server: the app sends only the request id', async () => {
  const s = await loggedIn('customer', () => charge('pending'));
  await s.API.customerPay({ lead_id: '5' });
  expect(s.calls).toEqual([expect.objectContaining({ path: '/charges/customer', body: { lead_id: 5 } })]);
});

test('mock gateway only when the server says mock', async () => {
  const s = await loggedIn('tip', (c) => (c.path === '/charges/4/pay' ? order(true) : charge('paid')));
  expect((await s.API.payCharge('4')).status).toBe('paid');
  expect(s.calls.map((c) => c.path)).toEqual(['/charges/4/pay', '/charges/4/mock-pay', '/charges/4']);
});

test('Razorpay: the server order opens the window and the server verifies the result', async () => {
  const seen: any[] = [];
  const s = await loggedIn('tip', (c) => (c.path === '/charges/4/pay' ? order(false) : charge('paid')), {
    checkout: async (o) => {
      seen.push(o);
      return { razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' };
    },
  });
  await s.API.payCharge('4');
  expect(seen[0]).toMatchObject({ key: 'rzp_test_x', order_id: 'order_1', amount: 59000, name: 'Connect Bhai', prefill: { contact: '+919000000042' } });
  expect(seen[0]).not.toHaveProperty('secret');
  expect(s.calls[1]).toMatchObject({ path: '/charges/4/verify', body: { razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' } });
});

test('a cancelled window verifies nothing', async () => {
  const s = await loggedIn('tip', () => order(false), {
    checkout: async () => {
      throw new Error('Payment was cancelled.');
    },
  });
  await expect(s.API.payCharge('4')).rejects.toThrow('Payment was cancelled.');
  expect(s.calls.map((c) => c.path)).toEqual(['/charges/4/pay']);
});

test('a new TIP pays the registration fee with the payment token and is logged in', async () => {
  const s = fakeApi((c) => {
    if (c.path === '/partners/register') return { user: apiUser('tip'), charge: charge('pending'), payment_token: 'tok' };
    if (c.path === '/charges/4/pay') return order(false);
    return { ...charge('paid'), session: { access_token: 'a', refresh_token: 'r', user: apiUser('tip') } };
  });
  const done = await s.API.applyPartner({ type: 'tip', name: 'T', phone: '9000000099', address: 'a', pincode: '452010', city_id: '1', aadhaar: '1', pan: 'P', bank_name: 'b', bank_account: '1', bank_ifsc: 'I', pincodes: '452010, 452016' });
  expect(s.calls[0].body).toMatchObject({ role: 'tip', city_id: 1, service_pincodes: ['452010', '452016'] });
  await s.API.payPublicCharge(done.charge!.id, 'razorpay', { name: 'T', phone: '9000000099' });
  expect(s.calls[1]).toMatchObject({ path: '/charges/4/pay', body: { payment_token: 'tok' } });
  expect(s.calls[1].auth).toBeUndefined();
  expect(s.calls[2].body).toMatchObject({ payment_token: 'tok', razorpay_payment_id: 'pay_1' });
  expect(s.API.me()).toMatchObject({ role: 'tip' });
});

test('Care plan fee, offline payment and admin actions', async () => {
  const s = await loggedIn('admin', (c) => {
    if (c.path === '/charges/care-plan') return charge('pending');
    if (c.path === '/leads/5') return { tip: { name: 'T', phone: '9100000001' } };
    if (c.path === '/charges/4/pay') return order(true);
    return charge('paid');
  });
  await s.API.carePlanCharge('5');
  expect(s.calls[0]).toMatchObject({ path: '/charges/care-plan', body: { lead_ids: [5] } });
  s.calls.length = 0;
  await s.API.markLeadPaid('5', ' cash ');
  await expect(s.API.adminSetCharge('4', 'paid_offline', '')).rejects.toThrow('Enter the payment reference.');
  await s.API.adminSetCharge('4', 'waived');
  await s.API.adminCreateCharge({ payer_type: 'partner', partner_id: '3', kind: 'platform_fee', description: ' x ', base: '10' });
  expect(s.calls.map((c) => [c.path, c.body])).toEqual([
    ['/leads/5/payment/offline', { reference: 'cash' }],
    ['/charges/4/waive', {}],
    ['/charges', { payer_user_id: 3, kind: 'tip_install_fee', description: 'x', base_amount: 10 }],
  ]);
});

test('a DSA pays nothing: the app never asks for charges', async () => {
  const s = await loggedIn('dsa', () => ({}));
  expect(await s.API.myCharges()).toEqual([]);
  expect((await s.API.pageCharges()).items).toEqual([]);
  expect(s.calls).toHaveLength(0);
});

test('uploads are signed by the server, checked, then sent straight to the file server', async () => {
  const sent: string[] = [];
  const s = fakeApi(() => ({ allowed_formats: 'jpg,pdf', max_bytes: 5 * 1048576, upload_url: 'http://files', api_key: 'k', timestamp: 1, signature: 's', folder: 'f', type: 'private' }), {
    upload: (async (url: string) => {
      sent.push(url);
      return { ok: true, json: async () => ({ public_id: 'p', version: 1, signature: 's', format: 'jpg', resource_type: 'image', bytes: 10 }) };
    }) as unknown as typeof fetch,
  });
  await expect(s.API.uploadFile({ uri: 'u', name: 'a.gif', size: 1, type: 'image/gif' }, 'aadhaar')).rejects.toThrow('Allowed file types: JPG, PDF.');
  await expect(s.API.uploadFile({ uri: 'u', name: 'a.pdf', size: 6 * 1048576, type: 'application/pdf' }, 'aadhaar')).rejects.toThrow('a.pdf is too large (maximum 5 MB).');
  expect(await s.API.uploadFile({ uri: 'u', name: 'a.jpg', size: 10, type: 'image/jpeg' }, 'aadhaar')).toMatchObject({ public_id: 'p' });
  expect(sent).toEqual(['http://files']);
});

test.each([
  [{ code: 0, description: 'undefined' }, 'Payment was cancelled.'],
  [{ code: 2, description: JSON.stringify({ error: { reason: 'payment_cancelled' } }) }, 'Payment was cancelled.'],
  [{ code: 1, description: 'Card declined by bank.' }, 'Card declined by bank.'],
  [{}, 'Payment failed. Please try again.'],
])('checkout error %j', (error, message) => {
  expect(checkoutErrorMessage(error)).toBe(message);
});

test('prefill needs a 10-digit phone and drops a bad email', () => {
  expect(checkoutPrefill({ phone: '12' })).toEqual({});
  expect(checkoutPrefill({ name: ' A ', phone: '+91 90000 00042', email: 'nope' })).toEqual({ prefill: { name: 'A', contact: '+919000000042' } });
});
