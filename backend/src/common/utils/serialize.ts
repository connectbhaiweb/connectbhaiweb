import { Prisma } from '@prisma/client';

/** JSON-safe numbers: BigInt ids and Decimal amounts become plain numbers. Imported once at boot. */
(BigInt.prototype as any).toJSON = function () { return Number(this); };
(Prisma.Decimal.prototype as any).toJSON = function () { return Number(this.toString()); };

const SECRET_FIELDS = ['password_hash', 'aadhaar_enc', 'pan_enc', 'bank_account_enc'];
export function publicUser<T extends Record<string, any>>(u: T | null) {
  if (!u) return u;
  const out: Record<string, any> = { ...u };
  for (const k of SECRET_FIELDS) delete out[k];
  return out;
}
