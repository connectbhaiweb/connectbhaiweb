/* PIN code suggestions for every PIN field (QA points 1 and 4).
   From the 3rd digit a list drops down under the field: "452010 · Vijay Nagar, Annapurna · Indore", taken from the PIN codes
   Connect Bhai already knows (each city's areas, loaded once per visit through API.pinDirectory()).
   - Single-PIN fields: picking fills the field.
   - Multi-PIN fields ("452010, 452016"): picking adds the PIN to the list; the chosen PINs also show as chips with a remove ×.
   Keyboard: ↓ ↑ to move, Enter to pick, Esc to close. Typing a full PIN by hand still works everywhere. Browser-only. */
import { tidyArea } from "./areas";

export const PIN_ONE = ["pin", "rq-pin", "lc-pin", "dl-pin"];
export const PIN_MANY = ["pa-pins", "pt-pins", "cu-pins", "ap-pins"];
const isPinField = el => el && el.tagName === "INPUT" && (PIN_ONE.includes(el.id) || PIN_MANY.includes(el.id));
const isMany = el => PIN_MANY.includes(el.id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let dir = null;   // Promise<[{ pin, label }]>
function loadDir(API) {
  if (dir) return dir;
  dir = Promise.resolve(API && API.pinDirectory ? API.pinDirectory() : []).then(rows => {
    const by = new Map();
    (rows || []).forEach(r => {
      if (!/^\d{6}$/.test(String(r.pin || ""))) return;
      const e = by.get(r.pin) || { pin: r.pin, areas: [], city: r.city || "" };
      const n = tidyArea(r.area); if (n && !e.areas.some(a => a.toLowerCase() === n.toLowerCase())) e.areas.push(n);
      by.set(r.pin, e);
    });
    return [...by.values()].sort((a, b) => a.pin.localeCompare(b.pin))
      .map(e => ({ pin: e.pin, label: [e.areas.slice(0, 2).join(", ") + (e.areas.length > 2 ? ` +${e.areas.length - 2}` : ""), e.city].filter(Boolean).join(" · ") }));
  }).catch(() => { dir = null; return []; });
  return dir;
}

const listOf = v => String(v || "").split(/[\s,]+/).filter(Boolean);
const token = el => isMany(el) ? (String(el.value).split(",").pop() || "").trim() : String(el.value).trim();

function box(el) {
  const wrap = el.closest(".field") || el.parentElement;
  let b = wrap.querySelector(":scope > .pin-sug");
  if (!b) {
    b = document.createElement("div"); b.className = "pin-sug"; b.setAttribute("role", "listbox"); b.hidden = true;
    b.id = el.id + "-sug"; el.setAttribute("aria-controls", b.id); el.setAttribute("aria-autocomplete", "list"); el.setAttribute("autocomplete", "off");
    if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
    wrap.appendChild(b);
    // mousedown keeps focus in the field; the pick happens on click
    b.addEventListener("mousedown", e => e.preventDefault());
    b.addEventListener("click", e => { const o = e.target.closest("[data-pin]"); if (o) pick(el, o.dataset.pin); });
  }
  return b;
}
function hide(el) { const b = el && (el.closest(".field") || el.parentElement).querySelector(":scope > .pin-sug"); if (b) b.hidden = true; if (el) el.setAttribute("aria-expanded", "false"); }

function pick(el, pin) {
  if (isMany(el)) {
    const have = listOf(String(el.value).split(",").slice(0, -1).join(","));
    if (!have.includes(pin)) have.push(pin);
    el.value = have.join(", ") + ", ";
  } else el.value = pin;
  hide(el); el.focus();
  el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
}

/* chips under a multi-PIN field */
export function pinChips(el) {
  if (!el || !isMany(el)) return;
  const wrap = el.closest(".field") || el.parentElement;
  let c = wrap.querySelector(":scope > .pin-chips");
  if (!c) {
    c = document.createElement("div"); c.className = "pin-chips"; c.setAttribute("aria-label", "Chosen PIN codes");
    el.insertAdjacentElement("afterend", c);
    c.addEventListener("click", e => {
      const x = e.target.closest("[data-unpin]"); if (!x) return;
      el.value = listOf(el.value).filter(p => p !== x.dataset.unpin).join(", ");
      el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); el.focus();
    });
  }
  const pins = listOf(el.value).filter(p => /^\d{6}$/.test(p));
  c.innerHTML = pins.map(p => `<span class="chip pin-chip">${esc(p)}<button type="button" data-unpin="${esc(p)}" aria-label="Remove ${esc(p)}">×</button></span>`).join("");
  c.hidden = !pins.length;
}
/** Show chips for every multi-PIN field already filled in under `root` (an edit form that just opened). */
export function pinChipsIn(root) { (root || document).querySelectorAll(PIN_MANY.map(id => "#" + id).join(",")).forEach(pinChips); }

/** input event on any element: suggest when it is a PIN field */
export async function pinSuggest(el, API) {
  if (!isPinField(el)) return;
  if (isMany(el)) pinChips(el);
  const t = token(el), b = box(el);
  b.style.top = (el.offsetTop + el.offsetHeight + 4) + "px";   // right under the input, above any hint text
  if (!/^\d{3,5}$/.test(t)) { hide(el); return; }
  const chosen = isMany(el) ? listOf(el.value) : [];
  const all = await loadDir(API);
  if (token(el) !== t) return;   // the user kept typing while the list loaded
  const hits = all.filter(r => r.pin.startsWith(t) && !chosen.slice(0, -1).includes(r.pin)).slice(0, 8);
  if (!hits.length) { b.innerHTML = `<div class="pin-sug-none">No served PIN starts with ${esc(t)}. You can still type the full PIN.</div>`; b.hidden = false; el.setAttribute("aria-expanded", "true"); return; }
  b.innerHTML = hits.map((r, i) => `<div class="pin-sug-item${i === 0 ? " is-on" : ""}" role="option" id="${el.id}-o${i}" data-pin="${r.pin}" aria-selected="${i === 0}"><b>${r.pin}</b>${r.label ? `<span>${esc(r.label)}</span>` : ""}</div>`).join("");
  b.hidden = false; el.setAttribute("aria-expanded", "true"); el.setAttribute("aria-activedescendant", el.id + "-o0");
}

/** keydown: ↓ ↑ Enter Esc while the list is open. Returns true when it handled the key. */
export function pinSuggestKey(e) {
  const el = e.target; if (!isPinField(el)) return false;
  const b = (el.closest(".field") || el.parentElement).querySelector(":scope > .pin-sug");
  if (!b || b.hidden) return false;
  const items = [...b.querySelectorAll("[data-pin]")]; if (!items.length) { if (e.key === "Escape") { hide(el); e.stopPropagation(); return true; } return false; }
  let i = items.findIndex(x => x.classList.contains("is-on"));
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); i = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((x, k) => { x.classList.toggle("is-on", k === i); x.setAttribute("aria-selected", String(k === i)); });
    el.setAttribute("aria-activedescendant", items[i].id); items[i].scrollIntoView({ block: "nearest" }); return true;
  }
  if (e.key === "Enter" && i >= 0) { e.preventDefault(); pick(el, items[i].dataset.pin); return true; }
  if (e.key === "Escape") { hide(el); e.stopPropagation(); return true; }
  return false;
}
/** focusout: close the list a moment later (a click on it lands first) */
export function pinSuggestBlur(e) {
  const el = e.target; if (!isPinField(el)) return;
  setTimeout(() => {
    if (document.activeElement === el) return;
    hide(el);
    if (isMany(el)) { const v = String(el.value).replace(/[\s,]+$/, ""); if (v !== el.value) el.value = v; }   // no trailing ", " left after picking
  }, 120);
}
