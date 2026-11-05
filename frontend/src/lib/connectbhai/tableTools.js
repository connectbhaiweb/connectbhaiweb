/* Search + pagination for every dashboard table (classic <table class="tbl"> and React grids with role="table").
   - Search matches ALL words against the whole row text (every column, case-insensitive, phone numbers also without spaces/+/-).
   - Pages of 10 / 25 / 50 / 100 rows. Query, page and size are remembered per table while you stay on the page.
   - Rows are only hidden (class tt-hide), never removed, so the existing buttons keep working.
   Browser only. start() returns a cleanup function. */
const SEL = "table.tbl, [role=table]";
const MIN_ROWS = 6;                      // tables with fewer rows stay plain
const SIZES = [10, 25, 50, 100];
const state = new Map();                 // key -> { q, page, size }
const REG = new Map();                   // key -> { top, foot, t }

const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const compact = s => s.replace(/[\s,+\-().]/g, "");

function rowsOf(t) {
  const rows = t.tagName === "TABLE"
    ? [...t.querySelectorAll(":scope > tbody > tr")]
    : [...t.querySelectorAll(":scope > [role=row]")].filter(r => !r.querySelector("[role=columnheader]"));
  return rows.filter(r => !(r.children.length === 1 && r.children[0].hasAttribute("colspan")));   // skip "nothing here" rows
}
const keyOf = (t, i) => {
  const head = t.tagName === "TABLE" ? [...t.querySelectorAll("thead th")].map(x => x.textContent).join("|") : (t.getAttribute("aria-label") || "");
  return location.pathname + "::" + head + "::" + i;
};

function build(t, key) {
  const st = state.get(key) || { q: "", page: 1, size: 10 }; state.set(key, st);
  const top = document.createElement("div");
  top.className = "tt-bar"; top.dataset.ttk = key;
  top.innerHTML = `<label class="tt-size">Rows <select aria-label="Rows per page">${SIZES.map(n => `<option value="${n}"${n === st.size ? " selected" : ""}>${n}</option>`).join("")}</select></label>
    <input type="search" class="tt-q" placeholder="Search all columns…" aria-label="Search this table" value="${st.q.replace(/"/g, "&quot;")}">`;
  const foot = document.createElement("div");
  foot.className = "tt-foot"; foot.dataset.ttk = key;
  foot.innerHTML = `<span class="tt-count" aria-live="polite"></span><span class="tt-pager"></span>`;
  const anchor = t.closest(".tbl-wrap") || t;
  anchor.insertAdjacentElement("beforebegin", top);
  anchor.insertAdjacentElement("afterend", foot);
  t.dataset.tt = key; top._foot = foot; top._table = t; REG.set(key, { top, foot, t });
  return top;
}

function apply(t, bar, key) {
  const st = state.get(key), rows = rowsOf(t);
  const words = norm(st.q).split(" ").filter(Boolean);
  const hit = rows.filter(r => {
    if (!words.length) return true;
    const h = norm(r.textContent), hc = compact(h);
    return words.every(w => h.includes(w) || hc.includes(compact(w)));
  });
  const pages = Math.max(1, Math.ceil(hit.length / st.size));
  st.page = Math.min(Math.max(1, st.page), pages);
  const from = (st.page - 1) * st.size, to = from + st.size, show = new Set(hit.slice(from, to));
  rows.forEach(r => r.classList.toggle("tt-hide", !show.has(r)));
  const foot = bar._foot || bar;
  foot.querySelector(".tt-count").textContent = hit.length
    ? `${from + 1}–${Math.min(to, hit.length)} of ${hit.length}${hit.length !== rows.length ? ` (filtered from ${rows.length})` : ""}`
    : `No rows match “${st.q}”`;
  const pg = foot.querySelector(".tt-pager");
  if (pages <= 1) { pg.innerHTML = ""; return; }
  const nums = []; for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - st.page) <= 1) nums.push(p);
  let html = `<button type="button" data-p="${st.page - 1}" ${st.page === 1 ? "disabled" : ""} aria-label="Previous page">‹</button>`, last = 0;
  for (const p of nums) { if (p - last > 1) html += `<span class="tt-gap">…</span>`; html += `<button type="button" data-p="${p}" class="${p === st.page ? "on" : ""}" ${p === st.page ? 'aria-current="page"' : ""}>${p}</button>`; last = p; }
  html += `<button type="button" data-p="${st.page + 1}" ${st.page === pages ? "disabled" : ""} aria-label="Next page">›</button>`;
  pg.innerHTML = html;
}

function enhanceAll() {
  const seen = new Map();
  document.querySelectorAll(SEL).forEach(t => {
    if (t.closest("#modal, .tt-bar, .tt-foot")) return;
    const rows = rowsOf(t);
    const base = keyOf(t, 0).replace(/::0$/, ""), n = seen.get(base) || 0; seen.set(base, n + 1);
    const key = base + "::" + n;
    const anchor = t.closest(".tbl-wrap") || t;
    const pre = anchor.previousElementSibling, post = anchor.nextElementSibling;
    let bar = pre && pre.classList.contains("tt-bar") ? pre : null;
    const foot = post && post.classList.contains("tt-foot") ? post : null;
    if (bar && foot) { bar._foot = foot; bar._table = t; t.dataset.tt = key; bar.dataset.ttk = key; foot.dataset.ttk = key; REG.set(key, { top: bar, foot, t }); }
    else { if (bar) bar.remove(); if (foot) foot.remove(); bar = null; }
    if (rows.length < MIN_ROWS && !(state.get(key) && state.get(key).q)) { if (bar) { bar._foot && bar._foot.remove(); bar.remove(); } rows.forEach(r => r.classList.remove("tt-hide")); delete t.dataset.tt; return; }
    if (!bar) bar = build(t, key);
    apply(t, bar, key);
  });
}

export function start() {
  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(enhanceAll, 60); };
  const mo = new MutationObserver(muts => { if (muts.every(m => m.target.closest && m.target.closest(".tt-bar, .tt-foot"))) return; schedule(); });
  mo.observe(document.body, { childList: true, subtree: true });
  const stateFor = el => { const box = el.closest(".tt-bar, .tt-foot"); const c = box && REG.get(box.dataset.ttk); return c ? { bar: c.top, t: c.t, key: box.dataset.ttk } : null; };
  const onInput = e => { if (!e.target.matches(".tt-q")) return; const c = stateFor(e.target); if (!c) return; const st = state.get(c.key); st.q = e.target.value; st.page = 1; clearTimeout(e.target._d); e.target._d = setTimeout(() => apply(c.t, c.bar, c.key), 120); };
  const onChange = e => { if (!e.target.closest(".tt-size")) return; const c = stateFor(e.target); if (!c) return; const st = state.get(c.key); st.size = Number(e.target.value); st.page = 1; apply(c.t, c.bar, c.key); };
  const onClick = e => { const b = e.target.closest(".tt-pager button"); if (!b || b.disabled) return; const c = stateFor(b); if (!c) return; state.get(c.key).page = Number(b.dataset.p); apply(c.t, c.bar, c.key); c.bar.scrollIntoView({ block: "nearest" }); };
  document.addEventListener("input", onInput); document.addEventListener("change", onChange); document.addEventListener("click", onClick);
  schedule();
  return () => { mo.disconnect(); clearTimeout(timer); document.removeEventListener("input", onInput); document.removeEventListener("change", onChange); document.removeEventListener("click", onClick); };
}
