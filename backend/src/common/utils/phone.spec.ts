import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([['9876543210', '9876543210'], ['+91 98765 43210', '9876543210'], ['919876543210', '9876543210'], ['09876543210', '9876543210'], ['98765-43210', '9876543210']])('%s -> %s', (i, o) => expect(normalizePhone(i)).toBe(o));
  it.each(['12345', '5876543210', '', 'abcdefghij', '98765432101234'])('rejects %s', (i) => expect(normalizePhone(i)).toBeNull());
});
