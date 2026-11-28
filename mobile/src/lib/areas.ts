/* From frontend/src/lib/connectbhai/areas.js: "Indore Kumar khadi, Indore" -> "Kumar Khadi". */
export const tidyArea = (name?: string) =>
  String(name || '')
    .split(',')[0]
    .replace(/^indore\s+/i, '')
    .replace(/\s+indore$/i, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
