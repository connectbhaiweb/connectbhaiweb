/* Port of translate() in frontend/src/lib/i18n/engine.js: the same exact-text lookup and {x} / {n} patterns,
   so a text reads the same in Hindi on the website and in the app. Texts not in the dictionary stay English. */
export type Pattern = [RegExp, string | ((...found: string[]) => string | undefined)];
export type Dictionary = { exact: Record<string, string>; patterns: Pattern[] };

export function compile(exact: Record<string, string>, patterns: Pattern[] = []): Dictionary {
  const list: Pattern[] = [];
  for (const key of Object.keys(exact)) {
    if (!/\{[xn]\}/.test(key)) continue;
    const source = key
      .split(/(\{[xn]\})/)
      .map((p) => (p === '{x}' ? '(.+?)' : p === '{n}' ? '(\\d[\\d,.]*)' : p.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')))
      .join('');
    list.push([new RegExp('^' + source + '$'), exact[key]]);
  }
  return { exact, patterns: [...list, ...patterns] };
}

export function translate(dict: Dictionary, text: string, onMissing?: (core: string) => void): string {
  if (!text) return text;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  const core = m[2].replace(/\s+/g, ' ');
  if (!core || !/[A-Za-z]/.test(core)) return text;
  let hi: string | undefined = Object.prototype.hasOwnProperty.call(dict.exact, core) ? dict.exact[core] : undefined;
  if (hi === undefined) {
    for (const [re, value] of dict.patterns) {
      const found = re.exec(core);
      if (!found) continue;
      if (typeof value === 'function') hi = value(...found.slice(1));
      else {
        let i = 0;
        hi = value.replace(/\{[xn]\}/g, () => found[++i] ?? '');
      }
      if (hi !== undefined) break;
    }
  }
  if (hi === undefined) {
    onMissing?.(core);
    return text;
  }
  return m[1] + hi + m[3];
}
