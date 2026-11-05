import { decrypt, encrypt, hmacSha256, last4, randomDigits, safeEqualHex, sha256 } from './crypto';

const KEY = 'a'.repeat(64);
describe('crypto utils', () => {
  it('encrypt/decrypt round-trips and is randomised', () => {
    const a = encrypt('999900001111', KEY); const b = encrypt('999900001111', KEY);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(decrypt(a, KEY)).toBe('999900001111');
  });
  it('rejects a wrong key or tampered data', () => {
    const enc = encrypt('secret', KEY);
    expect(() => decrypt(enc, 'b'.repeat(64))).toThrow();
    const bad = Buffer.from(enc); bad[bad.length - 1] ^= 1;
    expect(() => decrypt(bad, KEY)).toThrow();
  });
  it('last4 ignores spaces', () => expect(last4('9999 0000 0001')).toBe('0001'));
  it('hash helpers are deterministic', () => {
    expect(sha256('x')).toBe(sha256('x'));
    expect(hmacSha256('k', 'd')).toHaveLength(64);
  });
  it('safeEqualHex compares safely', () => {
    expect(safeEqualHex('abcd', 'abcd')).toBe(true);
    expect(safeEqualHex('abcd', 'abce')).toBe(false);
    expect(safeEqualHex('abcd', 'abc')).toBe(false);
  });
  it('randomDigits makes n digits', () => expect(randomDigits(6)).toMatch(/^\d{6}$/));
});
