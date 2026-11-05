/* Areas: a PIN code plus its readable area names (from the post-office list, e.g. "Indore Kumar khadi, Indore" -> "Kumar Khadi"). */
export const tidyArea = name => String(name || "").split(",")[0].replace(/^indore\s+/i, "").replace(/\s+indore$/i, "").trim().replace(/\b\w/g, c => c.toUpperCase());

/** Map PIN -> "Area one, Area two" (max 2 names) built from admin locations ({pincode, area}). */
export function areaIndex(locs) {
  const by = new Map();
  (locs || []).forEach(l => { const n = tidyArea(l.area); if (!n) return; const a = by.get(l.pincode) || []; if (!a.some(x => x.toLowerCase() === n.toLowerCase())) a.push(n); by.set(l.pincode, a); });
  return new Map([...by].map(([pin, a]) => [pin, a.slice(0, 2).join(", ") + (a.length > 2 ? ` +${a.length - 2}` : "")]));
}
