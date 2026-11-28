/* PIN suggestions: the rows and the matching rules of the website's pinSuggest.js. */
export type PinRow = { pin: string; label: string };

/** One row per area exactly as stored: "452010 · Vijay Nagar, Scheme 54 · Indore". */
export function pinRows(rows: { pin: string; area: string; city: string }[]): PinRow[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => /^\d{6}$/.test(String(r.pin || '')))
    .map((r) => {
      const area = String(r.area || '').trim();
      const city = r.city && !new RegExp('\\b' + r.city + '$', 'i').test(area) ? r.city : '';
      return { pin: r.pin, label: [area, city].filter(Boolean).join(' · ') };
    })
    .filter((r) => {
      const k = r.pin + '|' + r.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => x.pin.localeCompare(y.pin));
}
export const pinList = (v: string) => String(v || '').split(/[\s,]+/).filter(Boolean);
/** What is being typed now (the last item of a list). */
export const pinToken = (value: string, many?: boolean) => (many ? (String(value).split(',').pop() || '').trim() : String(value).trim());
/** Suggestions from the 3rd digit, skipping PINs already chosen in a list. null = no list to show. */
export function pinMatches(all: PinRow[], value: string, many?: boolean): PinRow[] | null {
  const t = pinToken(value, many);
  if (!/^\d{3,6}$/.test(t)) return null;
  const chosen = many ? pinList(value).slice(0, -1) : [];
  return all.filter((r) => r.pin.startsWith(t) && !chosen.includes(r.pin)).slice(0, 80);
}
export function pickPin(value: string, pin: string, many?: boolean) {
  if (!many) return pin;
  const have = pinList(String(value).split(',').slice(0, -1).join(','));
  if (!have.includes(pin)) have.push(pin);
  return have.join(', ') + ', ';
}
