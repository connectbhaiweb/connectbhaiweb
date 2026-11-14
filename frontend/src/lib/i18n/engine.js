/* English / Hindi switch for the whole site.
   The site's text lives in React components and in the legacy string-template views (ui.js), so instead of wrapping
   every string, this module translates the text that reaches the page: each text node (and placeholder / title /
   aria-label / alt) is looked up in the Hindi dictionary by its English text. The English original is kept per node,
   so switching back restores it exactly. Texts not in the dictionary stay English.
   Dictionary keys may hold {x} (any text) and {n} (a number); the Hindi value uses the same markers, in order. */
const KEY = "cb-lang";
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT", "SVG"]);
const listeners = new Set();
let lang = "en", dict = null, started = false, observer = null, queued = null, raf = 0;
const orig = new WeakMap(), written = new WeakMap(), attrOrig = new WeakMap(), attrWritten = new WeakMap();

export const getLang = () => lang;
export const subscribeLang = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach(f => f());

const compile = ({ exact, patterns }) => {
  const list = [];
  for (const k of Object.keys(exact)) {
    if (!/\{[xn]\}/.test(k)) continue;
    const src = k.split(/(\{[xn]\})/).map(p => (p === "{x}" ? "(.+?)" : p === "{n}" ? "(\\d[\\d,.]*)" : p.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&"))).join("");
    const re = new RegExp("^" + src + "$");
    list.push([re, exact[k]]);
  }
  return { exact, patterns: [...list, ...(patterns || [])] };
};

let saveT = 0;
function keepMissing() {   // debug only (localStorage cb-i18n-debug): keeps the list of untranslated texts across page loads
  if (saveT) return;
  saveT = setTimeout(() => { saveT = 0; try { const old = JSON.parse(localStorage.getItem("cb-missing") || "[]"); localStorage.setItem("cb-missing", JSON.stringify([...new Set([...old, ...window.__cbMissing])])); } catch (e) { /* storage blocked */ } }, 800);
}

export function translate(text) {
  if (!dict || !text) return text;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text), core = m[2].replace(/\s+/g, " ");
  if (!core || !/[A-Za-z]/.test(core)) return text;
  let hi = dict.exact[core];
  if (hi === undefined) {
    for (const [re, val] of dict.patterns) {
      const x = re.exec(core);
      if (!x) continue;
      if (typeof val === "function") hi = val(...x.slice(1));
      else { let i = 0; hi = val.replace(/\{[xn]\}/g, () => x[++i] ?? ""); }
      if (hi !== undefined) break;
    }
  }
  if (hi === undefined) { if (typeof window !== "undefined" && window.__cbMissing) { window.__cbMissing.add(core); keepMissing(); } return text; }
  return m[1] + hi + m[3];
}

const skipNode = el => !el || SKIP.has(el.nodeName.toUpperCase()) || !!(el.closest && el.closest("[data-no-translate]"));

function textNode(n) {
  if (skipNode(n.parentElement)) return;
  const cur = n.data;
  if (lang === "hi") {
    if (written.get(n) === cur) return;                 // already our Hindi text
    orig.set(n, cur);
    const t = translate(cur);
    if (t !== cur) { written.set(n, t); n.data = t; } else written.delete(n);
  } else if (written.has(n) && written.get(n) === cur) { n.data = orig.get(n); written.delete(n); }
}

function attrs(el) {
  if (skipNode(el)) return;
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a), w = attrWritten.get(el) || {}, o = attrOrig.get(el) || {};
    if (lang === "hi") {
      if (w[a] === cur) continue;
      o[a] = cur; const t = translate(cur);
      if (t !== cur) { w[a] = t; el.setAttribute(a, t); } else delete w[a];
    } else if (w[a] !== undefined && w[a] === cur) { el.setAttribute(a, o[a]); delete w[a]; }
    attrOrig.set(el, o); attrWritten.set(el, w);
  }
}

function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) { textNode(root); return; }
  if (root.nodeType !== 1) return;
  attrs(root);
  const tw = document.createTreeWalker(root, 1 | 4);   // elements and text
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (n.nodeType === 3) textNode(n); else attrs(n); }
}

function flush() {
  raf = 0;
  const jobs = queued; queued = null;
  if (!jobs) return;
  jobs.forEach(n => { if (n.isConnected !== false) walk(n); });
}
const queue = n => { (queued || (queued = new Set())).add(n); if (!raf) raf = requestAnimationFrame(flush); };

function observe() {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === "childList") m.addedNodes.forEach(queue);
      else if (m.type === "characterData") queue(m.target);
      else if (m.type === "attributes") queue(m.target);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

async function load() {
  if (dict) return;
  const m = await import("./hi");
  dict = compile({ exact: m.EXACT, patterns: m.PATTERNS });
}

function paint() {
  document.documentElement.lang = lang === "hi" ? "hi-IN" : "en-IN";
  if (lang === "hi") { document.title = translate(document.documentElement.dataset.cbTitle || (document.documentElement.dataset.cbTitle = document.title)); }
  else if (document.documentElement.dataset.cbTitle) document.title = document.documentElement.dataset.cbTitle;
  walk(document.body);
}

/* Call once in the browser after the page has hydrated. */
export async function startLang() {
  if (started || typeof window === "undefined") return;
  started = true;
  try { if (localStorage.getItem("cb-i18n-debug")) window.__cbMissing = new Set(); } catch (e) { /* storage blocked */ }
  let saved = "en";
  try { saved = localStorage.getItem(KEY) === "hi" ? "hi" : "en"; } catch (e) { /* storage blocked */ }
  observe();
  if (saved === "hi") await setLang("hi", false);
}

export async function setLang(next, save = true) {
  next = next === "hi" ? "hi" : "en";
  if (next === "hi") await load();
  lang = next;
  if (save) { try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked */ } }
  paint(); emit();
}
