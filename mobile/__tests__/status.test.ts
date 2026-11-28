import { BOOK_NEXT, LEAD_NEXT } from '../src/lib/api/base';
import { leadStatusQuery, mapBooking, mapCharge, mapDevice, mapLead } from '../src/lib/api/mappers';
import { loggedIn } from '../test-utils/fakeApi';

const lead = (over: Record<string, unknown> = {}) => ({ id: 5, ref_code: 'CB-000005', customer_name: 'Asha', customer_phone: '9000000042', pincode: '452010', status: 'new', ...over });

test.each([
  ['new', {}, 'new'],
  ['new', { brought_by_user_id: 23 }, 'assigned'],
  ['new', { tip_user_id: 3 }, 'assigned'],
  ['contacted', {}, 'contacted'],
  ['followup', {}, 'follow_up'],
  ['scheduled', {}, 'booked'],
  ['installed', {}, 'installed'],
  ['lost', {}, 'lost'],
  ['cancelled', {}, 'lost'],
])('server status %s %j shows as %s', (status, extra, shown) => {
  expect(mapLead(lead({ status, ...extra })).status).toBe(shown);
});

test('screen status filters become the server query', () => {
  expect(leadStatusQuery('new')).toEqual({ status: 'new', unassigned: 1 });
  expect(leadStatusQuery('assigned')).toEqual({ status: 'new', assigned: 1 });
  expect(leadStatusQuery('booked')).toEqual({ status: 'scheduled' });
  expect(leadStatusQuery('follow_up')).toEqual({ status: 'followup' });
});

test('booking, charge and device statuses', () => {
  expect(mapBooking({ id: 1, lead_id: 5, status: 'completed' }).status).toBe('installed');
  expect(mapBooking({ id: 1, lead_id: 5, status: 'rescheduled' }).status).toBe('scheduled');
  expect(mapCharge({ id: 1, status: 'pending', total_amount: '118' })).toMatchObject({ status: 'due', amount: 118, ref_code: 'CH-000001' });
  expect(mapDevice({ id: 1, lead_id: 5, online: null }).state).toBe('unknown');
  expect(mapDevice({ id: 1, lead_id: 5, online: false, source: 'zabbix', serial_number: 'ABC' })).toMatchObject({ state: 'offline', status_only: true, serial: 'ABC' });
});

test('the latest booking and the paid plan payment travel with the lead', () => {
  const l = mapLead(lead({ status: 'scheduled', telephone_no: '0731', order_no: 'A-1', bookings: [{ id: 9, status: 'scheduled', scheduled_at: '2026-12-01T12:30:00Z' }], charges: [{ id: 4, total_amount: '471', pay_mode: 'offline' }] }));
  expect(l.booking).toMatchObject({ id: '9', status: 'scheduled', scheduled_date: '2026-12-01' });
  expect(l.payment).toMatchObject({ amount: 471, via: 'offline' });
  expect(l).toMatchObject({ telephone_no: '0731', order_no: 'A-1' });
});

test('next steps follow the website', () => {
  expect(LEAD_NEXT.assigned).toEqual(['contacted', 'follow_up', 'lost']);
  expect(BOOK_NEXT.scheduled).toEqual(['installed', 'cancelled']);
});

test('lead timeline notes are readable', async () => {
  const s = await loggedIn('customer', (c) => (c.path.endsWith('/events') ? [{ id: 1, lead_id: 5, event_type: 'assigned', note: 'dsa_user_id=23', to_status: 'new' }] : lead()));
  expect((await s.API.leadDetail('5')).events[0]).toMatchObject({ to_status: 'assigned', note: 'Agent assigned' });
});
