/* The DSA-first lead flow: the calls each step makes (CLAUDE.md, "Lead flow"). */
import { fakeApi, loggedIn } from '../test-utils/fakeApi';

test('a website request becomes a lead for a DSA, with the plan or as a callback', async () => {
  const s = fakeApi(() => ({ id: 5, ref_code: 'CB-000005' }));
  await s.API.requestConnection({ name: ' Asha ', phone: '9000000042', pincode: '452010', plan_id: '3', area: 'Vijay Nagar', preferred_date: '2026-12-01' });
  await s.API.requestConnection({ name: 'Asha', phone: '9000000042', pincode: '452010' });
  expect(s.calls[0]).toMatchObject({ path: '/leads', body: { customer_name: 'Asha', plan_id: 3, source: 'website', notes: 'Preferred date: 2026-12-01 | Area: Vijay Nagar' } });
  expect(s.calls[1].body).toMatchObject({ source: 'callback' });
});

test('the DSA follows up and books', async () => {
  const s = await loggedIn('dsa', () => ({ id: 9 }));
  await expect(s.API.updateLeadStatus('5', 'follow_up')).rejects.toThrow('Choose a follow-up date.');
  await s.API.updateLeadStatus('5', 'follow_up', 'call later', '2099-01-02');
  expect(s.calls[0]).toMatchObject({ method: 'PATCH', path: '/leads/5/status', body: { status: 'followup', note: 'call later' } });
  await expect(s.API.createBooking('5', '')).rejects.toThrow('Choose a date.');
  await expect(s.API.createBooking('5', '2001-01-01')).rejects.toThrow('Choose today or a future date.');
  expect(await s.API.createBooking('5', '2099-01-02')).toBe('BK-000009');
  expect(s.calls[1]).toMatchObject({ method: 'POST', path: '/bookings', body: { lead_id: 5 } });
});

test('admin assigns a DSA; the TIP of a booked lead carries telephone and order numbers', async () => {
  const s = await loggedIn('admin', () => ({}));
  await s.API.assignLead('5', '23');
  await s.API.assignLead('5', null, '3', { telephone_no: '7312345', order_no: 'A-12' });
  expect(s.calls.map((c) => [c.method, c.path, c.body])).toEqual([
    ['PATCH', '/leads/5/assign', { dsa_user_id: 23 }],
    ['PATCH', '/leads/5/assign', { tip_user_id: 3, telephone_no: '7312345', order_no: 'A-12' }],
  ]);
});

test('the TIP installs: start, then complete with a connection reference', async () => {
  const s = await loggedIn('tip', () => ({}));
  await s.API.updateBookingStatus('9', 'in_progress');
  await expect(s.API.updateBookingStatus('9', 'installed', ' ')).rejects.toThrow('Enter the connection reference to mark as installed.');
  await s.API.updateBookingStatus('9', 'installed', 'C-1', 'abc123');
  expect(s.calls.map((c) => [c.path, c.body])).toEqual([
    ['/bookings/9/start', {}],
    ['/bookings/9/complete', { connection_id: 'C-1', router_serial: 'ABC123' }],
  ]);
});

test('role checks happen before any call', async () => {
  const s = await loggedIn('customer', () => ({}));
  await expect(s.API.assignLead('5', '23')).rejects.toThrow('You do not have access to this action.');
  await expect(s.API.adminLeads()).rejects.toThrow('You do not have access to this action.');
  expect(s.calls).toHaveLength(0);
});

test('long lists are read page by page', async () => {
  const s = await loggedIn('customer', (c) => ({ total: 150, items: [{ id: c.path.includes('page=2') ? 2 : 1, status: 'new' }] }));
  expect(await s.API.myLeads()).toHaveLength(2);
  expect(s.calls.map((c) => c.path)).toEqual(['/leads?page=1&limit=100', '/leads?page=2&limit=100']);
});
