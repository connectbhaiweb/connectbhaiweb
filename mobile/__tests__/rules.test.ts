import { cityOptions } from '../src/features/home/cities';
import { ctaFor, filterPlans, isRecommended, planBig, startFilters } from '../src/features/home/planText';
import { normPhone, phoneError } from '../src/lib/forms';
import { pickPin, pinMatches, pinRows } from '../src/lib/pins';
import { mapPlan } from '../src/lib/api/mappers';

const plan = (id: number, name: string, price: number, speed: number, brand: string) => mapPlan({ id, name, price, speed_mbps: speed, ott_apps: id === 2 ? ['Hotstar'] : [], category: { id, name: brand, type: 'fiber' } });
const plans = [plan(1, 'A', 500, 30, 'Jio'), plan(2, 'B', 900, 200, 'BSNL'), plan(3, 'C', 700, 100, 'Airtel')];

test('phone numbers are cleaned and checked like the website', () => {
  expect(['+91 90000-00042', '919000000042', '09000000042', '00919000000042'].map(normPhone)).toEqual(Array(4).fill('9000000042'));
  expect(phoneError('')).toBe('Enter your 10-digit mobile number.');
  expect(phoneError('12345')).toBe('Enter a 10-digit mobile number without the country code.');
  expect(phoneError('5000000000')).toBe('Indian mobile numbers start with 6, 7, 8 or 9. Only +91 numbers are supported.');
  expect(phoneError('9000000042')).toBe('');
});

test('plan filters and sorting', () => {
  const f = startFilters(plans);
  expect(f).toMatchObject({ price: 900, sort: 'price' });
  expect(filterPlans(plans, f).map((p) => p.name)).toEqual(['A', 'C', 'B']);
  expect(filterPlans(plans, { ...f, sort: 'speed' }).map((p) => p.name)).toEqual(['B', 'C', 'A']);
  expect(filterPlans(plans, { ...f, sort: 'value' }).map((p) => p.name)).toEqual(['B', 'C', 'A']);
  expect(filterPlans(plans, { ...f, speed: 100, price: 800 }).map((p) => p.name)).toEqual(['C']);
  expect(filterPlans(plans, { ...f, ott: true }).map((p) => p.name)).toEqual(['B']);
  expect(plans.map(isRecommended)).toEqual([false, true, false]);
  expect(planBig(plans[0])).toEqual(['30', 'Mbps']);
  expect(ctaFor(plans[0])).toBe('Request connection');
});

test('PIN suggestions start at the 3rd digit and skip PINs already chosen', () => {
  const rows = pinRows([{ pin: '452010', area: 'Vijay Nagar', city: 'Indore' }, { pin: '452001', area: 'GPO Indore', city: 'Indore' }, { pin: 'x', area: 'bad', city: '' }]);
  expect(rows.map((r) => r.label)).toEqual(['GPO Indore', 'Vijay Nagar · Indore']);
  expect(pinMatches(rows, '45')).toBeNull();
  expect(pinMatches(rows, '452')).toHaveLength(2);
  expect(pinMatches(rows, '452010, 452', true)!.map((r) => r.pin)).toEqual(['452001']);
  expect(pickPin('452010, 452', '452001', true)).toBe('452010, 452001, ');
});

test('live cities come first in the city list', () => {
  const cities = [{ id: '2', name: 'Bhopal', district: 'Bhopal', tier: 2, status: 'soon' }, { id: '1', name: 'Indore', district: 'Indore', tier: 2, status: 'live' }];
  expect(cityOptions(cities).map((o) => [o.group, o.label])).toEqual([['Live now', 'Indore'], ['Launching soon', 'Bhopal · soon']]);
});
