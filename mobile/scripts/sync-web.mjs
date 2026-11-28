// Copies wording and artwork that only exist inside website source files: FAQ, About, legal pages, the home story
// animation and the SVG drawings. Reads frontend/ only; writes mobile/ only. Run after those change: npm run sync
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, '..', 'frontend', 'src');
const out = join(root, 'src', 'content', 'generated');
const read = (p) => readFileSync(join(web, p), 'utf8');
const load = (p) => import('data:text/javascript,' + encodeURIComponent(read(p)));
const must = (value, what) => {
  if (!value) throw new Error(`sync-web: could not find ${what}. The website file changed; update this script.`);
  return value;
};
mkdirSync(out, { recursive: true });
const write = (name, from, body) => writeFileSync(join(out, name), `// GENERATED from frontend/src/${from} by scripts/sync-web.mjs. Do not edit.\n${body}`);
const json = (v) => JSON.stringify(v, null, 1);

/* FAQ and About */
const faq = await load('lib/faqData.js');
write('faq.ts', 'lib/faqData.js', `export const FAQ_CATS: string[] = ${json(faq.CATS)};\nexport const FAQ_ITEMS: [string, string, string][] = ${json(faq.ITEMS)};\n`);
const steps = must(read('components/HomeAbout.jsx').match(/const STEPS = (\[[\s\S]*?\n\]);/), 'the About steps');
write('about.ts', 'components/HomeAbout.jsx', `export const ABOUT_STEPS: [string, string][] = ${json(new Function('return ' + steps[1])())};\n`);

/* Legal pages: <p>, <h2> and <ul><li> blocks inside <LegalPage> */
const legal = {};
for (const page of ['privacy', 'terms', 'refund', 'shipping', 'delete-account']) {
  const src = read(`app/${page}/page.js`);
  const m = must(src.match(/<LegalPage title="([^"]+)" updated="([^"]+)">([\s\S]*?)<\/LegalPage>/), `${page} text`);
  const text = (s) => {
    const t = s.replace(/\{" "\}/g, ' ').replace(/<[^>]+>/g, '').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    must(!/[{}]/.test(t), `plain text in ${page} (found code: ${t.slice(0, 60)})`);
    return t;
  };
  const blocks = [];
  for (const b of m[3].matchAll(/<(p|h2|ul)>([\s\S]*?)<\/\1>/g)) {
    if (b[1] === 'ul') blocks.push({ list: [...b[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((li) => text(li[1])) });
    else blocks.push({ [b[1] === 'h2' ? 'h' : 'p']: text(b[2]) });
  }
  must(blocks.length, `${page} blocks`);
  legal[page] = { title: m[1], updated: m[2], blocks };
}
write('legal.ts', 'app/*/page.js', `export type LegalBlock = { h?: string; p?: string; list?: string[] };\nexport const LEGAL: Record<string, { title: string; updated: string; blocks: LegalBlock[] }> = ${json(legal)};\n`);

/* Story animation: the website's markup and the style rules that drive it */
function rules(css) {
  const found = [];
  let depth = 0, start = 0;
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) {
      found.push(src.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  return found;
}
const all = [...rules(read('app/globals.css')), ...rules(read('app/dashboard.css'))];
const storyRules = all.filter((r) => !r.startsWith('@keyframes') && /\.story\b|\.story-ctl|\.sbtn/.test(r.startsWith('@media') ? r : r.split('{')[0]) && !/\.hero-(side|story)/.test(r.split('{')[0]));
const used = new Set([...storyRules.join(' ').matchAll(/animation(?:-name)?\s*:\s*([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const frames = all.filter((r) => r.startsWith('@keyframes') && used.has(r.slice(10).split('{')[0].trim()));
const vars = must(read('app/globals.css').match(/:root\{([\s\S]*?)\}/), 'the colour variables')[1];
const story = (await load('lib/connectbhai/storyTemplate.js')).default;
write('story.ts', 'lib/connectbhai/storyTemplate.js, app/globals.css, app/dashboard.css',
  `export const STORY_HTML = ${JSON.stringify(story)};\nexport const STORY_CSS = ${JSON.stringify(`:root{${vars}}\n` + [...storyRules, ...frames].join('\n'))};\n`);

/* SVG drawings from the legacy views; CSS colour variables become fixed colours */
const colors = Object.fromEntries([...vars.matchAll(/--([a-z-]+):(#[0-9A-Fa-f]{3,8})/g)].map((m) => [m[1], m[2]]));
const fixed = (svg) => svg
  .replace(/ style="([^"]*)"/g, (_, css) => css.split(';').filter(Boolean).map((d) => { const [k, v] = d.split(':'); return ` ${k.trim()}="${v.trim()}"`; }).join(''))
  .replace(/var\(--([a-z-]+)\)/g, (_, v) => must(colors[v], `colour --${v}`))
  .replace(/ (class|role|aria-hidden|focusable)="[^"]*"/g, '');
const ui = read('lib/connectbhai/ui.js');
const stepArt = [...ui.matchAll(/<svg class="step-art"[\s\S]*?<\/svg>/g)].map((m) => fixed(m[0].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')));
must(stepArt.length === 4, 'the four How it works drawings');
const careArt = fixed(must(ui.match(/<svg class="care-art"[\s\S]*?<\/svg>/), 'the Care plan drawing')[0].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
const router = fixed(must(ui.match(/<svg class="cc-router"[\s\S]*?<\/svg>/), 'the featured card router')[0].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
write('art.ts', 'lib/connectbhai/ui.js', `export const STEP_ART: string[] = ${json(stepArt)};\nexport const CARE_ART = ${json(careArt)};\nexport const ROUTER_ART = ${json(router)};\n`);
console.log('Synced FAQ, About, legal pages, story and drawings.');
