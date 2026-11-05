/** Normalises Indian mobile numbers to 10 digits. Returns null when invalid. */
export function normalizePhone(input: string): string | null {
  const d = String(input || '').replace(/\D/g, '');
  const ten = d.length === 12 && d.startsWith('91') ? d.slice(2) : d.length === 11 && d.startsWith('0') ? d.slice(1) : d;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}
