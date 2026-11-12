/* Server-paged tables for the string-template dashboard views in ui.js.
   serverTable(key, cfg) returns the box markup (search bar, rows, pager); fillServerTables() then loads ONE page from the API
   for every box on screen. Search text, page and page size go to the server (status / search filters of the list endpoints),
   so a table never holds more than one page of rows.
   cfg: { role, kind, filters?: () => ({status, ...}), html: (rows, r) => string, empty: string, label: string, onData?: (r) => void } */
import { fetchPage } from "./paging";

const REG = new Map();      // key -> cfg of the boxes currently on screen
const ST = new Map();       // key -> { page, size, q }   kept while the page is open, so a re-render keeps your search
const SEQ = new Map();
const ROWS = new Map();     // `${kind}:${id}` -> row last shown, so a modal can open a row without downloading the list again
export const cachedRow = (kind, id) => ROWS.get(kind + ":" + id);
let API = null;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const state = k => { let s = ST.get(k); if (!s) ST.set(k, s = { page: 1, size: 10, q: "" }); return s; };

export function clearServerTables() { REG.clear(); }
export function resetServerTable(key) { const s = state(key); s.page = 1; }

export function serverTable(key, cfg) {
  REG.set(key, cfg); const s = state(key);
  return `<div class="stbox" data-server data-stk="${key}">
    <div class="tt-bar"><label class="tt-size">Rows <select aria-label="Rows per page">${[10, 25, 50, 100].map(n => `<option value="${n}"${n === s.size ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <input type="search" class="tt-q" placeholder="Search name, phone, code…" aria-label="${esc(cfg.label || "Search this table")}" value="${esc(s.q)}"></div>
    <div class="st-body" aria-live="polite"><p class="muted" style="padding:14px 4px">Loading…</p></div>
    <div class="tt-foot"><span class="tt-count"></span><span class="tt-pager"></span></div></div>`;
}

async function load(box) {
  const key = box.dataset.stk, cfg = REG.get(key); if (!cfg || !API) return;
  const s = state(key), n = (SEQ.get(key) || 0) + 1; SEQ.set(key, n);
  const body = box.querySelector(".st-body"), count = box.querySelector(".tt-count"), pager = box.querySelector(".tt-pager");
  let r;
  try { r = await fetchPage(API, cfg.role, cfg.kind, { page: s.page, limit: s.size, q: s.q.trim(), ...(cfg.filters ? cfg.filters() : {}) }); }
  catch (e) { if (n === SEQ.get(key)) body.innerHTML = `<p class="muted" role="alert" style="padding:14px 4px">${esc((e && e.message) || "Could not load this list.")}</p>`; return; }
  if (n !== SEQ.get(key) || !box.isConnected) return;
  r.items.forEach(x => x && x.id != null && ROWS.set(cfg.kind + ":" + x.id, x));
  const pages = Math.max(1, Math.ceil(r.total / s.size));
  if (s.page > pages) { s.page = pages; return load(box); }
  body.innerHTML = r.items.length ? cfg.html(r.items, r) : `<div class="empty"><b>${esc(s.q.trim() ? `No rows match “${s.q.trim()}”.` : cfg.empty || "Nothing here yet.")}</b></div>`;
  const from = (s.page - 1) * s.size + 1;
  count.textContent = r.total ? `${from}–${Math.min(s.page * s.size, r.total)} of ${r.total}` : "";
  const nums = []; for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - s.page) <= 1) nums.push(p);
  let h = "", last = 0;
  if (pages > 1) {
    h = `<button type="button" data-p="${s.page - 1}" ${s.page === 1 ? "disabled" : ""} aria-label="Previous page">‹</button>`;
    for (const p of nums) { if (p - last > 1) h += `<span class="tt-gap">…</span>`; h += `<button type="button" data-p="${p}" class="${p === s.page ? "on" : ""}" ${p === s.page ? 'aria-current="page"' : ""}>${p}</button>`; last = p; }
    h += `<button type="button" data-p="${s.page + 1}" ${s.page === pages ? "disabled" : ""} aria-label="Next page">›</button>`;
  }
  pager.innerHTML = h;
  if (cfg.onData) cfg.onData(r, box);
}
export function fillServerTables() { document.querySelectorAll(".stbox").forEach(load); }

/* one set of document listeners; api = the app's API object */
export function initServerTables(api) {
  API = api;
  const box = el => el.closest && el.closest(".stbox");
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".stbox .tt-pager button"); if (!b || b.disabled) return; const x = box(b); state(x.dataset.stk).page = Number(b.dataset.p); load(x); x.scrollIntoView({ block: "nearest" }); });
  document.addEventListener("change", e => { const x = e.target.matches && e.target.matches(".stbox .tt-size select") && box(e.target); if (!x) return; const s = state(x.dataset.stk); s.size = Number(e.target.value); s.page = 1; load(x); });
  document.addEventListener("input", e => { const x = e.target.matches && e.target.matches(".stbox .tt-q") && box(e.target); if (!x) return; const s = state(x.dataset.stk); s.q = e.target.value; s.page = 1; clearTimeout(x._d); x._d = setTimeout(() => load(x), 250); });
}
