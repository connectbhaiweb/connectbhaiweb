import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';

/** AES-256-GCM. Output = iv(12) | tag(16) | ciphertext. Used for Aadhaar / PAN / bank numbers. */
export function encrypt(plain: string, keyHex: string): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return new Uint8Array(Buffer.concat([iv, c.getAuthTag(), enc]));
}
export function decrypt(input: Uint8Array, keyHex: string): string {
  const buf = Buffer.from(input);
  const d = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
export const last4 = (s: string) => s.replace(/\s+/g, '').slice(-4);
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const hmacSha256 = (secret: string, data: string | Buffer) => createHmac('sha256', secret).update(data).digest('hex');
export function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a || ''); const y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
}
export const randomDigits = (n: number) => Array.from({ length: n }, () => randomInt(0, 10)).join('');
