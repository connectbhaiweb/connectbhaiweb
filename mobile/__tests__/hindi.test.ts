import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXACT, PATTERNS } from '../src/i18n/generated/hi';
import { compile, translate } from '../src/i18n/translate';
import { MODULE_URL, PLAN } from '../src/speed/engine';

const web = join(__dirname, '..', '..', 'frontend', 'src');

test('the copied Hindi lists match the website (run `npm run i18n` if not)', () => {
  const from = join(web, 'lib', 'i18n');
  for (const f of readdirSync(from).filter((n) => /^hi(-[\w-]+)?\.js$/.test(n))) {
    const copy = readFileSync(join(__dirname, '..', 'src', 'i18n', 'generated', f), 'utf8');
    expect(copy.slice(copy.indexOf('\n') + 1)).toBe(readFileSync(join(from, f), 'utf8'));
  }
});

test('exact text, patterns, spacing and unknown text behave like the website', () => {
  const dict = compile({ 'Log in': 'लॉग इन', '{n} new': '{n} नए' });
  expect(translate(dict, ' Log  in ')).toBe(' लॉग इन ');
  expect(translate(dict, '3 new')).toBe('3 नए');
  expect(translate(dict, 'Unknown words')).toBe('Unknown words');
  expect(translate(dict, '452010')).toBe('452010');
  expect(translate(dict, 'constructor')).toBe('constructor');
});

test('the real dictionary translates the login button', () => {
  expect(translate(compile(EXACT, PATTERNS), 'Log in')).not.toBe('Log in');
});

test('the speed test uses the website module version and measurement plan', () => {
  const source = readFileSync(join(web, 'components', 'speed', 'SpeedTest.jsx'), 'utf8');
  expect(source).toContain(MODULE_URL);
  const plan = /const PLAN = (\[.*?\]);/.exec(source)![1];
  expect(PLAN).toEqual(new Function(`return ${plan}`)());
});
