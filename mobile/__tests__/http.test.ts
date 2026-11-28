import { apiUser, fakeApi, reply } from '../test-utils/fakeApi';

const session = { access_token: 'a', refresh_token: 'r', user: apiUser('customer') };

test('password login posts the website body without a token and saves the session', async () => {
  const s = fakeApi(() => session);
  const me = await s.API.signInPassword('9000000042', 'x');
  expect(s.calls[0]).toMatchObject({ method: 'POST', path: '/auth/login', body: { phone: '9000000042', password: 'x' } });
  expect(s.calls[0].auth).toBeUndefined();
  expect(s.saved()).toEqual({ access_token: 'a', refresh_token: 'r' });
  expect(me).toMatchObject({ id: '7', role: 'customer', full_name: 'Asha' });
});

test('OTP login requests a code and verifies it', async () => {
  const s = fakeApi((c) => (c.path.endsWith('verify') ? session : {}));
  await s.API.sendOtp('9000000042', 'customer');
  await s.API.verifyOtp('9000000042', '123456', 'Asha', 'customer');
  expect(s.calls.map((c) => [c.path, c.body])).toEqual([
    ['/auth/otp/request', { phone: '9000000042', role: 'customer' }],
    ['/auth/otp/verify', { phone: '9000000042', code: '123456', name: 'Asha', role: 'customer' }],
  ]);
});

test('an expired token is refreshed once for requests that fail together', async () => {
  const s = fakeApi((c) => {
    if (c.path === '/auth/refresh') return { access_token: 'new', refresh_token: 'r2' };
    return c.auth === 'Bearer new' ? { ok: 1 } : reply(401, {});
  });
  s.put({ access_token: 'old', refresh_token: 'r' });
  await s.http.loadTokens();
  await Promise.all([s.http.get('/a'), s.http.get('/b')]);
  expect(s.calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
  expect(s.saved()).toEqual({ access_token: 'new', refresh_token: 'r2' });
});

test('a refused refresh logs the person out', async () => {
  let expired = false;
  const s = fakeApi((c) => (c.path === '/auth/login' ? session : expired ? reply(401, {}) : {}));
  await s.API.signInPassword('9000000042', 'x');
  expired = true;
  await expect(s.http.get('/notifications')).rejects.toThrow('Please log in again.');
  expect(s.API.me()).toBeNull();
  expect(s.saved()).toBeNull();
});

test('the website error messages', async () => {
  const list = fakeApi(() => reply(400, { message: ['name is required', 'pin is invalid'] }));
  await expect(list.http.get('/x')).rejects.toThrow('name is required · pin is invalid');
  await expect(fakeApi(() => reply(429, {})).http.get('/x')).rejects.toThrow('Too many attempts. Please wait a minute and try again.');
  await expect(fakeApi(() => reply(500, null)).http.get('/x')).rejects.toThrow('Something went wrong. Please try again.');
  const off = fakeApi(() => {
    throw new Error('offline');
  });
  await expect(off.http.get('/x')).rejects.toThrow('Cannot reach the Connect Bhai server. Check that the API is running.');
});

test('identical reads are shared until something is written; live data never is', async () => {
  const s = fakeApi(() => ({}));
  await Promise.all([s.http.get('/cities'), s.http.get('/cities'), s.http.get('/chat/threads'), s.http.get('/chat/threads')]);
  expect(s.calls.map((c) => c.path)).toEqual(['/cities', '/chat/threads', '/chat/threads']);
  await s.http.post('/waitlist', {});
  await s.http.get('/cities');
  expect(s.calls.filter((c) => c.path === '/cities')).toHaveLength(2);
});

test('starting without a network keeps the saved login', async () => {
  const s = fakeApi(() => {
    throw new Error('offline');
  });
  s.put({ access_token: 'a', refresh_token: 'r' });
  expect(await s.API.init()).toBeNull();
  expect(s.saved()).not.toBeNull();
});

test('delete account sends the phone number and logs out', async () => {
  const s = fakeApi((c) => (c.path === '/auth/login' ? session : {}));
  await s.API.signInPassword('9000000042', 'x');
  await s.API.deleteMyAccount();
  expect(s.calls[1]).toMatchObject({ method: 'DELETE', path: '/users/me', body: { phone: '9000000042' } });
  expect(s.saved()).toBeNull();
});
