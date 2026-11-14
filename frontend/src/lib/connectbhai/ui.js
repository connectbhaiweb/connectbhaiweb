/* Connect Bhai · UI (migrated from the original single-file app).
   STAGE 1: views are still string-template renderers writing into <main id="app">; the shell (header, footer, demo bar,
   compare bar, modal/toast host), routing, config and data layer are native Next.js / React.
   Browser-only: this module is loaded with a dynamic import() from client components, never during SSR. */
import { API, AppError, BOOK, BOOK_NEXT, BOOK_TONE, CATS, COMM, COMM_TONE, KIND, LEAD, LEAD_NEXT, LEAD_TONE, PRODUCT_NAME, PW_RULE, SHEET_COLS, TICKET, TICKET_TONE, ZONES, ZONE_BY_PIN, ZONE_NAME, addDays, esc, fdate, fdt, inr, isPhone, isPin, loadDemo, migrateCities, planFromRow, productOf, pwOk, resetDemoData, todayISO } from "./api";
import { SUPPORT, LIVE, REST } from "./config";
import { areaIndex } from "./areas";
import { dashboard as dashStats, fetchPage, partnerTotals, money as moneyStats, payables, carePlanSummary } from "./paging";
import { cachedRow, clearServerTables, fillServerTables, initServerTables, resetServerTable, serverTable } from "./serverTable";
import { publish } from "./runtime";
import { pinChipsIn, pinSuggest, pinSuggestBlur, pinSuggestKey } from "./pinSuggest";
import { ROLE_HOME, ROLE_NAME, initials, pathFor } from "./shared";
/* =====================================================================
   Connect Bhai · UI
   ===================================================================== */
const $ = s => document.querySelector(s);
let app = null;                       // <main id="app">, resolved in init()
let navigate = () => { };              // set in init(): (path, "push" | "replace") => void
let renderedKey = null;               // "view/tab" currently painted into #app
const S = { view: "home", tab: null, pin: "", areas: [], results: null, f: { speed: 0, price: 2000, ott: false, tv: false, providers: [], sort: "price" }, compare: [] };
const PROVIDER_COLORS = ["#1450E6", "#0B7A75", "#6A3FD1", "#B4541A", "#0E6BA8", "#8A2D6B"];
const pcolor = name => PROVIDER_COLORS[[...String(name)].reduce((s, c) => s + c.charCodeAt(0), 0) % PROVIDER_COLORS.length];
const me = () => API.me();

/* ---------- toast / modal ---------- */
function toast(msg, bad) { const t = $("#toast"); t.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200); }
function openModal(html, wide) { const m = $("#modal"), b = $("#mbox"); b.className = "mbox" + (wide ? " wide" : ""); b.innerHTML = `<button class="mclose" data-act="close-modal" type="button" aria-label="Close">×</button>` + html; m.hidden = false; document.body.style.overflow = "hidden"; pinChipsIn(b); const f = b.querySelector("input:not([type=hidden]):not([type=checkbox]),select,textarea"); if (f) setTimeout(() => f.focus(), 40); }
function closeModal() { $("#modal").hidden = true; document.body.style.overflow = ""; }
const onModalClick = e => { if (e.target.id === "modal") closeModal(); };
/* OTP boxes: digits only, auto-advance, Backspace steps back, paste fills all six; Verify enables at six digits. */
function otpSync(box) {
  const form = box.closest("form"), boxes = [...form.querySelectorAll(".otp-box")], v = boxes.map(b => b.value).join("");
  form.querySelector('input[name="otp"]').value = v;
  const btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = v.length !== 6;
}
function otpFill(box, digits) {
  const boxes = [...box.closest("form").querySelectorAll(".otp-box")]; let i = boxes.indexOf(box);
  for (const d of digits.slice(0, boxes.length - i)) boxes[i++].value = d;
  otpSync(box); (boxes[Math.min(i, boxes.length - 1)]).focus();
}
const onOtpKey = e => {
  const t = e.target; if (!t || !t.classList || !t.classList.contains("otp-box")) return false;
  const boxes = [...t.closest("form").querySelectorAll(".otp-box")], i = boxes.indexOf(t);
  if (e.key === "Backspace") { e.preventDefault(); if (t.value) t.value = ""; else if (i > 0) { boxes[i - 1].value = ""; boxes[i - 1].focus(); } otpSync(t); }
  else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); boxes[i - 1].focus(); }
  else if (e.key === "ArrowRight" && i < boxes.length - 1) { e.preventDefault(); boxes[i + 1].focus(); }
  return true;
};
const onPaste = e => {
  const t = e.target; if (!t || !t.classList || !t.classList.contains("otp-box")) return;
  e.preventDefault(); otpFill(t, ((e.clipboardData || window.clipboardData).getData("text") || "").replace(/\D/g, ""));
};
const onKeydown = e => {
  if (onOtpKey(e)) return;
  if (pinSuggestKey(e)) return;   // the PIN list is open: ↓ ↑ Enter Esc belong to it
  if (e.key === "Escape" && !$("#modal").hidden) closeModal();
  if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("dialcard")) { e.preventDefault(); e.target.click(); }
};
const errMsg = e => {
  const m = (e && e.message) || "";
  if (!m) return "Something went wrong. Please try again.";
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(m)) return "Cannot reach the server. Check your internet connection and try again.";
  if (/rate limit|too many|after \d+ seconds|security purposes/i.test(m)) return "Too many attempts. Please wait a minute and try again.";
  if (/token has expired|otp.*(expired|invalid)|expired.*otp/i.test(m)) return "That OTP is incorrect or has expired. Request a new one.";
  return m;
};
/* ---- phone numbers: accept +91 / 91 / 0 prefixes, spaces and dashes; Indian mobiles only ---- */
const normPhone = v => { let d = String(v == null ? "" : v).replace(/\D/g, ""); if (d.length === 14 && d.startsWith("0091")) d = d.slice(4); else if (d.length === 12 && d.startsWith("91")) d = d.slice(2); else if (d.length === 11 && d.startsWith("0")) d = d.slice(1); return d; };
const phoneError = v => { const d = normPhone(v); if (!d) return "Enter your 10-digit mobile number."; if (d.length !== 10) return "Enter a 10-digit mobile number without the country code."; if (!isPhone(d)) return "Indian mobile numbers start with 6, 7, 8 or 9. Only +91 numbers are supported."; return ""; };
const GUARD_TIMEOUT_MS = 30000;
async function guard(btn, fn, timeoutMs = GUARD_TIMEOUT_MS) {
  if (btn) { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = "Please wait…"; }
  try {
    let timer; const slow = new Promise((_, rej) => { timer = setTimeout(() => rej(new AppError("This is taking too long. Check your internet and try again.")), timeoutMs); });
    try { return await Promise.race([fn(), slow]); } finally { clearTimeout(timer); }
  } catch (e) { toast(errMsg(e), true); throw e; }
  finally { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.t; } }
}

/* ---------- small renderers ---------- */
const pill = (label, tone) => `<span class="pill ${tone}"><i></i>${esc(label)}</span>`;
const leadPill = (s, product) => pill((s === "installed" && ["sim", "ott"].includes(product)) ? "Activated" : (LEAD[s] || s), LEAD_TONE[s] || "p-grey");
const simLabel = l => l && l.product === "sim" && l.sim_request ? `SIM · ${l.sim_request.connection === "port" ? "Port-in" : "New number"} · ${l.sim_request.type === "postpaid" ? "Postpaid" : "Prepaid"}` : l && l.product && l.product !== "broadband" ? PRODUCT_NAME[l.product] : "";
const productChip = l => simLabel(l) ? pill(simLabel(l), "p-grey") : "";
const bookPill = s => pill(BOOK[s] || s, BOOK_TONE[s] || "p-grey");
const tickPill = s => pill(TICKET[s] || s, TICKET_TONE[s] || "p-grey");
const commPill = s => pill(COMM[s] || s, COMM_TONE[s] || "p-grey");
const demoBadge = on => on ? `<span class="badge demo" title="Sample data for testing, not a real offer">Demo</span>` : "";
const plogo = prov => prov && prov.logo_url ? `<img class="plogo plogo-img" src="${esc(prov.logo_url)}" alt="${esc(prov.name)}" loading="lazy">` : `<span class="plogo" style="background:${pcolor(prov && prov.name)}">${esc(initials(prov && prov.name))}</span>`;
const dataTxt = p => p.data_limit_gb ? p.data_limit_gb.toLocaleString("en-IN") + " GB" : "Unlimited";
const speedTxt = p => Number(p.speed_mbps) > 0 ? p.speed_mbps + " Mbps" : "";   // never "undefined Mbps"
const joinDot = (...a) => a.filter(Boolean).join(" · ");
const planLine = p => p ? esc(joinDot(p.provider && p.provider.name, p.name, planSummary(p), p.price_monthly != null ? inr(p.price_monthly) + (p.category === "sim_prepaid" ? "" : "/mo") : "")) : "No plan chosen (callback)";
const field = (id, label, input, hint) => `<div class="field" data-f="${id}"><label for="${id}">${label}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ""}<span class="ferr" id="${id}-err"></span></div>`;
function setErr(form, map) {
  form.querySelectorAll(".field").forEach(f => f.classList.remove("bad")); form.querySelectorAll(".ferr").forEach(e => (e.textContent = ""));
  let first = null;
  Object.entries(map).forEach(([id, msg]) => { const fe = form.querySelector(`[data-f="${id}"]`); if (fe) { fe.classList.add("bad"); fe.querySelector(".ferr").textContent = msg; first = first || fe.querySelector("input,select,textarea"); } });
  if (first) first.focus(); return Object.keys(map).length === 0;
}
const val = (form, name) => { const el = form.elements[name]; if (!el) return ""; if (el.type === "checkbox") return el.checked; const v = String(el.value || "").trim(); return /phone$/.test(name) ? normPhone(v) : v; };
/* QA 12: what a Refresh actually found */
const stateMsg = d => !d ? "Status refreshed." : d.state === "online" ? "Router is online." : d.state === "offline" ? `Router is offline${d.last_seen ? " (last seen " + fdt(d.last_seen) + ")" : ""}.` : "The router has not reported to Gene yet.";
function deviceView(d) {
  const live = d && !d.is_simulated;
  const tag = live ? `<span class="badge live" title="Reported by the modem through Gene, your personal assistant (Care plan)">Live · Gene</span>`
    : `<span class="badge sim" title="Not a live reading. Shows Live once the modem reports through Gene, your personal assistant.">Simulated</span>`;
  if (!d || d.state === "unknown") return `${pill(live ? "Not reporting to Gene" : "Not reporting yet", "p-grey")} ${tag}`;
  const m = d.last_seen ? Math.max(0, Math.round((Date.now() - new Date(d.last_seen)) / 60000)) : null;
  return `${d.state === "online" ? pill("Online", "p-ok") : pill("Offline", "p-bad")} ${tag}${m !== null ? ` <span class="muted small">last seen ${m < 1 ? "just now" : m < 120 ? m + " min ago" : fdt(d.last_seen)}</span>` : ""}`;
}
const stLine = t => `<div class="row small" style="gap:2px 8px;padding:4px 0;border-bottom:1px solid var(--line)"><b>${t.kind === "router" ? "Line test" : "Wi-Fi"}</b><span><b class="num">${t.status === "done" ? Number(t.download_mbps).toFixed(1) + " Mbps" : t.status === "failed" ? "Failed" : "Running…"}</b>${t.upload_mbps ? " ↓ · " + Number(t.upload_mbps).toFixed(1) + " ↑" : ""}${t.ping_ms ? " · " + Math.round(t.ping_ms) + " ms" : ""}</span><span class="muted">${fdt(t.created_at)}</span>${t.is_simulated ? `<span class="badge sim">Simulated</span>` : ""}</div>`;
async function loadHist(id) {
  const el = document.querySelector(`[data-hist="${id}"]`); if (el) { try { const ts = await API.speedTests(id); el.innerHTML = ts.length ? ts.map(stLine).join("") : `<span class="muted small">No speed tests yet.</span>`; } catch (e) { el.textContent = ""; } }
  const ea = document.querySelector(`[data-acts="${id}"]`); if (ea) { try { const as = await API.deviceLog(id); ea.innerHTML = as.length ? as.map(actLine).join("") : `<span class="muted small">No restarts or Wi-Fi changes yet.</span>`; } catch (e) { ea.textContent = ""; } }
}

/* ---------- live progress for modem commands (restart / Wi-Fi change) ----------
   Shows each step in the card and follows the saved command until it is done or failed. The click already returned; the server finishes the work. */
const LIVE_STEPS = { reboot: ["Command sent", "Waiting for your modem to pick it up (about a minute)", "Modem is restarting (about 2 minutes)", "Modem is back online"], wifi: ["Command sent", "Waiting for your modem to pick it up (about a minute)", "Applying the new Wi-Fi settings", "Wi-Fi is updated"] };
const liveBox = id => document.getElementById("cu-live-" + id) || document.getElementById("rt-" + id);
function liveHtml(kind, st, sec, ssid, err) {
  const step = st === "done" ? 4 : st === "sent" ? 2 : 1, bad = st === "failed" || st === "timeout", mm = Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  const li = LIVE_STEPS[kind].map((t, i) => {
    const ok = i < step, cur = !bad && st !== "done" && i === step, x = bad && i === step;
    return `<li class="lv ${ok ? "ok" : cur ? "cur" : x ? "bad" : ""}"><span class="lv-d">${ok ? "✓" : x ? "✕" : cur ? `<i class="lv-spin"></i>` : i + 1}</span><span>${esc(t)}</span></li>`;
  }).join("");
  const head = st === "done" ? (kind === "reboot" ? "Restart finished" : "Wi-Fi changed") : st === "failed" ? "Could not finish" : st === "timeout" ? "Still waiting for the modem" : kind === "reboot" ? "Restarting your router" : "Changing your Wi-Fi";
  const note = st === "done" ? (kind === "wifi" ? `Join <b>${esc(ssid || "your Wi-Fi")}</b> on your phone or laptop${ssid ? " with the new password" : ""}.` : "Your internet is back.")
    : st === "failed" ? esc(err || "The modem did not accept it. Please try again.")
      : st === "timeout" ? "The modem has not checked in. It will apply this when it is back online. Check that it is powered on."
        : kind === "wifi" ? "Phones and laptops on this Wi-Fi will disconnect. Reconnect after about a minute." : "Internet and Wi-Fi are off for about 2 minutes. You do not need to do anything.";
  return `<div class="lv-box ${st === "done" ? "is-ok" : bad ? "is-bad" : ""}" role="status" aria-live="polite"><div class="lv-h"><b>${head}</b>${st === "done" || bad ? "" : `<span class="lv-t">${mm}</span>`}</div><ul class="lv-l">${li}</ul><p class="lv-n">${note}</p></div>`;
}
async function trackAction(id, kind, ssid) {
  if (!liveBox(id)) return false;
  if (!document.getElementById("lv-css")) { const c = document.createElement("style"); c.id = "lv-css"; c.textContent = `.lv-box{margin-top:14px;padding:14px 16px;border:1px solid #D6E0F5;background:#F4F7FF;border-radius:14px}.lv-box.is-ok{background:#F0FBF4;border-color:#BFE6CC}.lv-box.is-bad{background:#FFF4F2;border-color:#F3C6BE}.lv-h{display:flex;justify-content:space-between;gap:10px;font-size:15px}.lv-t{font-variant-numeric:tabular-nums;color:#5B6B8F;font-size:13px}.lv-l{list-style:none;margin:10px 0 6px;padding:0;display:grid;gap:8px}.lv{display:flex;gap:10px;align-items:center;font-size:14px;color:#6B7893}.lv.ok{color:#15803D}.lv.cur{color:#10234F;font-weight:700}.lv.bad{color:#B91C1C;font-weight:700}.lv-d{flex:none;width:22px;height:22px;border-radius:50%;border:1.5px solid currentColor;display:grid;place-items:center;font-size:12px;font-weight:700}.lv.ok .lv-d{background:#16A34A;border-color:#16A34A;color:#fff}.lv.bad .lv-d{background:#DC2626;border-color:#DC2626;color:#fff}.lv-spin{width:12px;height:12px;border:2px solid #1458F0;border-top-color:transparent;border-radius:50%;animation:lvs .8s linear infinite}@keyframes lvs{to{transform:rotate(360deg)}}.lv-n{margin:6px 0 0;font-size:13px;color:#4A5876}@media(prefers-reduced-motion:reduce){.lv-spin{animation:none}}`; document.head.appendChild(c); }
  const t0 = Date.now(); let st = "queued", err = "", n = 0;
  const paint = () => { const el = liveBox(id); if (el) el.innerHTML = liveHtml(kind, st, Math.round((Date.now() - t0) / 1000), ssid, err); return !!el; };
  paint();
  while (st !== "done" && st !== "failed" && st !== "timeout") {
    await new Promise(r => setTimeout(r, 1000)); if (!paint()) return true; n++;
    if (Date.now() - t0 > 25 * 60 * 1000) { st = "timeout"; break; }
    if (n % 4) continue;
    try { const a = (await API.deviceLog(id)).find(x => x.action === kind); if (a) { st = a.status === "done" ? "done" : a.status === "failed" ? "failed" : a.status === "sent" ? "sent" : "queued"; err = a.error || ""; } } catch (e) { /* keep waiting; the next poll tries again */ }
  }
  paint(); loadHist(id); if (st === "done") toast(kind === "reboot" ? "Restart finished. Your router is back." : "Wi-Fi changed.");
  return true;
}
/* ---------- modem (Gene) helpers ---------- */
const RX = v => v == null ? null : v >= -25 ? ["Good", "p-ok"] : v >= -27 ? ["Weak", "p-warn"] : ["Bad", "p-bad"];   // ONT optical RX power
const rxPill = d => { const r = d && d.acs ? RX(d.rx_dbm) : null; return r ? pill(`Fiber signal ${r[0]} · ${Number(d.rx_dbm).toFixed(1)} dBm`, r[1]) : ""; };
const upTxt = h => !h ? "just restarted" : h < 24 ? Math.round(h) + " h" : Math.floor(h / 24) + " d " + Math.round(h % 24) + " h";
const acsName = b => { const d = b.device; return !d || !d.acs ? null : d.acs === "partner" ? (b.tip ? b.tip.name.replace(/\s*\(demo TIP\)/, "") + "'s Gene" : "Partner's Gene") : "Connect Bhai Gene"; };
const actLine = a => `<div class="row small" style="gap:2px 8px;padding:4px 0;border-bottom:1px solid var(--line)"><b>${a.action === "reboot" ? "Restart" : a.action === "wifi" ? "Wi-Fi change" : esc(a.action)}</b>${a.detail ? `<span>${esc(a.detail)}</span>` : ""}<span class="muted">${a.status === "done" ? "Done" : a.status === "failed" ? "Failed" : "Waiting for the modem"}</span><span class="muted">${esc(a.by_name || "")} · ${fdt(a.created_at)}</span>${a.simulated ? `<span class="badge sim">Simulated</span>` : ""}</div>`;

/* ---------- contacts (call · WhatsApp · email · in-app chat) ---------- */
const ICON = {
  call: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>`,
  wa: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.2-.3-.2-.6-.4z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>`
};
const fmtPh = p => p && /^\d{10}$/.test(p) ? "+91 " + p.slice(0, 5) + " " + p.slice(5) : (p || "");
const ROLE_SHORT = { customer: "Customer", dsa: "Agent", tip: "Installer", admin: "Admin" };
function contactBtns(c, opt) {
  opt = opt || {}; if (!c) return "";
  const ph = c.phone && isPhone(c.phone) ? c.phone : null, txt = opt.text ? "?text=" + encodeURIComponent(opt.text) : "";
  return `<div class="cacts">${ph ? `<a class="cbtn" href="tel:+91${ph}">${ICON.call}Call</a><a class="cbtn wa" href="https://wa.me/91${ph}${txt}" target="_blank" rel="noopener" title="Chat or call on WhatsApp">${ICON.wa}WhatsApp</a>` : ""}${c.email ? `<a class="cbtn" href="mailto:${esc(c.email)}">${ICON.mail}Email</a>` : ""}${opt.thread ? `<button class="cbtn chatb" data-act="chat" data-thread="${esc(opt.thread)}" type="button">${ICON.chat}Chat</button>` : ""}</div>`;
}
function contactCard(label, c, opt) {
  opt = opt || {};
  if (!c) return `<div class="ccard"><span class="crole">${label}</span><span class="cln">${opt.empty || "Not assigned yet"}</span></div>`;
  return `<div class="ccard"><span class="crole">${label}</span><span class="cnm">${esc(c.name || "—")}${c.firm && c.firm !== c.name ? ` <span class="muted small">· ${esc(c.firm)}</span>` : ""}</span>
    <span class="cln">Mobile <b>${c.phone ? esc(fmtPh(c.phone)) : "—"}</b></span><span class="cln">Email <b>${c.email ? esc(c.email) : "not added"}</b></span>${opt.noBtns ? "" : contactBtns(c, opt)}${opt.extra || ""}</div>`;
}
const contactLine = (label, c, opt) => c ? `<div class="row small" style="gap:4px 10px"><span class="muted">${label}</span><b>${esc(c.name || "")}</b><span>${esc(fmtPh(c.phone))}</span>${c.email ? `<span class="muted">${esc(c.email)}</span>` : ""}${contactBtns(c, opt)}</div>` : "";
const WA_NOTE = `<p class="muted small" style="margin:-6px 0 16px">WhatsApp opens the chat in WhatsApp Desktop, WhatsApp Web or the phone app. Tap the call icon in that chat for a WhatsApp voice or video call. <b>Chat</b> works here any time and keeps one record for the customer, agent, installer and admin.</p>`;
const msgsHtml = ms => ms.length ? ms.map(m => {
  const mine = m.sender_id === me().id;
  return `<div class="msg${mine ? " mine" : ""}">${mine ? "" : `<span class="mwho">${esc(m.sender_name)} · ${ROLE_SHORT[m.sender_role] || ""}</span>`}${esc(m.body)}<time>${fdt(m.created_at)}</time></div>`;
}).join("")
  : `<p class="muted small" style="margin:auto;text-align:center">No messages yet. Write the first one below.</p>`;
function convoHtml(r) {
  const u = me(), t = r.thread;
  return `<div class="convo" data-convo="${esc(t.id)}"><div class="chd"><h3>${esc(t.title)}</h3><span class="muted small">${esc(t.sub)}</span>
    ${t.people.filter(p => p.phone !== u.phone).map(p => contactLine(ROLE_SHORT[p.role] || "", p)).join("")}</div>
    <div class="msgs" data-n="${r.messages.length}">${msgsHtml(r.messages)}</div>
    <form class="sendbar" data-form="chat-send" data-thread="${esc(t.id)}" novalidate><input name="body" maxlength="1000" placeholder="Type a message…" autocomplete="off" aria-label="Message"><button class="btn btn-primary btn-sm" type="submit">Send</button></form></div>`;
}
async function chatTab() {
  const ts = await API.myThreads();
  if (!ts.length) return `<div class="empty"><b>No chats yet.</b><p class="muted">Chats open for every connection request you are part of.</p></div>`;
  const sel = ts.some(t => t.id === S.thread) ? S.thread : ts[0].id; S.thread = sel;
  const r = await API.threadMessages(sel);
  return `${WA_NOTE}<div class="chat"><div class="threads">${ts.map(t => `<button class="thread" type="button" data-act="pick-thread" data-thread="${esc(t.id)}" aria-current="${t.id === sel}"><b>${esc(t.title)}${t.unread && t.id !== sel ? `<span class="unread">${t.unread}</span>` : ""}</b><small>${t.last ? esc((t.last.sender_id === me().id ? "You" : t.last.sender_name) + ": " + t.last.body) : esc(t.sub)}</small></button>`).join("")}</div>${convoHtml(r)}</div>`;
}
const unreadCount = async () => { try { return (await API.myThreads()).reduce((a, t) => a + t.unread, 0); } catch (e) { return 0; } };
async function openChat(thread) { const r = await guard(null, () => API.threadMessages(thread)); openModal(`<h2 style="margin-bottom:12px">Chat</h2>${convoHtml(r)}${WA_NOTE.replace("margin:-6px 0 16px", "margin:10px 0 0")}`, true); scrollChat(); }
function scrollChat() { document.querySelectorAll(".msgs").forEach(el => { el.scrollTop = el.scrollHeight; }); }
setInterval(async () => {   // keep an open chat fresh (new messages from the other side)
  const c = document.querySelector("[data-convo]"); if (!c || document.hidden || !me()) return;
  try { const r = await API.threadMessages(c.dataset.convo); const box = c.querySelector(".msgs"); if (box && Number(box.dataset.n) !== r.messages.length) { box.innerHTML = msgsHtml(r.messages); box.dataset.n = r.messages.length; box.scrollTop = box.scrollHeight; } } catch (e) { }
}, 10000);

/* ---------- header ---------- */
/* The header is a React component (components/Header.jsx). Legacy code calls this whenever the session changes. */
function renderHeader() {
  const u = me(); publish({ user: u ? { role: u.role, full_name: u.full_name } : null });
  try { if (u) localStorage.setItem("cb-role", u.role); else localStorage.removeItem("cb-role"); } catch (e) { }   // lets the pre-paint script in layout.js cover "/" for partners
}
/* QA: a full-screen "opening your dashboard" cover (CSS: html[data-entering]) from login, or from "/" for a signed-in partner,
   until the dashboard shell is on screen (DashboardShell removes it); a 10 s fallback never leaves it stuck. */
function entering(on) {
  const el = document.documentElement; clearTimeout(entering.t);
  if (on) { el.setAttribute("data-entering", ""); entering.t = setTimeout(() => el.removeAttribute("data-entering"), 10000); }
  else el.removeAttribute("data-entering");
}
const PARTNER_HOME = { dsa: 1, tip: 1, admin: 1 };

/* ---------- router ---------- */
function go(view, tab, opts) {
  if (S.view === "home" && { my: 1, dsa: 1, tip: 1, admin: 1 }[view] && me()) entering(true);   // home -> dashboard: cover, never the empty home page
  S.view = view; S.tab = tab || null; renderedKey = view + "/" + (tab || "");
  navigate(pathFor(view, S.tab), "push");
  renderHeader(); render(); updateCompareBar();
  if (opts && opts.scroll) { let tries = 0; const t = setInterval(() => { const el = document.getElementById(opts.scroll); if (el) { clearInterval(t); el.scrollIntoView({ behavior: "smooth", block: "start" }); } else if (++tries > 20) clearInterval(t); }, 60); }
  else window.scrollTo(0, 0);
}
/* Called by the route components (the page.js files under src/app) once the URL says which view to paint. Idempotent. */
async function show(view, tab) {
  await ready;
  const key = view + "/" + (tab || "");
  if (key === renderedKey) return;
  renderedKey = key; S.view = view; S.tab = tab || null;
  renderHeader(); await render(); updateCompareBar();
}
/* ---------- loading states: skeleton markup + top progress bar ---------- */
const sk = (cls, h) => `<span class="sk ${cls || ""}" ${h ? `style="height:${h}px"` : ""} aria-hidden="true"></span>`;
function skeleton(kind) {
  const kpis = `<div class="sk-row">${[1, 2, 3, 4].map(() => `<div class="sk-card">${sk("w40", 12)}${sk("w60", 28)}${sk("w50", 10)}</div>`).join("")}</div>`;
  if (kind === "home") return `<div class="wrap sk-page" role="status" aria-label="Loading">${sk("w70", 46)}${sk("w50", 18)}<div class="sk-two"><div class="sk-card tall">${sk("w50", 14)}${sk("", 44)}${sk("", 52)}${sk("w60", 14)}</div><div class="sk-card tall">${sk("", 220)}</div></div></div>`;
  return `<div class="wrap dash sk-page" role="status" aria-label="Loading">${sk("w40", 30)}${sk("w60", 14)}${kpis}<div class="sk-card">${sk("w30", 16)}${[1, 2, 3, 4].map(() => sk("", 38)).join("")}</div></div>`;
}
let busy = 0;
const track = p => { busy++; document.documentElement.classList.add("is-loading"); const done = () => { if (--busy <= 0) { busy = 0; document.documentElement.classList.remove("is-loading"); } }; return Promise.resolve(p).finally(done); };

/* Dashboard pages that are React components (src/components/<role>/). The app clears #app for them and announces
   every re-render (after pay, restart, chat…) so the React page reloads its data. */
const REACT_VIEWS = { my: t => !t || ["bookings", "devices"].includes(t), dsa: t => !t || ["home", "careplan", "customers", "tickets"].includes(t), tip: t => !t || ["home", "careplan", "leads"].includes(t), admin: t => !t || ["overview", "careplan", "customers"].includes(t) };
async function render() {
  const v = S.view;
  if (v !== "home") try { sessionStorage.removeItem("cb-site"); } catch (e) { }
  if (v === "home") {
    const u = me();
    let browse = false;   // "?site=1" (portal logo, footer logo, Go to website) opens the public homepage for this tab even when signed in as a partner
    try { if (/[?&]site=1\b/.test(location.search)) sessionStorage.setItem("cb-site", "1"); browse = sessionStorage.getItem("cb-site") === "1"; } catch (e) { }
    if (u && PARTNER_HOME[u.role] && !browse) {   // DSA / TIP / admin have no use for the plan search page: straight to their dashboard (no history entry)
      entering(true); S.view = ROLE_HOME[u.role]; S.tab = null; renderedKey = S.view + "/"; navigate(pathFor(S.view, null), "replace"); renderHeader(); return render();
    }
    entering(false);
    if (!app.children.length) app.innerHTML = skeleton("home"); return track(renderHome());
  }
  if (v === "speed") { app.innerHTML = ""; return; }   // the speed test is a React page (components/speed/SpeedTest.jsx)
  if (v === "router") { app.innerHTML = skeleton("dash"); clearServerTables(); return track(renderRouter().then(() => fillServerTables()).catch(e => { app.innerHTML = `<div class="wrap dash"><div class="empty"><b>Could not load router status.</b><p class="muted">${esc(errMsg(e))}</p><button class="btn btn-primary" data-act="reload" type="button">Try again</button></div></div>`; })); }
  const need = { my: "customer", dsa: "dsa", tip: "tip", admin: "admin" }[v];
  const u = me();
  if (!u || u.role !== need) {
    entering(false);
    app.innerHTML = `<div class="wrap"><div class="locked"><span class="eyebrow">${ROLE_NAME[need]} access</span><h1 style="font-size:28px">Log in as ${ROLE_NAME[need].toLowerCase()} to open this page</h1>
      <p class="muted">Each role sees only its own information. ${u ? `You are logged in as ${ROLE_NAME[u.role].toLowerCase()}.` : ""}</p>
      <button class="btn btn-primary" data-act="login" type="button">Log in</button></div></div>`;
    return;
  }
  if (v === "tip" && (S.tab === "bookings" || S.tab === "customers")) {   // QA 8: old Installs / Customers links open Leads, filtered
    try { sessionStorage.setItem("cb-tip-filter", S.tab === "bookings" ? "booked" : "installed"); } catch (e) { }
    window.dispatchEvent(new CustomEvent("cb:tip-filter")); S.tab = "leads"; renderedKey = "tip/leads"; navigate(pathFor("tip", "leads"), "replace");
  }
  if (REACT_VIEWS[v] && REACT_VIEWS[v](S.tab)) { app.innerHTML = ""; window.dispatchEvent(new CustomEvent("cb:render", { detail: { view: v, tab: S.tab } })); return; }
  app.innerHTML = skeleton("dash"); clearServerTables();
  try { await track(({ my: renderCustomer, dsa: renderDSA, tip: renderTIP, admin: renderAdmin }[v])()); fillServerTables(); scrollChat(); }
  catch (e) { app.innerHTML = `<div class="wrap dash"><div class="empty"><b>Could not load this page.</b><p class="muted">${esc(errMsg(e))}</p><button class="btn btn-primary" data-act="reload" type="button">Try again</button></div></div>`; }
}

/* =====================================================================
   1. CUSTOMER WEBSITE
   ===================================================================== */
async function renderHome() {
  let pins = []; try { pins = await API.popularPins(); } catch (e) { } S.pins = pins; S.product = S.product || "broadband"; await loadCities();
  app.innerHTML = `
  <section class="hero"><div class="wrap">
    <div class="hero-copy">
      <div class="hero-head"><span class="eyebrow">Broadband marketplace · <span id="hero-city">${esc(cityLive(S.city) ? cityName(S.city) : "Madhya Pradesh")}</span></span>
      <h1>Compare. Choose. Connect. <span>Care.</span></h1>
      <p class="lede">Fiber, Air Fiber, SIM, TV and OTT in one place. Compare what's available at your address side by side, and book in under a minute.</p></div>
      <form class="search" id="search" data-form="pin" novalidate>
        <div class="cityrow"><label for="city-pick">Your city</label><select id="city-pick" class="sel">${cityOptions(S.city)}</select></div>
        <div class="ptabs" role="tablist" aria-label="Product">${PTABS.map(([k, l]) => `<button type="button" role="tab" class="ptab" data-act="product" data-v="${k}" aria-selected="${S.product === k}">${l}</button>`).join("")}</div>
        <div id="searchBody">${searchBody()}</div>
      </form>
      <div class="hero-foot"><div class="trust"><span><i></i>Free for customers</span><span><i></i>BSNL TIPs, DSAs &amp; local ISPs</span><span><i></i>Installation tracked end to end</span></div>
      <div class="row" style="margin-top:16px"><button class="btn btn-ghost btn-sm hero-link" data-go="speed" type="button">Test your Wi-Fi speed →</button><button class="btn btn-sm hero-link hero-care" data-go="router" type="button">♥ Care plan →</button></div></div>
    </div>
    <div class="hero-story">
      <div class="hero-side">${(document.getElementById("tpl-story") || { innerHTML: "" }).innerHTML}
      <div class="carecard"><span class="cc-tag">★ Featured</span>
        <div class="cc-top"><span class="cc-ico"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/></svg></span><div class="cc-t"><b>Connect Bhai Care plan</b><small>Live modem status, restart and Wi-Fi control, right from your phone.</small></div></div>
        <div class="cc-panel"><svg class="cc-router" viewBox="0 0 120 84" aria-hidden="true" focusable="false"><g fill="none" stroke="#22D3EE" stroke-width="5" stroke-linecap="round"><path class="cc-w1" d="M46 22c9-8 19-8 28 0"/><path class="cc-w2" d="M38 11c14-12 30-12 44 0"/></g><path d="M34 52 28 32M86 52l6-20" stroke="#2F7BFF" stroke-width="6" stroke-linecap="round"/><rect x="12" y="50" width="96" height="28" rx="12" fill="#2F7BFF"/><circle cx="32" cy="64" r="4" fill="#4ADE80"/><circle cx="46" cy="64" r="4" fill="#fff"/><circle cx="60" cy="64" r="4" fill="#fff"/><rect x="74" y="60" width="26" height="7" rx="3.5" fill="#fff" opacity=".35"/></svg><ul class="cc-rows"><li><span>Modem</span><b class="cc-ok"><i></i>Online</b></li><li><span>Fiber signal</span><b><em class="cc-bars"><u></u><u></u><u></u><u></u></em>Strong</b></li><li><span>Speed</span><b><span class="cc-speed" aria-hidden="true"></span><span class="cc-sr">98 Mbps</span></b></li></ul></div>
        <ul class="cc-feats"><li><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg><span>Restart</span></li><li><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/></svg><span>Wi-Fi name</span></li><li><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Password</span></li><li><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg><span>Speed test</span></li></ul>
        <button class="cc-cta" data-go="router" type="button">Explore Care plan <span aria-hidden="true">→</span></button></div></div>
      <p class="meet"><b>Meet Bhai</b>, your internet guide. He finds the plans, compares them, and stays with you till the router says <i>Connected</i>.</p>
    </div>
  </div></section>
  <section class="sec" id="results" ${S.results ? "" : "hidden"}><div class="wrap" id="resultsWrap"></div></section>
  <section class="sec" id="how" style="padding-top:${S.results ? 0 : 56}px"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">How it works</span><h2>From search to a working connection</h2></div>
    <div class="steps3">
      <div class="step"><div class="step-top"><svg class="step-art" viewBox="0 0 240 104" role="img" aria-hidden="true" focusable="false"><rect x="14" y="14" width="212" height="76" rx="12" style="fill:var(--surface);stroke:var(--line)"/><path d="M14 40h212M14 64h212M70 14v76M130 14v76M186 14v76" style="stroke:var(--line);stroke-width:1"/><path d="M96 62c14-6 26 8 40 0s26-14 44-6" fill="none" style="stroke:var(--sky);stroke-width:3;stroke-linecap:round"/><path d="M120 22c-9 0-16 7-16 16 0 12 16 28 16 28s16-16 16-28c0-9-7-16-16-16z" style="fill:var(--blue)"/><circle cx="120" cy="38" r="6" style="fill:var(--surface)"/><circle cx="178" cy="62" r="15" style="fill:var(--surface);stroke:var(--blue);stroke-width:4"/><path d="M189 73l14 14" style="stroke:var(--blue);stroke-width:5;stroke-linecap:round"/></svg><span class="step-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span></div><span class="n">01 / Compare</span><h3>Search your PIN code</h3><p>See only the plans that are actually offered in your area, with speed, price, data and OTT/TV benefits.</p></div>
      <div class="step"><div class="step-top"><svg class="step-art" viewBox="0 0 240 104" role="img" aria-hidden="true" focusable="false"><rect x="34" y="16" width="172" height="72" rx="12" style="fill:var(--surface);stroke:var(--line)"/><rect x="48" y="30" width="62" height="9" rx="4.5" style="fill:var(--sky)"/><rect x="48" y="46" width="94" height="7" rx="3.5" style="fill:var(--line)"/><rect x="48" y="60" width="74" height="7" rx="3.5" style="fill:var(--line)"/><rect x="150" y="56" width="42" height="22" rx="11" style="fill:var(--blue)"/><path d="M162 67l6 6 11-12" fill="none" style="stroke:var(--surface);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round"/><circle cx="196" cy="30" r="13" style="fill:var(--ok)"/><path d="M190 30l4 4 8-9" fill="none" style="stroke:#fff;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round"/></svg><span class="step-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span></div><span class="n">02 / Choose</span><h3>Request a connection</h3><p>Pick a plan and share your details. You get a request number immediately.</p></div>
      <div class="step"><div class="step-top"><svg class="step-art" viewBox="0 0 240 104" role="img" aria-hidden="true" focusable="false"><path d="M20 90h200" style="stroke:var(--line);stroke-width:2"/><path d="M34 90V52l36-26 36 26v38z" style="fill:var(--surface);stroke:var(--blue);stroke-width:3;stroke-linejoin:round"/><rect x="60" y="64" width="20" height="26" rx="3" style="fill:var(--sky)"/><path d="M106 84h40" style="stroke:var(--sky);stroke-width:3;stroke-dasharray:2 7;stroke-linecap:round"/><rect x="146" y="66" width="62" height="22" rx="7" style="fill:var(--blue)"/><circle cx="160" cy="77" r="3" style="fill:var(--ok)"/><circle cx="172" cy="77" r="3" style="fill:#fff"/><circle cx="184" cy="77" r="3" style="fill:#fff"/><path d="M166 60c8-8 20-8 28 0M171 54c11-11 25-11 36 0" fill="none" style="stroke:var(--blue);stroke-width:3;stroke-linecap:round"/><path d="M178 20v26" style="stroke:var(--blue);stroke-width:3" opacity="0"/></svg><span class="step-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/></svg></span></div><span class="n">03 / Connect</span><h3>Track installation</h3><p>An assigned TIP calls you, books the installation and updates every step in your dashboard.</p></div>
      <div class="step"><div class="step-top"><svg class="step-art" viewBox="0 0 240 104" role="img" aria-hidden="true" focusable="false"><path d="M120 12l44 16v28c0 22-18 34-44 42-26-8-44-20-44-42V28z" style="fill:var(--surface);stroke:var(--blue);stroke-width:3.5;stroke-linejoin:round"/><path d="M120 70c-14-9-22-16-22-25 0-7 5-12 11-12 5 0 9 3 11 7 2-4 6-7 11-7 6 0 11 5 11 12 0 9-8 16-22 25z" style="fill:var(--blue)"/><path d="M34 40c10-9 22-9 32 0M28 32c14-13 30-13 44 0" fill="none" style="stroke:var(--sky);stroke-width:3.5;stroke-linecap:round"/><circle cx="50" cy="52" r="3.5" style="fill:var(--sky)"/><path d="M174 40c10-9 22-9 32 0M168 32c14-13 30-13 44 0" fill="none" style="stroke:var(--sky);stroke-width:3.5;stroke-linecap:round"/><circle cx="190" cy="52" r="3.5" style="fill:var(--sky)"/></svg><span class="step-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/></svg></span></div><span class="n">04 / Care</span><h3>Stay looked after</h3><p>Check your modem status, restart it and change your Wi-Fi from your dashboard, and raise a ticket whenever you need help.</p></div>
    </div>
  </div></section>
  ${citiesSection()}
  <section class="sec" id="router" style="padding-top:0"><div class="wrap">
    <div class="card tr-hero">
      <div style="min-width:0"><span class="eyebrow">Care plan · Gene, your personal assistant</span><h2 style="font-size:clamp(24px,3.2vw,32px);margin:8px 0">Connect Bhai Care plan: looking after your internet</h2>
        <p class="muted">With the Care plan and Gene, your personal assistant, your modem is watched 24x7. See the Online/Offline status and fiber signal, change your Wi-Fi name or password, restart the modem and test the line speed, all from the app. If the line goes down, your installer will know before you call.</p>
        <div class="row" style="margin-top:14px"><button class="btn btn-primary" data-go="router" type="button">Open my Care plan</button><button class="btn btn-ghost" data-go="speed" type="button">Wi-Fi speed test</button></div></div>
      <ol class="trsteps"><li><b>Installer links the modem</b><span>Scans the ONT serial; the modem reports to the installer's or Connect Bhai's Gene</span></li><li><b>Modem reports every 5 minutes</b><span>Status, fiber signal, Wi-Fi and restarts</span></li><li><b>You control it in the app</b><span>Restart, Wi-Fi change, line speed test</span></li></ol>
    </div>
  </div></section>
  <section class="sec" id="partners" style="padding-top:0"><div class="wrap split">
    <div class="card">
      <span class="eyebrow">For DSAs &amp; TIPs</span>
      <h2 style="font-size:28px;margin:8px 0 6px">Grow with Connect Bhai</h2>
      <p class="muted">Join as a Direct Selling Agent (DSA) or a Telecom Infrastructure Partner (TIP). Admin verifies every DSA and TIP before leads are assigned.</p>
      <ul class="ticks">
        <li>Verified leads from your service PIN codes</li>
        <li>Follow-ups, installation status and commissions in one portal</li>
        <li>Transparent commission approval and payment records</li>
      </ul>
    </div>
    <form class="card stack" data-form="partner-apply" novalidate>
      <h3>DSA / TIP application</h3>
      <div class="grid2">
        ${field("pa-type", "I am a", `<select id="pa-type" name="type"><option value="dsa">Direct Selling Agent (DSA)</option><option value="tip">Telecom Infrastructure Partner (TIP)</option></select>`)}
        ${field("pa-name", "Full name", `<input id="pa-name" name="name" autocomplete="name">`)}
        ${field("pa-firm", "Firm / shop name", `<input id="pa-firm" name="firm" autocomplete="organization">`)}
        ${field("pa-phone", "Mobile number", `<input id="pa-phone" name="phone" inputmode="numeric" maxlength="16" autocomplete="tel-national">`)}
      </div>
      ${field("pa-email", "Email", `<input id="pa-email" name="email" type="email" autocomplete="email">`)}
      ${field("pa-city", "Your city", `<select id="pa-city" name="city_id">${cityOptions(S.city, true)}</select>`, "DSAs and TIPs can register before we launch in their city.")}
      ${field("pa-pins", "PIN codes you serve", `<input id="pa-pins" name="pincodes" placeholder="452010, 452016">`, "Separate with commas")}
      ${REST ? `<h3 style="margin:14px 0 4px">KYC and bank details</h3>
      ${field("pa-addr", "Address", `<input id="pa-addr" name="address" autocomplete="street-address">`)}
      ${field("pa-pin1", "Your PIN code", `<input id="pa-pin1" name="pincode" inputmode="numeric" maxlength="6">`)}
      ${field("pa-aadhaar", "Aadhaar number", `<input id="pa-aadhaar" name="aadhaar" inputmode="numeric" maxlength="14" placeholder="1234 5678 9012">`, "Stored encrypted; only the last 4 digits are ever shown.")}
      ${field("pa-pan", "PAN", `<input id="pa-pan" name="pan" maxlength="10" placeholder="ABCDE1234F" style="text-transform:uppercase">`)}
      ${field("pa-gst", "GSTIN (optional)", `<input id="pa-gst" name="gst_number" maxlength="15" style="text-transform:uppercase">`)}
      ${field("pa-bank", "Bank name", `<input id="pa-bank" name="bank_name">`)}
      ${field("pa-acct", "Bank account number", `<input id="pa-acct" name="bank_account" inputmode="numeric" maxlength="20">`)}
      ${field("pa-ifsc", "IFSC", `<input id="pa-ifsc" name="bank_ifsc" maxlength="11" placeholder="SBIN0001234" style="text-transform:uppercase">`)}
      <h3 style="margin:14px 0 4px">Documents</h3><p class="muted small">JPG, PNG or PDF, up to 5 MB each. Stored privately; only Connect Bhai admin can open them.</p>
      ${field("pa-doc-aadhaar", "Aadhaar card (photo or PDF)", `<input id="pa-doc-aadhaar" name="doc_aadhaar" type="file" accept=".jpg,.jpeg,.png,.pdf">`)}
      ${field("pa-doc-pan", "PAN card", `<input id="pa-doc-pan" name="doc_pan" type="file" accept=".jpg,.jpeg,.png,.pdf">`)}
      ${field("pa-doc-bank", "Bank proof (cancelled cheque or passbook page)", `<input id="pa-doc-bank" name="doc_bank" type="file" accept=".jpg,.jpeg,.png,.pdf">`)}` : ""}
      <p class="notice info" id="pa-fee">${PA_DSA_NOTE}</p>
      <button class="btn btn-primary" type="submit" id="pa-submit">Submit application</button>
    </form>
  </div></section>`;
  if (S.results) renderResults();
  API.getSettings().then(st => { if (st) { paTipNote = `TIP registration fee, paid online when you submit: <b>${inr(st.registration_fee_tip)}</b> plus ${st.gst_percent || 18}% GST (UPI, card, net banking or wallet). <b>DSA registration is free</b>: a DSA earns a commission on every installed lead.`; syncPartnerType(); } }).catch(() => { });
}
/* DSA registration is free: a DSA sees no fee or payment wording. Only a TIP sees the registration fee note and the pay button. */
const PA_DSA_NOTE = `<b>DSA registration is free.</b> A DSA earns a commission on every installed lead.`;
let paTipNote = "The registration fee (plus GST) is paid online when you submit this form.";
function syncPartnerType() {
  const t = document.getElementById("pa-type"), n = document.getElementById("pa-fee"), b = document.getElementById("pa-submit");
  if (!t || !n || !b) return;
  const tip = t.value === "tip";
  n.innerHTML = tip ? paTipNote : PA_DSA_NOTE;
  b.textContent = tip ? "Submit and pay registration fee" : "Submit application";
}

/* ---------- products on the customer site ---------- */
const PTABS = [["broadband", "Fiber"], ["air_fiber", "Air Fiber"], ["sim", "SIM"], ["tv", "TV"], ["ott", "OTT"]];
const catFor = prod => prod === "broadband" ? "fiber" : prod === "sim" ? (S.simType === "postpaid" ? "sim_postpaid" : "sim_prepaid") : prod;
const isSpeedCat = c => ["fiber", "air_fiber"].includes(c);
function searchBody() {
  if (S.city && cityList().length && !cityLive(S.city)) return soonBody();
  const pins = (S.pins || []).filter(p => !p.city_id || !S.city || p.city_id === S.city);
  const pinUI = (title, sub) => `<h2>${title}</h2><p class="muted small" style="margin-top:2px">${sub}</p>
    <div class="pinrow"><input id="pin" name="pin" inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="452010" value="${esc(S.pin)}" aria-label="PIN code"><button class="btn btn-primary" type="submit">Search</button></div>
    <div class="pinacts"><button class="linkbtn small" data-act="use-location" type="button">Use my current location</button><button class="resetbtn" data-act="reset-pin" type="button" aria-label="Reset PIN code search"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>Reset</button></div>
    <p class="ferr" id="pin-err" style="margin-top:6px"></p>
    <div class="chips" style="margin-top:6px">${pins.map(p => `<button type="button" class="chip" data-act="pick-pin" data-pin="${p.pin}" aria-pressed="${S.pin === p.pin}">${p.pin} · ${esc(p.area)}</button>`).join("")}</div>`;
  if (S.product === "broadband") return pinUI("Check fiber plans at your pincode", "Enter your 6-digit PIN code");
  if (S.product === "air_fiber") return pinUI("Book Air Fiber", "Wireless home internet, no fiber cable needed. Check availability at your PIN code.");
  if (S.product === "tv") return pinUI("TV channel packs", "IPTV over your fiber line. Check what's available at your PIN code.");
  if (S.product === "sim") return `<h2>Book a SIM online</h2><p class="muted small" style="margin-top:2px">Get a new number or keep your number and switch (port). Delivered to your door in Indore with e-KYC.</p>
    <div class="chips" style="margin:12px 0">${[["prepaid", "Prepaid"], ["postpaid", "Postpaid"]].map(([k, l]) => `<button type="button" class="chip" data-act="sim-type" data-v="${k}" aria-pressed="${(S.simType || "prepaid") === k}">${l}</button>`).join("")}</div>
    <button class="btn btn-primary btn-block" type="submit">Show SIM plans</button>`;
  return `<h2>OTT packs</h2><p class="muted small" style="margin-top:2px">Streaming app bundles you can add to any connection.</p><button class="btn btn-primary btn-block" type="submit" style="margin-top:12px">Show OTT packs</button>`;
}
/* Clears the PIN, its results and the compare list, and puts the search card back to its empty state. */
function resetSearch() {
  S.pin = ""; S.areas = []; S.results = null; S.compare = [];
  const r = $("#results"); if (r) r.hidden = true;
  const how = $("#how"); if (how) how.style.paddingTop = "56px";
  renderSearchCard(); updateCompareBar();
}
function renderSearchCard() {
  const b = document.getElementById("searchBody"); if (b) b.innerHTML = searchBody();
  document.querySelectorAll('[data-act="product"]').forEach(x => x.setAttribute("aria-selected", x.dataset.v === S.product));
}
async function showCatalog() {
  const cat = catFor(S.product); S.pin = ""; S.areas = []; S.compare = [];
  try { S.results = await API.catalog(cat); } catch (e) { toast(errMsg(e), true); return; }
  S.resultCat = cat; resetFilters(); $("#results").hidden = false; $("#how").style.paddingTop = "0";
  renderResults(); updateCompareBar(); $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}
const budgetOf = p => (p.price_ex_gst != null ? Number(p.price_ex_gst) : Number(p.price_monthly));
function resetFilters() { const maxP = Math.max(300, ...(S.results || []).map(budgetOf)); S.f = { speed: 0, price: Math.ceil(maxP / 100) * 100, ott: false, tv: false, providers: [], sort: "price" }; }
async function searchPin(pin) {
  const err = $("#pin-err");
  if (!isPin(pin)) { if (err) err.textContent = "Enter a valid 6-digit PIN code."; $("#pin") && $("#pin").focus(); return; }
  if (err) err.textContent = "";
  S.pin = pin; S.compare = [];
  const cat = catFor(S.product);
  try { const r = await API.searchPlans(pin, cat); S.results = r.plans; S.areas = r.areas; S.resultCat = cat; }
  catch (e) { toast(errMsg(e), true); return; }
  resetFilters();
  document.querySelectorAll('[data-act="pick-pin"]').forEach(b => b.setAttribute("aria-pressed", b.dataset.pin === pin));
  $("#results").hidden = false; $("#how").style.paddingTop = "0";
  renderResults(); updateCompareBar();
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}
function filtered() {
  const f = S.f;
  let list = (S.results || []).filter(p => (p.speed_mbps || 0) >= f.speed && budgetOf(p) <= f.price && (!f.ott || p.ott_apps.length) && (!f.tv || p.tv_channels > 0) && (!f.providers.length || f.providers.includes(p.provider_id)));
  const sorters = { price: (a, b) => a.price_monthly - b.price_monthly, speed: (a, b) => (b.speed_mbps || 0) - (a.speed_mbps || 0), value: (a, b) => a.price_monthly / (a.speed_mbps || 1) - b.price_monthly / (b.speed_mbps || 1) };
  return list.sort(sorters[f.sort] || sorters.price);
}
function renderResults() {
  const w = $("#resultsWrap"); if (!w) return;
  const all = S.results || [], cat = S.resultCat || "fiber", speedy = isSpeedCat(cat), sim = cat.startsWith("sim");
  const where = S.pin ? `PIN ${esc(S.pin)}${S.areas.length ? " · " + esc(S.areas.join(", ")) : ""} · ${CATS[cat]}` : CATS[cat];
  if (!all.length) {
    w.innerHTML = `<div class="empty"><span class="eyebrow">${where}</span><h2 style="font-size:24px">${S.pin ? `No ${esc(CATS[cat])} plans at this PIN code yet` : "No plans listed yet"}</h2>
      <p class="muted">Leave your details and we will call you as soon as it is available at your address.</p>
      <div class="row" style="justify-content:center"><button class="btn btn-primary" data-act="request" data-plan="" type="button">Request a callback</button>${S.pin ? `<button class="btn btn-ghost" data-act="focus-city" type="button">Not in ${esc(cityName(S.city))}? Choose your city</button>` : ""}</div></div>`;
    return;
  }
  const provs = [...new Map(all.map(p => [p.provider_id, p.provider])).values()];
  const maxP = Math.ceil(Math.max(...all.map(budgetOf)) / 100) * 100;
  const list = filtered();
  w.innerHTML = `
  <div class="reshead"><div><span class="eyebrow">${where}</span><h3 style="margin-top:4px">${list.length} of ${all.length} ${sim ? "SIM plans" : cat === "ott" ? "OTT packs" : "plans"} match</h3></div>
    <div class="row">${sim ? `<div class="chips">${[["prepaid", "Prepaid"], ["postpaid", "Postpaid"]].map(([k, l]) => `<button type="button" class="chip" data-act="sim-type-results" data-v="${k}" aria-pressed="${(S.simType || "prepaid") === k}">${l}</button>`).join("")}</div>` : ""}
    <label class="row small" style="font-weight:700">Sort by <select class="sel" id="f-sort" data-filter="sort">
      <option value="price" ${S.f.sort === "price" ? "selected" : ""}>Price: low to high</option>${speedy ? `<option value="speed" ${S.f.sort === "speed" ? "selected" : ""}>Speed: high to low</option><option value="value" ${S.f.sort === "value" ? "selected" : ""}>Best value (₹ per Mbps)</option>` : ""}</select></label></div></div>
  ${REST ? "" : `<div class="notice" style="margin-bottom:16px">Demo plans from sample providers, shown for testing only. They are not real offers. Final price is confirmed by the provider at booking.</div>`}
  <div class="results">
    <aside class="filters" aria-label="Filters">
      <div class="row"><h3>Filters</h3><span class="spacer"></span><button class="linkbtn small" data-act="reset-filters" type="button">Reset</button></div>
      ${speedy ? `<div class="fgroup"><label class="lbl">Minimum speed</label><div class="chips">${[0, 50, 100, 200, 300].map(s => `<button type="button" class="chip" data-act="f-speed" data-v="${s}" aria-pressed="${S.f.speed === s}">${s ? s + "+ Mbps" : "Any"}</button>`).join("")}</div></div>` : ""}
      <div class="fgroup"><label class="lbl" for="f-price">Max price${REST ? " (before GST)" : ""}: <span id="f-price-v">${inr(S.f.price)}</span></label><input type="range" id="f-price" data-filter="price" min="100" max="${maxP}" step="50" value="${Math.min(S.f.price, maxP)}"></div>
      ${cat !== "ott" ? `<div class="fgroup"><label class="lbl">Benefits</label>
        <label class="check"><input type="checkbox" id="f-ott" data-filter="ott" ${S.f.ott ? "checked" : ""}> Includes OTT apps</label>
        ${speedy ? `<label class="check"><input type="checkbox" id="f-tv" data-filter="tv" ${S.f.tv ? "checked" : ""}> Includes TV channels</label>` : ""}</div>` : ""}
      <div class="fgroup"><label class="lbl">Provider</label>${provs.map(p => `<label class="check"><input type="checkbox" data-filter="prov" value="${p.id}" ${S.f.providers.includes(p.id) ? "checked" : ""}> ${esc(p.name)}</label>`).join("")}</div>
    </aside>
    <div>${list.length ? `<div class="plans">${list.map(planCard).join("")}</div>` : `<div class="empty"><b>No plans match these filters.</b><button class="btn btn-ghost btn-sm" data-act="reset-filters" type="button">Reset filters</button></div>`}
      <p class="muted small" style="margin-top:14px">Can't decide? <button class="linkbtn" data-act="request" data-plan="" type="button">Request a callback</button> and a TIP will help you choose.</p></div>
  </div>`;
}
const priceUnit = p => p.category === "sim_prepaid" ? `/${p.validity_days} days` : "/month";
function planBig(p) {
  if (isSpeedCat(p.category)) return Number(p.speed_mbps) > 0 ? `<b>${p.speed_mbps}</b><span>Mbps</span>` : `<b>—</b><span>Mbps</span>`;
  if (p.category === "tv") return `<b>${p.tv_channels}</b><span>channels</span>`;
  if (p.category === "ott") return `<b>${p.ott_apps.length}</b><span>apps</span>`;
  return p.data_per_day_gb ? `<b>${p.data_per_day_gb}</b><span>GB/day</span>` : `<b>${p.data_limit_gb || "∞"}</b><span>GB/month</span>`;
}
function planFacts(p) {
  const inst = `<div><span>Installation</span><b>${Number(p.install_charge) ? inr(p.install_charge) : "Free"}</b></div>`;
  if (isSpeedCat(p.category)) return `<div><span>Data</span><b>${dataTxt(p)}</b></div>${inst}<div><span>TV channels</span><b>${p.tv_channels ? p.tv_channels + "+" : "—"}</b></div>`;
  if (p.category === "tv") return `<div><span>Validity</span><b>${p.validity_days} days</b></div>${inst}`;
  if (p.category === "ott") return `<div><span>Validity</span><b>${p.validity_days} days</b></div>`;
  return `<div><span>Validity</span><b>${p.validity_days} days</b></div><div><span>Calls</span><b>${esc(p.voice || "—")}</b></div><div><span>SMS</span><b>${p.sms_per_day ? p.sms_per_day + "/day" : "—"}</b></div>`;
}
const ctaFor = p => p.category.startsWith("sim") ? "Book SIM" : p.category === "ott" ? "Get this pack" : p.category === "air_fiber" ? "Book Air Fiber" : "Request connection";
function planCard(p) {
  const sel = S.compare.includes(p.id);
  return `<article class="plan ${sel ? "sel" : ""}">
    ${demoBadge(p.is_demo)}
    <div class="prov">${plogo(p.provider)}<span>${esc(p.provider.name)}<br><span class="muted small" style="font-weight:600">${esc(CATS[p.category] || "")}</span></span></div>
    <div class="pname">${esc(p.name)}</div>
    <div class="row" style="justify-content:space-between;align-items:flex-end"><div class="speed">${planBig(p)}</div><div class="price">${inr(p.price_monthly)}<small>${priceUnit(p)}</small></div></div>
    <div class="facts">${planFacts(p)}</div>
    <div class="ott">${p.ott_apps.length ? p.ott_apps.map(o => `<em>${esc(o)}</em>`).join("") : `<span class="muted small">No OTT apps included</span>`}</div>
    <div class="acts"><label class="check small"><input type="checkbox" data-act="toggle-compare" data-id="${p.id}" ${sel ? "checked" : ""}> Compare</label><button class="btn btn-primary btn-sm" data-act="request" data-plan="${p.id}" type="button">${ctaFor(p)}</button></div>
  </article>`;
}
function updateCompareBar() { const n = S.compare.length; publish({ compareCount: n, showCompare: S.view === "home" && n > 0 }); }
function openCompare() {
  const ps = S.compare.map(id => S.results.find(p => p.id === id)).filter(Boolean);
  if (ps.length < 2) { toast("Select at least 2 plans to compare."); return; }
  const speedy = ps.some(p => isSpeedCat(p.category)), sim = ps.some(p => p.category.startsWith("sim"));
  const rows = [["Provider", p => esc(p.provider.name)], ...(speedy ? [["Speed", p => `<b>${p.speed_mbps || "—"} Mbps</b>`]] : []), ["Price", p => `<b>${inr(p.price_monthly)}</b>${priceUnit(p)}`],
  ...(speedy ? [["₹ per Mbps", p => p.speed_mbps ? "₹" + (p.price_monthly / p.speed_mbps).toFixed(1) : "—"]] : []),
  ...(sim ? [["Data", p => p.data_per_day_gb ? p.data_per_day_gb + " GB/day" : dataTxt(p)], ["Validity", p => p.validity_days + " days"], ["Calls", p => esc(p.voice || "—")], ["SMS", p => p.sms_per_day ? p.sms_per_day + "/day" : "—"]] : [["Data", dataTxt], ["Installation", p => Number(p.install_charge) ? inr(p.install_charge) : "Free"]]),
  ["OTT apps", p => p.ott_apps.length ? esc(p.ott_apps.join(", ")) : "—"], ...(sim ? [] : [["TV channels", p => p.tv_channels ? p.tv_channels + "+" : "—"]])];
  openModal(`<h2>Compare plans</h2><p class="muted small" style="margin:4px 0 14px">${S.pin ? "PIN " + esc(S.pin) + " · " : ""}demo data</p>
    <div class="tbl-wrap"><table class="tbl" style="min-width:${180 + ps.length * 170}px"><thead><tr><th></th>${ps.map(p => `<th>${esc(p.name)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(([l, fn]) => `<tr><td class="muted" style="font-weight:700">${l}</td>${ps.map(p => `<td>${fn(p)}</td>`).join("")}</tr>`).join("")}
    <tr><td></td>${ps.map(p => `<td><button class="btn btn-primary btn-sm" data-act="request" data-plan="${p.id}" type="button">Choose</button></td>`).join("")}</tr></tbody></table></div>`, true);
}
const planSummary = p => !p ? "" : isSpeedCat(p.category) ? joinDot(speedTxt(p), dataTxt(p)) : p.category === "tv" ? (p.tv_channels ? `${p.tv_channels} channels` : "") : p.category === "ott" ? ((p.ott_apps || []).length ? `${p.ott_apps.length} apps` : "") : joinDot(p.data_per_day_gb ? p.data_per_day_gb + " GB/day" : (p.data_limit_gb || "∞") + " GB", p.validity_days ? `${p.validity_days} days` : "");
function openRequest(planId) {
  const u = me(), p = planId ? (S.results || []).find(x => x.id === planId) : null;
  if (p && p.category.startsWith("sim")) return openSimBooking(p);
  const product = p ? productOf(p.category) : (S.product || "broadband");
  const air = product === "air_fiber";
  openModal(`<h2>${p ? (product === "ott" ? "Get this OTT pack" : air ? "Book Air Fiber" : "Request this connection") : "Request a callback"}</h2>
   ${p ? `<div class="item" style="margin:12px 0"><div class="ih">${plogo(p.provider)}<h3>${esc(p.provider.name)} · ${esc(p.name)}</h3>${demoBadge(p.is_demo)}</div><div class="meta"><span><b>${esc(planSummary(p))}</b></span><span><b>${inr(p.price_monthly)}</b>${priceUnit(p)}</span></div></div>` : `<p class="muted" style="margin:6px 0 12px">Share your details and a TIP will call you to help choose${product !== "broadband" ? " " + esc(PRODUCT_NAME[product]) : " a plan"}.</p>`}
   ${air ? `<p class="notice info" style="margin-bottom:12px">Air Fiber uses a small outdoor unit and an indoor Wi-Fi router. The installer checks the signal at your home before installing.</p>` : ""}
   <form class="stack" data-form="request" data-plan="${planId || ""}" data-product="${product}" novalidate>
     <div class="grid2">
       ${field("rq-name", "Full name", `<input id="rq-name" name="name" autocomplete="name" value="${esc(u && u.role === "customer" ? u.full_name : "")}">`)}
       ${field("rq-phone", "Mobile number", `<input id="rq-phone" name="phone" inputmode="numeric" maxlength="16" autocomplete="tel-national" value="${esc(u && u.role === "customer" ? u.phone || "" : "")}">`)}
       ${field("rq-pin", "PIN code", `<input id="rq-pin" name="pincode" inputmode="numeric" maxlength="6" value="${esc(S.pin)}">`)}
       ${field("rq-area", "Area / colony", `<input id="rq-area" name="area" value="${esc(S.areas[0] || "")}">`)}
     </div>
     ${field("rq-email", "Email (optional)", `<input id="rq-email" name="email" type="email" autocomplete="email" value="${esc(u && u.role === "customer" ? u.email || "" : "")}">`, "Your agent, installer and admin can see it to send bills and updates.")}
     ${field("rq-addr", "Address", `<input id="rq-addr" name="address" autocomplete="street-address" placeholder="House no., street, landmark">`)}
     ${product !== "ott" ? `<div class="row small"><button class="btn btn-soft btn-sm" data-act="pin-location" type="button">Pin my exact location</button><span class="muted" id="rq-loc">Helps the installer find your home.</span></div>
     ${field("rq-date", "Preferred installation date (optional)", `<input id="rq-date" name="preferred_date" type="date" min="${todayISO()}">`)}` : ""}
     <div class="field" data-f="rq-consent"><label class="check"><input type="checkbox" id="rq-consent" name="consent"> I agree to be contacted by Connect Bhai and its DSAs and TIPs about this request.</label><span class="ferr" id="rq-consent-err"></span></div>
     ${!u ? `<p class="muted small">We'll send an OTP to this number on WhatsApp to confirm it. This also creates your account so you can track the request.</p>` : ""}
     <button class="btn btn-primary btn-block" type="submit">${u ? "Submit request" : "Verify on WhatsApp and submit"}</button>
   </form>`);
}
function openSimBooking(p) {
  const u = me(), post = p.category === "sim_postpaid";
  openModal(`<h2>Book your SIM</h2>
   <div class="item" style="margin:12px 0"><div class="ih">${plogo(p.provider)}<h3>${esc(p.provider.name)} · ${esc(p.name)}</h3>${demoBadge(p.is_demo)}</div><div class="meta"><span>${post ? "Postpaid" : "Prepaid"}</span><span><b>${esc(planSummary(p))}</b></span><span><b>${inr(p.price_monthly)}</b>${priceUnit(p)}</span></div></div>
   <form class="stack" data-form="request" data-plan="${p.id}" data-product="sim" data-simtype="${post ? "postpaid" : "prepaid"}" novalidate>
     <div class="field"><label>What do you need?</label><div class="chips">
       <label class="chip"><input type="radio" name="sim_conn" value="new" checked style="margin-right:6px">New number</label>
       <label class="chip"><input type="radio" name="sim_conn" value="port" style="margin-right:6px">Keep my number (port / MNP)</label></div></div>
     ${field("sm-for", "This SIM is for", `<select id="sm-for" name="for_whom"><option value="self">Myself</option><option value="family">A family member</option><option value="known">Someone I know</option></select>`)}
     <div class="grid2">
       ${field("rq-name", "Full name (as on Aadhaar)", `<input id="rq-name" name="name" autocomplete="name" value="${esc(u && u.role === "customer" ? u.full_name : "")}">`)}
       ${field("rq-phone", "Your WhatsApp number (for OTP & delivery)", `<input id="rq-phone" name="phone" inputmode="numeric" maxlength="16" autocomplete="tel-national" value="${esc(u && u.role === "customer" ? u.phone || "" : "")}">`)}
     </div>
     ${field("rq-email", "Email (optional)", `<input id="rq-email" name="email" type="email" autocomplete="email" value="${esc(u && u.role === "customer" ? u.email || "" : "")}">`, "Your agent, installer and admin can see it to send bills and updates.")}
     <div id="sm-port" hidden class="card stack" style="padding:14px">
       <div class="grid2">${field("sm-portno", "Number to port", `<input id="sm-portno" name="port_number" inputmode="numeric" maxlength="10">`)}
       ${field("sm-op", "Current operator", `<select id="sm-op" name="current_operator"><option>Jio</option><option>Airtel</option><option>Vi</option><option>BSNL</option><option>Other</option></select>`)}</div>
       <p class="muted small">To port, you need a UPC code: SMS <b>PORT &lt;your 10-digit number&gt;</b> to <b>1900</b> from that number. Our agent collects it at delivery. Your number keeps working until the switch.</p>
     </div>
     <div id="sm-prefwrap">${field("sm-pref", "Preferred number ending (optional)", `<input id="sm-pref" name="number_preference" inputmode="numeric" maxlength="4" placeholder="e.g. 786">`, "Subject to availability. BSNL customers can also choose a number on BSNL's own portal.")}</div>
     <div class="grid2">
       ${field("rq-pin", "Delivery PIN code", `<input id="rq-pin" name="pincode" inputmode="numeric" maxlength="6" value="${esc(S.pin)}">`)}
       ${field("sm-slot", "Delivery time", `<select id="sm-slot" name="delivery_slot"><option>Morning (9–12)</option><option>Afternoon (12–4)</option><option>Evening (4–8)</option></select>`)}
     </div>
     ${field("rq-addr", "Delivery address", `<input id="rq-addr" name="address" autocomplete="street-address" placeholder="House no., street, landmark">`)}
     <div class="field"><label>KYC</label>
       <label class="check"><input type="radio" name="kyc" value="doorstep" checked> Doorstep e-KYC by our agent (keep your original Aadhaar ready)</label>
       <label class="check"><input type="radio" name="kyc" value="self"> I'll complete self-KYC online on the operator's portal</label>
       <span class="hint">For BSNL SIMs, self-KYC is on <a href="https://sancharaadhaar.bsnl.co.in/BSNLSKYC/" target="_blank" rel="noopener">BSNL's self-KYC portal</a>. Connect Bhai never asks for your Aadhaar number in this form.</span></div>
     <div class="field" data-f="rq-consent"><label class="check"><input type="checkbox" id="rq-consent" name="consent"> I agree to be contacted by Connect Bhai and its DSAs and TIPs about this SIM.</label><span class="ferr" id="rq-consent-err"></span></div>
     <button class="btn btn-primary btn-block" type="submit">${u ? "Book SIM" : "Verify on WhatsApp and book SIM"}</button>
   </form>`);
}

/* =====================================================================
   2. CUSTOMER DASHBOARD
   ===================================================================== */
const STAGES = [["new", "Requested"], ["assigned", "Assigned"], ["contacted", "Contacted"], ["booked", "Booked"], ["installed", "Installed"]];
function tracker(status, product) {
  const idx = { new: 0, assigned: 1, contacted: 2, follow_up: 2, booked: 3, installed: 4 }[status];
  if (status === "lost") return `<p class="muted small">This request was closed.</p>`;
  const st = ["sim", "ott"].includes(product) ? [["new", "Requested"], ["assigned", "Assigned"], ["contacted", "Contacted"], ["booked", product === "sim" ? "KYC & delivery" : "Confirming"], ["installed", "Activated"]] : STAGES;
  return `<div class="track">${st.map(([k, l], i) => `<div class="${i < idx ? "done" : i === idx ? "now" : ""}">${l}</div>`).join("")}</div>`;
}
async function renderCustomer() {
  const tab = S.tab || "bookings";
  const [leads, bookings, tickets, chatUnread] = await Promise.all([API.myLeads(), API.myBookings(), API.myTickets(), unreadCount()]);
  const openT = tickets.filter(t => ["open", "in_progress"].includes(t.status)).length;
  const charges = await API.myCharges();
  const tabs = [["bookings", "Bookings", leads.length], ["support", "Complaints & requests", openT], ["devices", "Care plan", bookings.filter(b => b.status === "installed").length], ["payments", "Payments", charges.filter(c => ["due", "failed"].includes(c.status)).length], ["chat", "Chat", chatUnread]];
  const u0 = me(), act = leads.find(l => l.status !== "lost") || leads[0];
  const pre = `<div class="contacts">${contactCard("You (customer)", { name: u0.full_name || "Customer", phone: u0.phone, email: u0.email }, { noBtns: true, extra: `<div class="cacts"><button class="cbtn" data-act="edit-profile" type="button">Edit name / email</button></div>` })}
    ${act && act.dsa ? contactCard("Your agent (DSA)", act && act.dsa, { thread: act && "lead:" + act.id, text: act ? "Namaste, about my Connect Bhai request " + act.ref_code : "", empty: act ? "Assigned shortly. You get a WhatsApp message." : "Request a connection first." }) : ""}
    ${contactCard("TIP (installer)", act && act.tip, { thread: act && "lead:" + act.id, text: act ? "Namaste, about my connection " + act.ref_code : "", empty: act ? "Finding an installer. Their name and number show here once assigned." : "Request a connection first." })}
    ${contactCard("Connect Bhai admin", SUPPORT, { thread: "sup:" + u0.id, text: "Namaste Connect Bhai, I need help." })}</div>
    ${leads.length > 1 && act ? `<p class="muted small" style="margin:-8px 0 14px">Agent and installer above are for request <b class="mono">${esc(act.ref_code)}</b>. Each booking has its own Chat button.</p>` : ""}`;
  let body = "";
  if (tab === "bookings") body = leads.length ? `<div class="list">${leads.map(l => `
    <div class="item"><div class="ih"><h3>${planLine(l.plan)}</h3>${leadPill(l.status, l.product)}${productChip(l)}<span class="spacer"></span><span class="mono muted">${esc(l.ref_code)}</span></div>
      <div class="meta"><span>Requested <b>${fdate(l.created_at)}</b></span><span>PIN <b>${esc(l.pincode)}</b>${l.area ? " · " + esc(l.area) : ""}</span>${l.dsa ? `<span>Your agent <b>${esc(l.dsa.name)}</b></span>` : ""}${l.booking ? `<span>Installation <b>${fdate(l.booking.scheduled_date)}</b> ${bookPill(l.booking.status)}</span>` : ""}</div>
      ${tracker(l.status, l.product)}
      ${contactLine("Agent", l.dsa)}${contactLine("Installer", l.tip)}
      <div class="row"><button class="btn btn-soft btn-sm" data-act="chat" data-thread="lead:${l.id}" type="button">Chat about this request</button>${l.plan && l.status !== "lost" ? `<button class="btn btn-ghost btn-sm" data-tab="payments" type="button">Pay</button>` : ""}</div></div>`).join("")}</div>`
    : `<div class="empty"><b>No bookings yet.</b><p class="muted">Search your PIN code and request a connection.</p><button class="btn btn-primary" data-go="home" data-scroll="search" type="button">Find plans</button></div>`;
  if (tab === "support") {
    const conns = bookings.filter(b => b.status !== "cancelled");
    body = `<div class="split"><div class="list">${tickets.length ? tickets.map(t => `
      <div class="item"><div class="ih"><h3>${esc(t.category)}</h3>${tickPill(t.status)}<span class="spacer"></span><span class="mono muted">${esc(t.ref_code)}</span></div>
      <p>${esc(t.description)}</p><div class="meta"><span>${t.type === "complaint" ? "Complaint" : "Service request"}</span><span>Raised <b>${fdate(t.created_at)}</b></span>${t.resolution_note ? `<span>Update: <b>${esc(t.resolution_note)}</b></span>` : ""}</div></div>`).join("") : `<div class="empty"><b>No complaints or requests.</b></div>`}</div>
      <form class="card stack" data-form="ticket" novalidate><h3>Raise a complaint or service request</h3>
        ${field("tk-type", "Type", `<select id="tk-type" name="type"><option value="complaint">Complaint</option><option value="service_request">Service request</option></select>`)}
        ${field("tk-booking", "Connection", `<select id="tk-booking" name="booking_id"><option value="">${conns.length ? "Choose connection" : "No connection yet"}</option>${conns.map(b => `<option value="${b.id}">${esc(b.ref_code)} · ${esc(b.plan ? b.plan.name : "")} (${BOOK[b.status]})</option>`).join("")}</select>`)}
        ${field("tk-cat", "Category", `<select id="tk-cat" name="category"><option>No internet</option><option>Slow speed</option><option>Frequent disconnection</option><option>Billing</option><option>Shift connection</option><option>Plan change</option><option>Other</option></select>`)}
        ${field("tk-desc", "Describe the issue", `<textarea id="tk-desc" name="description" maxlength="1000" placeholder="What is happening and since when?"></textarea>`)}
        <button class="btn btn-primary" type="submit">Submit</button></form></div>`;
  }
  if (tab === "payments") body = customerPayCard(leads) + chargeList(charges, "No payments yet. Use Make a payment above.");
  if (tab === "chat") body = await chatTab();
  if (tab === "devices") {
    const inst = bookings.filter(b => b.status === "installed");
    body = `${CARE_NOTE}${inst.length ? `<div class="list">${inst.map(b => routerCard(b, false)).join("")}</div>` : `<div class="empty"><b>No active connection yet.</b><p class="muted">Router status appears here after installation.</p></div>`}`;
  }
  app.innerHTML = dashShell(`Namaste${me().full_name ? ", " + esc(me().full_name.split(" ")[0]) : ""}`, "Customer dashboard", tabs, tab, body,
    `<button class="btn btn-ghost" data-go="router" type="button">Care plan</button><button class="btn btn-ghost" data-go="speed" type="button">Speed test</button><button class="btn btn-ghost" data-tab="payments" type="button">Pay now</button><button class="btn btn-primary" data-go="home" data-scroll="search" type="button">New connection</button>`, pre);
  if (tab === "devices") bookings.filter(b => b.status === "installed").forEach(b => loadHist(b.id));
}
function dashShell(title, eyebrow, tabs, active, body, actions, pre) {
  return `<div class="wrap dash"><div class="dhead"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1></div><div class="row">${actions || ""}</div></div>
   ${pre || ""}<div class="tabs" role="tablist">${tabs.map(([k, l, c]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === active}">${l}${c !== undefined && c !== null ? `<span class="cnt">${c}</span>` : ""}</button>`).join("")}</div>
   <div id="tabbody">${body == null ? `<div class="empty"><b>This page does not exist.</b><p class="muted">The link may be old or mistyped.</p><button class="btn btn-primary btn-sm" data-tab="${tabs[0][0]}" type="button">Go to ${esc(tabs[0][1])}</button></div>` : body}</div></div>`;   // unknown tab in the URL: never print "undefined"
}

/* =====================================================================
   3. DSA PORTAL  ·  4. TIP PORTAL
   ===================================================================== */
function leadRow(l, role) {
  const due = l.status === "follow_up" && l.next_follow_up && l.next_follow_up <= todayISO();
  const noInstall = ["sim", "ott"].includes(l.product), open = ["assigned", "contacted", "follow_up"].includes(l.status);
  return `<div class="item"><div class="ih"><h3>${esc(l.name)}</h3>${leadPill(l.status, l.product)}${productChip(l)}${due ? pill("Follow-up due", "p-bad") : ""}${role === "dsa" && l.status === "booked" && !l.tip ? pill("Choose a TIP", "p-warn") : ""}<span class="spacer"></span><span class="mono muted">${esc(l.ref_code)}</span></div>
    <div class="meta"><span><b>${esc(fmtPh(l.phone))}</b></span>${l.email ? `<span>${esc(l.email)}</span>` : ""}<span>PIN <b>${esc(l.pincode)}</b>${l.area ? " · " + esc(l.area) : ""}</span><span>${planLine(l.plan)}</span>${l.next_follow_up ? `<span>Next follow-up <b>${fdate(l.next_follow_up)}</b></span>` : ""}${role === "tip" && l.dsa ? `<span>DSA <b>${esc(l.dsa.name)}</b></span>` : ""}</div>
    ${contactBtns({ phone: l.phone, email: l.email }, { thread: "lead:" + l.id, text: "Namaste " + l.name + ", this is about your Connect Bhai request " + l.ref_code })}
    ${role === "dsa" ? contactLine("Installer", l.tip) : contactLine("Agent", l.dsa)}
    <div class="row"><button class="btn btn-soft btn-sm" data-act="lead" data-id="${l.id}" type="button">Open &amp; update</button>
      ${(role === "tip" || role === "dsa") && open && !noInstall ? `<button class="btn btn-primary btn-sm" data-act="book" data-id="${l.id}" type="button">Schedule booking</button>` : ""}
      ${role === "dsa" && l.status === "booked" ? `<button class="btn btn-soft btn-sm" data-act="assign" data-id="${l.id}" type="button">${l.tip ? "Change TIP" : "Assign TIP"}</button>` : ""}
      ${role === "dsa" && open && noInstall ? `<button class="btn btn-primary btn-sm" data-act="activate-sim" data-id="${l.id}" type="button">${l.product === "sim" ? "Mark SIM activated" : "Mark pack activated"}</button>` : ""}</div></div>`;
}
function dsaLeadsTable(rows) {
  const today = todayISO();
  return `<div class="tbl-wrap"><table class="tbl" style="min-width:1120px"><thead><tr><th>Ref</th><th style="min-width:230px">Customer</th><th>PIN</th><th>Area</th><th>Plan</th><th>Status</th><th>Next follow-up</th><th>TIP</th><th></th></tr></thead><tbody>
  ${rows.map(l => {
    const due = l.status === "follow_up" && l.next_follow_up && l.next_follow_up <= today;
    const noInstall = ["sim", "ott"].includes(l.product), open = ["assigned", "contacted", "follow_up"].includes(l.status);
    return `<tr><td class="mono" style="white-space:nowrap">${esc(l.ref_code)}<br><span class="muted">${fdate(l.created_at)}</span></td>
      <td><b>${esc(l.name)}</b><br><span class="muted">${esc(fmtPh(l.phone))}</span>${l.email ? `<br><span class="muted small">${esc(l.email)}</span>` : ""}${contactBtns({ phone: l.phone, email: l.email }, { thread: "lead:" + l.id, text: "Namaste " + l.name + ", this is about your Connect Bhai request " + l.ref_code })}</td>
      <td><b class="mono">${esc(l.pincode)}</b></td><td>${esc(l.area || "—")}</td>
      <td>${l.plan ? esc(l.plan.provider.name) + "<br><span class='muted'>" + esc(l.plan.name) + "</span>" : "<span class='muted'>Callback</span>"}</td>
      <td>${leadPill(l.status, l.product)}<br>${productChip(l)}${due ? "<br>" + pill("Follow-up due", "p-bad") : ""}</td>
      <td style="white-space:nowrap">${l.next_follow_up ? fdate(l.next_follow_up) : "<span class='muted'>—</span>"}</td>
      <td>${l.tip ? esc(l.tip.name) : l.status === "booked" ? pill("Choose a TIP", "p-warn") : "<span class='muted'>—</span>"}</td>
      <td><div class="row" style="flex-wrap:nowrap"><button class="btn btn-soft btn-sm" data-act="lead" data-id="${l.id}" type="button">Update</button>${open && !noInstall ? `<button class="btn btn-primary btn-sm" data-act="book" data-id="${l.id}" type="button">Schedule booking</button>` : ""}${l.status === "booked" ? `<button class="btn btn-primary btn-sm" data-act="assign" data-id="${l.id}" type="button">${l.tip ? "Change TIP" : "Assign TIP"}</button>` : ""}${open && noInstall ? `<button class="btn btn-primary btn-sm" data-act="activate-sim" data-id="${l.id}" type="button">${l.product === "sim" ? "Mark SIM activated" : "Mark pack activated"}</button>` : ""}</div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function commissionList(cs) {
  const sum = s => cs.filter(c => c.status === s).reduce((a, c) => a + Number(c.amount), 0);
  return `<div class="kpis"><div class="kpi"><span>Pending approval</span><b>${inr(sum("pending"))}</b></div><div class="kpi"><span>Approved</span><b>${inr(sum("approved"))}</b><small>awaiting payment</small></div><div class="kpi"><span>Paid</span><b>${inr(sum("paid"))}</b></div><div class="kpi"><span>Installs</span><b>${cs.length}</b></div></div>
  ${cs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Booking</th><th>Customer</th><th>Plan</th><th>Installed</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>
  ${cs.map(c => `<tr><td class="mono">${esc(c.booking.ref_code)}</td><td>${esc(c.booking.lead ? c.booking.lead.name : "")}</td><td>${esc(c.booking.plan ? c.booking.plan.name : "")}</td><td>${fdate(c.booking.installed_at)}</td><td class="r num">${inr(c.amount)}</td><td>${commPill(c.status)}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><b>No commissions yet.</b><p class="muted">Commissions are created when an installation is completed.</p></div>`}`;
}
/* ---------- earnings & lead-promise dashboards (computed from the same records every portal uses) ---------- */
const monthKeys = n => { const d = new Date(), a = []; for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); a.push(x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")); } return a; };
const mKey = iso => (iso || "").slice(0, 7);
const mLabel = k => new Date(k + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
const sumBy = (a, f) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
const inrK = v => v >= 100000 ? "₹" + (v / 100000).toFixed(1).replace(/\.0$/, "") + "L" : v >= 1000 ? "₹" + (v / 1000).toFixed(1).replace(/\.0$/, "") + "k" : "₹" + Math.round(v);
function colChart(keys, series, fmt) {   // series: [{ name, color, values[] }] — grouped columns, one group per month
  const max = Math.max(1, ...series.flatMap(x => x.values)), f = fmt || (v => v);
  return `<div class="cchart" role="img" aria-label="${esc(series.map(x => x.name + ": " + keys.map((k, i) => mLabel(k) + " " + f(x.values[i])).join(", ")).join(". "))}">
    <div class="ccols">${keys.map((k, i) => `<div class="ccol"><div class="cbars">${series.map(x => `<i style="height:${x.values[i] / max * 100}%;background:${x.color}" title="${esc(x.name)} · ${mLabel(k)}: ${esc(f(x.values[i]))}"><span>${x.values[i] ? esc(f(x.values[i])) : ""}</span></i>`).join("")}</div></div>`).join("")}</div>
    <div class="clabels">${keys.map(k => `<span>${mLabel(k)}</span>`).join("")}</div>
    <div class="clegend">${series.map(x => `<span><i style="background:${x.color}"></i>${esc(x.name)}</span>`).join("")}</div></div>`;
}
function pStats(p, leads, bookings, comms, charges, st) {
  const isT = p.type === "tip", keys = monthKeys(6), cur = keys[5];
  const mine = leads.filter(l => (isT ? l.assigned_tip_id : l.assigned_dsa_id) === p.id);
  const given = isT ? mine : mine.filter(l => l.source !== "dsa"), own = isT ? [] : mine.filter(l => l.source === "dsa");
  const inst = bookings.filter(b => b.status === "installed" && (isT ? b.tip_partner_id : b.dsa_partner_id) === p.id);
  const cm = comms.filter(c => c.partner_id === p.id && c.status !== "rejected"), fees = charges.filter(c => c.partner_id === p.id && c.kind === "platform_fee");
  const price = b => b.plan ? b.plan.price_monthly : 0, share = Number(st.tip_share_percent) || 0;
  const billing = sumBy(inst, price), closed = mine.filter(l => ["installed", "lost"].includes(l.status)).length, won = mine.filter(l => l.status === "installed").length;
  const end = k => { const [y, m] = k.split("-").map(Number); return new Date(y, m, 1).toISOString(); };
  const by = keys.map(k => ({
    k, leads: given.filter(l => mKey(l.assigned_at || l.created_at) === k).length, installs: inst.filter(b => mKey(b.installed_at) === k).length,
    comm: sumBy(cm.filter(c => mKey(c.created_at) === k), c => c.amount), billing: sumBy(inst.filter(b => (b.installed_at || "") < end(k)), price)
  }));
  const target = Number(p.lead_target) || Number(st.lead_target_default) || 20;
  const dNow = new Date(), daysLeft = new Date(dNow.getFullYear(), dNow.getMonth() + 1, 0).getDate() - dNow.getDate();
  return {
    p, isT, keys, by, given, own, inst, won, target, daysLeft, share, billing, thisMonth: by[5].leads, installsMonth: by[5].installs,
    conv: closed ? Math.round(won / closed * 100) : 0, open: mine.filter(l => !["installed", "lost"].includes(l.status)).length,
    comm: { pending: sumBy(cm.filter(c => c.status === "pending"), c => c.amount), approved: sumBy(cm.filter(c => c.status === "approved"), c => c.amount), paid: sumBy(cm.filter(c => c.status === "paid"), c => c.amount) },
    fee: { paid: sumBy(fees.filter(c => c.status === "paid"), c => c.amount), due: sumBy(fees.filter(c => ["due", "failed"].includes(c.status)), c => c.amount) }
  };
}
function promiseCard(s, admin) {
  const pct = s.target ? Math.min(100, Math.round(s.thisMonth / s.target * 100)) : 100, met = s.thisMonth >= s.target;
  return `<div class="card promise"><div class="stack" style="gap:6px"><span class="eyebrow">Connect Bhai lead promise · ${mLabel(s.keys[5])}</span>
      <div class="row" style="align-items:baseline;gap:8px"><span class="big">${s.thisMonth}</span><span class="muted" style="font-weight:700">of ${s.target} leads delivered${admin ? "" : " to you"}</span></div>
      <div class="prog ${met ? "ok" : ""}" aria-label="${pct}% of promised leads"><i style="width:${pct}%"></i></div>
      <span class="small ${met ? "" : "muted"}" style="${met ? "color:var(--ok);font-weight:800" : ""}">${met ? "Promise met this month." : `${s.target - s.thisMonth} more to deliver · ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left in the month`}</span></div>
    <div class="stack" style="gap:6px"><span class="muted small">${s.isT ? `A DSA calls and books each lead. Once a lead is booked and assigned to ${admin ? "this TIP" : "you"}, ${admin ? "the TIP only installs it" : "you only install it"}. Each installed customer adds monthly billing to ${admin ? "their" : "your"} business.` : `New requests from ${admin ? "this DSA's" : "your"} PIN codes (${esc(s.p.service_pincodes || "—")}) are assigned ${admin ? "to them" : "to you"} automatically, the DSA with the fewest open leads first. ${admin ? "The DSA calls, follows up and books" : "You call, follow up and book"} each lead, then ${admin ? "assigns" : "assign"} a TIP to install it. Each installation earns ${admin ? "them" : "you"} ` + inr(s.p.commission_per_install) + "."}</span>
      <span class="small">Conversion so far <b>${s.conv}%</b> · open leads <b>${s.open}</b></span></div></div>`;
}
function partnerDash(s) {
  const p = s.p, totalComm = s.comm.pending + s.comm.approved + s.comm.paid, estMonthly = s.billing * s.share / 100;
  const kpis = s.isT
    ? `<div class="kpi"><span>Leads from Connect Bhai</span><b>${s.given.length}</b><small>${s.thisMonth} this month</small></div><div class="kpi"><span>Customers installed</span><b>${s.inst.length}</b><small>${s.installsMonth} this month · ${s.conv}% conversion</small></div>
       <div class="kpi"><span>Monthly billing added</span><b>${inr(s.billing)}</b><small>${inr(s.billing * 12)} a year from these customers</small></div><div class="kpi"><span>Your est. monthly income</span><b>${s.share ? inr(estMonthly) : "—"}</b><small>${s.share ? s.share + "% share of rental" : "Share % to be set by admin"}</small></div>`
    : `<div class="kpi"><span>Your leads</span><b>${s.given.length}</b><small>${s.thisMonth} this month</small></div><div class="kpi"><span>Installed</span><b>${s.won}</b><small>${s.installsMonth} this month · ${s.conv}% conversion</small></div>
       <div class="kpi"><span>Total earned</span><b>${inr(totalComm)}</b><small>${inr(p.commission_per_install)} per installation</small></div><div class="kpi"><span>Paid to you</span><b>${inr(s.comm.paid)}</b><small>${inr(s.comm.approved)} approved · ${inr(s.comm.pending)} awaiting approval</small></div>`;
  const money = s.isT
    ? `<div class="card"><h3>Monthly billing from Connect Bhai customers</h3><p class="muted small" style="margin-bottom:10px">Total monthly rental of all customers you installed from Connect Bhai leads, month by month.</p>${colChart(s.keys, [{ name: "Monthly billing", color: "var(--ok)", values: s.by.map(x => x.billing) }].concat(s.share ? [{ name: "Your est. income (" + s.share + "%)", color: "var(--blue)", values: s.by.map(x => Math.round(x.billing * s.share / 100)) }] : []), inrK)}</div>`
    : `<div class="card"><h3>Commission earned by month</h3><p class="muted small" style="margin-bottom:10px">Created when the installation is completed; admin approves and pays by UPI or bank.</p>${colChart(s.keys, [{ name: "Commission", color: "var(--ok)", values: s.by.map(x => x.comm) }], inrK)}</div>`;
  const how = s.isT
    ? `<div class="card stack"><h3>Your account with Connect Bhai</h3><div class="facts"><div><span>Customers from Connect Bhai</span><b>${s.inst.length}</b></div><div><span>Monthly billing of these customers</span><b>${inr(s.billing)}</b></div><div><span>Platform fee per installation</span><b>${inr(p.commission_per_install)} + GST</b></div><div><span>Platform fees paid</span><b>${inr(s.fee.paid)}</b></div><div><span>Platform fees due</span><b>${inr(s.fee.due)}</b></div>${s.share ? `<div><span>Est. first-year income from these customers</span><b>${inr(estMonthly * 12)}</b></div><div><span>Return on platform fees (1st year)</span><b>${s.fee.paid + s.fee.due ? (estMonthly * 12 / (s.fee.paid + s.fee.due)).toFixed(1) + "×" : "—"}</b></div>` : ""}</div>
       ${s.fee.due ? `<button class="btn btn-soft btn-sm" data-tab="payments" type="button">Pay due fees</button>` : ""}</div>`
    : `<div class="card stack"><h3>How you earn</h3><div class="facts"><div><span>Per installation</span><b>${inr(p.commission_per_install)}</b></div><div><span>Awaiting admin approval</span><b>${inr(s.comm.pending)}</b></div><div><span>Approved, payout coming</span><b>${inr(s.comm.approved)}</b></div><div><span>Paid to you</span><b>${inr(s.comm.paid)}</b></div><div><span>Open leads to convert</span><b>${s.open}</b></div><div><span>Possible earning from open leads</span><b>${inr(s.open * p.commission_per_install)}</b></div></div>
       <div class="row"><button class="btn btn-soft btn-sm" data-tab="commission" type="button">See every installation</button><button class="btn btn-ghost btn-sm" data-tab="leads" type="button">Call open leads</button></div></div>`;
  return `${promiseCard(s)}<div class="kpis">${kpis}</div>
    <div class="split"><div class="card"><h3>Leads delivered and installed</h3><p class="muted small" style="margin-bottom:10px">Last 6 months. Leads count in the month they were assigned to you.</p>${colChart(s.keys, [{ name: "Leads from Connect Bhai", color: "var(--blue)", values: s.by.map(x => x.leads) }, { name: "Installed", color: "var(--ok)", values: s.by.map(x => x.installs) }])}</div>${money}</div>
    <div style="margin-top:16px">${how}</div>`;
}
const zoneOf = l => (l && l.pincode) || null;   // 'zone' is now the AREA: its PIN code
const zoneOpts = cur => `<option value="">— No zone —</option><optgroup label="Indore city">${ZONES.filter(z => z.kind === "city").map(z => `<option value="${z.id}" ${cur === z.id ? "selected" : ""}>${z.name}</option>`).join("")}</optgroup><optgroup label="Rural tehsils">${ZONES.filter(z => z.kind === "rural").map(z => `<option value="${z.id}" ${cur === z.id ? "selected" : ""}>${z.name}</option>`).join("")}</optgroup>`;
function partnerPre(p) {
  const u = me();
  return `<div class="contacts">${contactCard("You (" + (p.type === "tip" ? "TIP" : "DSA") + ")", { name: p.name, firm: p.firm, phone: p.phone, email: p.email || u.email }, { noBtns: true, extra: `<div class="cacts"><button class="cbtn" data-act="edit-profile" type="button">Edit name / email</button></div>` })}
    ${contactCard("Connect Bhai admin", SUPPORT, { thread: "sup:" + u.id, text: "Namaste Connect Bhai, this is " + p.name + "." })}</div>`;
}
async function renderDSA() {
  const tab = S.tab || "home";
  /* the numbers come from the server's aggregates; the lists below load one page at a time (serverTable) */
  const [st, partner] = await Promise.all([dashStats(API, "dsa", { months: 1 }), API.myPartner()]);
  const L = st.leads, open = L.new + L.contacted + L.follow_up + L.booked + (L.assigned || 0), C = st.commission;
  const filt = S.dsaFilter || "open";
  const charges = tab === "payments" || partner.status !== "active" ? await API.myCharges() : [];
  let body;
  if (tab === "leads") body = `<div class="kpis"><div class="kpi"><span>Open leads</span><b>${open}</b></div><div class="kpi"><span>Follow-ups due</span><b>${st.followups_due}</b><small>today or earlier</small></div><div class="kpi"><span>Booked</span><b>${L.booked}</b></div><div class="kpi"><span>Installed</span><b>${L.installed}</b></div></div>
    <div class="chips" style="margin-bottom:14px">${[["open", "Open"], ["due", "Follow-up due"], ["assigned", "New to call"], ["contacted", "Contacted"], ["booked", "Booked"], ["installed", "Installed"], ["lost", "Lost"], ["all", "All"]].map(([k, l]) => `<button type="button" class="chip" data-act="dsa-filter" data-v="${k}" aria-pressed="${filt === k}">${l}</button>`).join("")}</div>
    ${serverTable("dsa-leads", {
    role: "dsa", kind: "leads", filters: () => ({ status: S.dsaFilter || "open" }), label: "Search leads", html: dsaLeadsTable,
    empty: `No leads here yet. New requests from your PIN codes (${partner.service_pincodes || "none set"}) are assigned to you automatically. You can also add customers you meet in the field, and you earn when they are installed.`
  })}`;
  if (tab === "installs") body = serverTable("dsa-installs", { role: "dsa", kind: "bookings", label: "Search installations", empty: "No installations yet.", html: rows => `<div class="list">${rows.map(b => `<div class="item"><div class="ih"><h3>${esc(b.lead.name)}</h3>${bookPill(b.status)}<span class="spacer"></span><span class="mono muted">${esc(b.ref_code)}</span></div><div class="meta"><span><b>${esc(fmtPh(b.lead.phone))}</b></span><span>${planLine(b.plan)}</span><span>Scheduled <b>${fdate(b.scheduled_date)}</b></span>${b.tip ? `<span>TIP <b>${esc(b.tip.name)}</b></span>` : ""}</div>${contactBtns({ phone: b.lead.phone, email: b.lead.email }, { thread: "lead:" + b.lead.id })}${contactLine("Installer", b.tip)}</div>`).join("")}</div>` });
  if (tab === "commission") body = `<div class="kpis"><div class="kpi"><span>Pending approval</span><b>${inr(C.pending)}</b></div><div class="kpi"><span>Approved</span><b>${inr(C.approved)}</b><small>awaiting payment</small></div><div class="kpi"><span>Paid</span><b>${inr(C.paid)}</b></div><div class="kpi"><span>Installs</span><b>${st.commission_count}</b></div></div>
    ${serverTable("dsa-comm", { role: "dsa", kind: "commissions", label: "Search earnings", empty: "No commissions yet. Commissions are created when an installation is completed.", html: rows => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Booking</th><th>Customer</th><th>Plan</th><th>Installed</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>${rows.map(c => `<tr><td class="mono">${esc(c.booking.ref_code)}</td><td>${esc(c.booking.lead ? c.booking.lead.name : "")}</td><td>${esc(c.booking.plan ? c.booking.plan.name : "")}</td><td>${fdate(c.booking.installed_at || c.created_at)}</td><td class="r num">${inr(c.amount)}</td><td>${commPill(c.status)}</td></tr>`).join("")}</tbody></table></div>` })}`;
  if (tab === "payments") body = chargeList(charges, "Nothing due to Connect Bhai.");
  if (partner.status !== "active" && !["payments", "chat"].includes(tab)) body = activationCard(partner, charges, true);
  if (tab === "chat") body = await chatTab();
  app.innerHTML = dashShell(esc(partner.name), "DSA portal · " + esc(partner.firm || ""), [["home", "Dashboard"], ["leads", "Leads & follow-ups", open], ["installs", "Installation status", st.bookings.scheduled + st.bookings.installed + st.bookings.cancelled], ["commission", "My earnings", st.commission_count], ["chat", "Chat", await unreadCount()]], tab, body, partner.status === "active" ? `<button class="btn btn-primary" data-act="dsa-add" type="button">Add lead</button>` : "", partnerPre(partner));
}
async function renderTIP() {
  const tab = S.tab || "home";
  const [st, partner] = await Promise.all([dashStats(API, "tip", { months: 1 }), API.myPartner()]);
  const L = st.leads, toBook = L.contacted + L.follow_up + (L.assigned || 0), activeN = st.installs_pending, customersN = st.installs_total, openT = st.open_tickets, cc = st.charges_count || {};
  const dueN = (cc.pending || 0) + (cc.due || 0) + (cc.failed || 0);
  const charges = tab === "payments" || partner.status !== "active" ? await API.myCharges() : [];   // a TIP's own fee list is short; the bill list below is paged on the server
  let body;
  if (tab === "bookings") body = `<div class="kpis"><div class="kpi"><span>To schedule</span><b>${toBook}</b></div><div class="kpi"><span>Installs pending</span><b>${activeN}</b></div><div class="kpi"><span>Active customers</span><b>${customersN}</b></div><div class="kpi"><span>Open tickets</span><b>${openT}</b></div></div>
    <h3 style="margin:6px 0 10px;font-size:17px">Installations</h3>
    ${serverTable("tip-active", {
    role: "tip", kind: "bookings", filters: () => ({ status: "scheduled" }), label: "Search installations", empty: "No installations pending.", html: rows => `<div class="list">${rows.map(b => `<div class="item"><div class="ih"><h3>${esc(b.lead.name)}</h3>${bookPill(b.status)}<span class="spacer"></span><span class="mono muted">${esc(b.ref_code)}</span></div>
      <div class="meta"><span><b>${esc(fmtPh(b.lead.phone))}</b></span>${b.lead.email ? `<span>${esc(b.lead.email)}</span>` : ""}<span>${esc(b.lead.address || b.lead.area || "")} · ${esc(b.lead.pincode)}</span><span>${planLine(b.plan)}</span><span>Scheduled <b>${fdate(b.scheduled_date)}</b></span></div>
      ${contactBtns({ phone: b.lead.phone, email: b.lead.email }, { thread: "lead:" + b.lead.id, text: "Namaste " + b.lead.name + ", Connect Bhai installer here about your connection " + b.ref_code })}${contactLine("Agent", b.dsa)}
      <div class="row"><button class="btn btn-primary btn-sm" data-act="booking-status" data-id="${b.id}" type="button">Update installation</button>${mapLink(b.lead, true)}</div></div>`).join("")}</div>`
  })}
    <h3 style="margin:22px 0 10px;font-size:17px">Assigned leads to schedule</h3>
    ${serverTable("tip-toschedule", { role: "tip", kind: "leads", filters: () => ({ status: "tobook" }), label: "Search leads", empty: "Nothing to schedule.", html: rows => `<div class="list">${rows.map(l => leadRow(l, "tip")).join("")}</div>` })}`;
  if (tab === "customers") body = `<div class="notice info" style="margin-bottom:14px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center"><span style="flex:1 1 320px">Enter the ONT serial when you mark an installation complete, and set the modem's Gene address to your own (or Connect Bhai's, as agreed with admin). Keep the ACS link on after installation so the customer stays on the Care plan. Use it only with the provider's written authorisation.</span><button class="btn btn-primary btn-sm" data-go="tip" data-go-tab="careplan" type="button">Manage modems</button></div>
    ${serverTable("tip-customers", {
    role: "tip", kind: "bookings", filters: () => ({ status: "installed", devices: true }), label: "Search customers", empty: "No installed customers yet.", html: rows => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Customer</th><th>Connection ref</th><th>Plan</th><th>Installed</th><th>Authorised</th><th>Router status</th><th></th></tr></thead><tbody>
    ${rows.map(b => `<tr><td><b>${esc(b.lead.name)}</b><br><span class="muted">${esc(fmtPh(b.lead.phone))}</span>${b.lead.email ? `<br><span class="muted small">${esc(b.lead.email)}</span>` : ""}${contactBtns({ phone: b.lead.phone, email: b.lead.email }, { thread: "lead:" + b.lead.id })}</td><td class="mono">${esc(b.connection_ref || "—")}<br><span class="muted">ONT ${esc(b.ont_serial || "not linked")}</span></td><td>${esc(b.plan ? b.plan.name : "")}<br><span class="muted">${b.plan ? b.plan.speed_mbps + " Mbps" : ""}</span></td><td>${fdate(b.installed_at)}</td><td>${b.authorized ? pill("Authorised", "p-ok") : pill("Pending", "p-warn")}</td><td>${deviceView(b.device)}${b.device && b.device.acs ? `<div style="margin-top:4px">${rxPill(b.device)}</div>` : ""}<div class="small" id="rt-${b.id}" style="margin-top:4px"></div></td><td><div class="row" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-act="refresh-device" data-id="${b.id}" type="button" ${b.device && b.device.acs ? "" : "disabled title=\"Not linked to Gene yet\""}>Refresh</button><button class="btn btn-soft btn-sm" data-act="router-test" data-id="${b.id}" type="button" ${b.device && b.device.acs && b.device.active !== false && b.device.state === "online" ? "" : "disabled title=\"Needs a linked modem that is online\""}>Router test</button></div></td></tr>`).join("")}</tbody></table></div>`
  })}`;
  if (tab === "tickets") body = serverTable("tip-tickets", {
    role: "tip", kind: "tickets", label: "Search tickets", empty: "No service tickets.", html: rows => `<div class="list">${rows.map(t => `<div class="item"><div class="ih"><h3>${esc(t.category)}</h3>${tickPill(t.status)}<span class="spacer"></span><span class="mono muted">${esc(t.ref_code)}</span></div>
    <p>${esc(t.description)}</p>${t.booking && t.booking.lead ? contactBtns({ phone: t.booking.lead.phone, email: t.booking.lead.email }, { thread: "lead:" + t.lead_id }) : ""}<div class="meta"><span>${esc(t.booking && t.booking.lead ? t.booking.lead.name : "")} · <b>${esc(t.booking && t.booking.lead ? fmtPh(t.booking.lead.phone) : "")}</b></span><span>Raised <b>${fdate(t.created_at)}</b></span>${t.resolution_note ? `<span>Note: <b>${esc(t.resolution_note)}</b></span>` : ""}</div>
    <div class="row"><button class="btn btn-soft btn-sm" data-act="ticket-status" data-id="${t.id}" data-s="${t.status}" type="button">Update ticket</button></div></div>`).join("")}</div>`
  });
  if (tab === "plans") body = await tipPlansBody();
  if (tab === "payments") body = `<p class="muted" style="margin-bottom:12px">Registration fee and the platform fee of ${inr(partner.commission_per_install)} per installation (plus GST), payable to Connect Bhai.</p>` + `<div class="kpis"><div class="kpi"><span>Due now</span><b>${inr((st.charges.pending || 0) + (st.charges.due || 0) + (st.charges.failed || 0))}</b><small>${dueN} payment${dueN === 1 ? "" : "s"}</small></div><div class="kpi"><span>Paid</span><b>${inr(st.charges.paid || 0)}</b></div></div>` + serverTable("tip-charges", { role: "tip", kind: "charges", label: "Search payments", empty: "Nothing due to Connect Bhai.", html: rows => chargeRows(rows) });
  if (partner.status !== "active" && !["payments", "chat", "plans"].includes(tab)) body = activationCard(partner, charges);
  if (tab === "chat") body = await chatTab();
  app.innerHTML = dashShell(esc(partner.name), "TIP portal", [["home", "Dashboard"], ["bookings", "Bookings & installs", toBook + activeN], ["customers", "Customers & status", customersN], ["tickets", "Service tickets", openT], ["plans", "Plans & offers"], ["payments", "Payments to Connect Bhai", dueN], ["chat", "Chat", await unreadCount()]], tab, body, "", partnerPre(partner));
}
async function openLead(id) {
  const l = await API.leadDetail(id), u = me();
  const next = LEAD_NEXT[l.status] || [];
  const sr = l.sim_request || {}, noInstall = ["sim", "ott"].includes(l.product), open = ["assigned", "contacted", "follow_up"].includes(l.status);
  openModal(`<h2>${esc(l.name)}</h2><p class="muted small" style="margin:2px 0 12px"><span class="mono">${esc(l.ref_code)}</span> · ${leadPill(l.status, l.product)} ${productChip(l)}</p>
    <div class="facts" style="margin-bottom:14px"><div><span>Mobile</span><b>${esc(fmtPh(l.phone))}</b></div><div><span>Email</span><b>${l.email ? esc(l.email) : "—"}</b></div><div><span>Address</span><b style="text-align:right">${esc([l.address, l.area, l.pincode].filter(Boolean).join(", "))}<br>${mapLink(l)}</b></div><div><span>Plan</span><b style="text-align:right">${planLine(l.plan)}</b></div>${l.preferred_date ? `<div><span>Preferred date</span><b>${fdate(l.preferred_date)}</b></div>` : ""}<div><span>DSA (agent)</span><b>${l.dsa ? esc(l.dsa.name) : `<span class="muted">Not assigned yet</span>`}</b></div><div><span>TIP (installer)</span><b>${l.tip ? esc(l.tip.firm || l.tip.name) : `<span class="muted">Not assigned yet</span>`}</b></div>
      ${l.product === "sim" ? `<div><span>SIM request</span><b style="text-align:right">${sr.connection === "port" ? `Port ${esc(sr.port_number || "")} from ${esc(sr.current_operator || "")}` : "New number" + (sr.number_preference ? " · ending " + esc(sr.number_preference) : "")}<br>${sr.type === "postpaid" ? "Postpaid" : "Prepaid"} · for ${esc({ self: "self", family: "family member", known: "someone they know" }[sr.for_whom] || "self")}</b></div>
      <div><span>Delivery & KYC</span><b style="text-align:right">${esc(sr.delivery_slot || "")} · ${sr.kyc === "self" ? "Self-KYC online" : "Doorstep e-KYC"}</b></div>` : ""}</div>
    ${(u.role === "dsa" || u.role === "admin") && open && noInstall ? `<button class="btn btn-primary btn-block" style="margin-bottom:10px" data-act="activate-sim" data-id="${l.id}" type="button">${l.product === "sim" ? "Mark SIM delivered & activated" : "Mark pack activated"}</button>` : ""}
    <div class="stack" style="gap:6px;margin-bottom:14px">${contactLine("Customer", { name: l.name, phone: l.phone, email: l.email })}${u.role !== "dsa" ? contactLine("Agent", l.dsa) : ""}${u.role !== "tip" ? contactLine("Installer", l.tip) : ""}${u.role !== "admin" ? contactLine("Admin", SUPPORT) : ""}
      <div><button class="btn btn-soft btn-sm" data-act="chat" data-thread="lead:${l.id}" type="button">Open group chat</button></div></div>
    ${next.length ? `<form class="stack card" style="padding:14px" data-form="lead-status" data-id="${l.id}" novalidate>
      <div class="grid2">${field("ls-status", "Update status", `<select id="ls-status" name="status">${next.map(s => `<option value="${s}">${LEAD[s]}</option>`).join("")}</select>`)}
      ${field("ls-next", "Next follow-up", `<input id="ls-next" name="next" type="date" min="${todayISO()}" value="${l.next_follow_up && l.next_follow_up >= todayISO() ? l.next_follow_up : ""}">`, "Required for Follow-up")}</div>
      ${field("ls-note", "Note", `<textarea id="ls-note" name="note" placeholder="What did the customer say?"></textarea>`)}
      <button class="btn btn-primary" type="submit">Save update</button></form>`
      : `<p class="notice info">${l.status === "booked" ? (u.role === "tip" ? "Booked. Update the installation when you are on site." : l.tip ? "Booked. The installer completes the installation." : "Booked. Choose the TIP who will install it.") : l.status === "installed" ? "Installed. No further lead updates needed." : "Waiting for admin assignment."}</p>`}
    ${["tip", "dsa", "admin"].includes(u.role) && open && !noInstall ? `<button class="btn btn-soft btn-block" style="margin-top:10px" data-act="book" data-id="${l.id}" type="button">Schedule booking</button>` : ""}
    ${["dsa", "admin"].includes(u.role) && l.status === "booked" ? `<button class="btn btn-soft btn-block" style="margin-top:10px" data-act="assign" data-id="${l.id}" type="button">${l.tip ? "Change TIP" : "Assign TIP"}</button>` : ""}
    <h3 style="font-size:16px;margin:18px 0 10px">History</h3>
    <div class="timeline">${l.events.slice().reverse().map(e => `<div><b>${e.to_status ? LEAD[e.to_status] : "Update"}</b>${e.note ? " · " + esc(e.note) : ""}<small>${fdt(e.created_at)}</small></div>`).join("")}</div>`);
}
function openBook(id) {
  openModal(`<h2>Schedule booking</h2><form class="stack" data-form="book" data-id="${id}" novalidate style="margin-top:12px">
    ${field("bk-date", "Installation date", `<input id="bk-date" name="date" type="date" min="${todayISO()}" value="${addDays(1)}">`)}
    <button class="btn btn-primary" type="submit">Schedule booking</button></form>`);
}
/* Every page of a list, 100 rows at a time. Only for pickers that really need all choices (active DSAs / TIPs); never for tables. */
async function allPages(kind, f) {
  const out = []; for (let page = 1; ; page++) { const r = await fetchPage(API, "admin", kind, { ...f, page, limit: 100 }); out.push(...r.items); if (out.length >= r.total || !r.items.length) return out; }
}
async function openBookingStatus(id) {
  const b = cachedRow("bookings", id) || (API.getBooking ? await API.getBooking(id) : (me().role === "admin" ? await API.adminBookings() : await API.partnerBookings()).find(x => x.id === id));
  if (!b) { toast("Booking not found.", true); return; }
  const next = REST && b.status === "scheduled" ? ["installed", "in_progress", "cancelled"] : BOOK_NEXT[b.status];   // the server completes a booking straight from scheduled; "in progress" only messages the customer
  openModal(`<h2>Update installation</h2><p class="muted small" style="margin:2px 0 12px"><span class="mono">${esc(b.ref_code)}</span> · ${esc(b.lead.name)} · ${bookPill(b.status)}</p>
   <form class="stack" data-form="booking-status" data-id="${id}" novalidate>
    ${field("bs-status", "New status", `<select id="bs-status" name="status">${next.map(s => `<option value="${s}">${BOOK[s]}</option>`).join("")}</select>`)}
    ${field("bs-ref", "Connection reference", `<input id="bs-ref" name="ref" placeholder="Provider account / FTTH ID" value="${esc(b.connection_ref || "")}">`, "Required to mark Installed. Marking installed also marks the connection authorised and creates commissions.")}
    ${field("bs-ont", "ONT / modem serial number (Gene)", `<input id="bs-ont" name="ont" placeholder="e.g. ZTEGC8A1B2C3" value="${esc(b.ont_serial || "")}" autocapitalize="characters">`, "Printed on the modem label. Links the modem to Gene (your own or Connect Bhai's) for live status, Wi-Fi change, restart and line speed tests.")}
    <button class="btn btn-primary" type="submit">Save</button></form>`);
}
function openTicketStatus(id, cur) {
  openModal(`<h2>Update ticket</h2><form class="stack" data-form="ticket-status" data-id="${id}" novalidate style="margin-top:12px">
    ${field("ts-status", "Status", `<select id="ts-status" name="status">${Object.keys(TICKET).map(s => `<option value="${s}" ${s === cur ? "selected" : ""}>${TICKET[s]}</option>`).join("")}</select>`)}
    ${field("ts-note", "Note for customer", `<textarea id="ts-note" name="note" placeholder="What was done?"></textarea>`)}
    <button class="btn btn-primary" type="submit">Save</button></form>`);
}

/* =====================================================================
   5. ADMIN DASHBOARD
   ===================================================================== */
async function renderAdmin() {
  const tab = S.tab || "overview";
  await loadCities();
  /* Load only what the open tab needs. Numbers come from the server's aggregates; every list below is one page at a time (serverTable). */
  const [bd, unread] = await Promise.all([API.adminBadges ? API.adminBadges() : Promise.all([fetchPage(API, "admin", "leads", { status: "new", limit: 1 }), fetchPage(API, "admin", "partners", { status: "pending", limit: 1 })]).then(([a, b]) => ({ new_leads: a.total, pending_partners: b.total, waiting: null })), unreadCount()]);
  const newCount = bd.new_leads, pendingCount = bd.pending_partners, pendingPlans = null, waiting = bd.waiting || null;
  const tabs = [["overview", "Overview"], ["leads", "Leads", newCount], ["partners", "DSA & TIP", pendingCount], ["team", "Team & logins"], ["providers", "Providers"], ["plans", "Plans", pendingPlans], ["locations", "Locations"], ["cities", "Cities & waiting list", waiting], ["billing", "Billing & fees"], ["commissions", "DSA payouts"], ["payments", "Payout history"], ["chat", "Chat", unread], ["messages", "WhatsApp log"], ["reports", "Reports"], ["settings", "Settings"]];
  let body = "";
  if (tab === "overview") {
    const [d, nl, pd, pt] = await Promise.all([dashStats(API, "admin", { months: 1 }), fetchPage(API, "admin", "leads", { status: "new", unassigned: true, limit: 5 }), fetchPage(API, "admin", "partners", { type: "dsa", status: "pending", limit: 5 }), fetchPage(API, "admin", "partners", { type: "tip", status: "pending", limit: 5 })]);
    const newL = nl.items, pendingP = [...pd.items, ...pt.items].slice(0, 5);
    body = `<div class="kpis"><div class="kpi"><span>Unassigned leads</span><b>${d.unassigned}</b><small>need assignment</small></div><div class="kpi"><span>Installs pending</span><b>${d.installs_pending}</b></div><div class="kpi"><span>Open tickets</span><b>${d.open_tickets}</b></div><div class="kpi"><span>Commission to approve</span><b>${inr(d.commission.pending)}</b></div></div>
    <div class="split"><div class="card"><div class="row"><h3>Leads waiting for assignment</h3><span class="spacer"></span><button class="linkbtn small" data-tab="leads" type="button">All leads</button></div>
      <div class="list" style="margin-top:10px">${newL.length ? newL.map(l => `<div class="item"><div class="ih"><h3>${esc(l.name)}</h3><span class="mono muted small">${esc(l.ref_code)}</span></div><div class="meta"><span>PIN <b>${esc(l.pincode)}</b></span><span>${planLine(l.plan)}</span></div><div class="row"><button class="btn btn-primary btn-sm" data-act="assign" data-id="${l.id}" type="button">Assign DSA</button></div></div>`).join("") + (nl.total > newL.length ? `<p class="muted small">+ ${nl.total - newL.length} more in Leads</p>` : "") : `<p class="muted">All leads are assigned.</p>`}</div></div>
      <div class="card"><div class="row"><h3>DSA & TIP applications</h3>${pendingCount ? `<button class="chip" type="button" data-act="partners-pending">${pendingCount} pending</button>` : ""}<span class="spacer"></span><button class="linkbtn small" data-tab="partners" type="button">All DSAs & TIPs</button></div>
      <div class="list" style="margin-top:10px">${pendingP.length ? pendingP.map(p => `<div class="item"><div class="ih"><h3>${esc(p.name)}</h3>${pill(p.type.toUpperCase(), "p-blue")}</div><div class="meta"><span>${esc(p.firm || "")}</span><span><b>${esc(fmtPh(p.phone))}</b></span>${p.email ? `<span>${esc(p.email)}</span>` : ""}<span>PINs ${esc(p.service_pincodes || "—")}</span>${p.fee_paid_at ? pill("Fee paid", "p-ok") : pill("Fee not paid", "p-warn")}</div><div class="row"><button class="btn btn-soft btn-sm" data-act="edit-partner" data-id="${p.id}" type="button">Review</button></div></div>`).join("") : `<p class="muted">No pending applications.</p>`}</div></div></div>`;
  }
  if (tab === "leads") {
    const f = S.adminLeadFilter || "all", zf = S.zoneFilter || "all", [d, stt] = await Promise.all([dashStats(API, "admin", { months: 1, pins: 50 }), API.getSettings()]), auto = Number(stt.auto_assign) === 1;
    const pins = d.top_pins, pinName = pin => { const x = pins.find(q => q.pincode === pin); return x && x.areas && x.areas[0] || ""; };
    const top4 = pins.slice(0, 4), maxN = Math.max(1, ...top4.map(r => r.leads));
    const zoneHtml = `<div class="card stack" style="margin-bottom:16px"><div style="min-width:0"><h3>Where leads come from</h3><p class="muted small">All-time leads grouped by the customer's PIN code and area, busiest first.</p></div>
      <div class="bars">${top4.map(r => `<div class="bar"><span>${esc(r.pincode)}${r.areas && r.areas[0] ? " · " + esc(r.areas[0]) : ""}</span><span class="t"><i style="width:${r.leads / maxN * 100}%;background:var(--ok)"></i></span><b>${r.leads}</b></div>`).join("")}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Area</th><th class="r">Leads</th><th class="r">Installed</th><th></th></tr></thead><tbody>
      ${(S.zoneAll ? pins : top4).map(r => `<tr><td><b class="mono">${esc(r.pincode)}</b><br><span class="muted">${esc((r.areas && r.areas[0]) || "")}</span></td><td class="r">${r.leads}</td><td class="r">${r.installs}${r.leads ? ` (${Math.round(r.installs / r.leads * 100)}%)` : ""}</td>
        <td><button class="btn btn-ghost btn-sm" data-act="zone-filter" data-v="${zf === r.pincode ? "all" : r.pincode}" type="button">${zf === r.pincode ? "Show all leads" : "Show these leads"}</button></td></tr>`).join("")}</tbody></table></div>
      ${pins.length > 4 ? `<div><button class="linkbtn small" data-act="zone-all" type="button">${S.zoneAll ? "Show top 4 areas only" : `Show the top ${pins.length} areas`}</button></div>` : ""}</div>`;
    const L = d.leads;
    body = `<div class="card row" style="margin-bottom:14px;padding:14px 16px"><div style="min-width:0;flex:1 1 260px"><b>Auto-assign new leads by PIN code is ${auto ? "ON" : "OFF"}</b><p class="muted small">${auto ? "Each new request goes to the DSA serving that PIN code with the fewest open leads. The DSA calls, follows up and books it; then admin or the DSA assigns the TIP who installs it." : "Every new request waits here for you to assign it."}</p></div><button class="btn ${auto ? "btn-ghost" : "btn-primary"} btn-sm" data-act="auto-assign" data-v="${auto ? 0 : 1}" type="button">Turn ${auto ? "off" : "on"}</button></div>
    ${zoneHtml}<div class="row small" style="margin-bottom:10px;gap:8px"><b>Area</b><select class="sel" id="zone-pick" aria-label="Filter leads by area"><option value="all">All areas (${d.leads_total})</option>${pins.map(r => `<option value="${esc(r.pincode)}" ${zf === r.pincode ? "selected" : ""}>${esc(r.pincode)}${pinName(r.pincode) ? " · " + esc(pinName(r.pincode)) : ""} · ${r.leads}</option>`).join("")}</select>${zf !== "all" ? `<span class="muted">Showing leads in ${esc(zf)}${pinName(zf) ? " · " + esc(pinName(zf)) : ""}</span>` : ""}</div>
    <div class="chips" style="margin-bottom:14px">${["all", ...Object.keys(LEAD).filter(k => !(REST && k === "assigned"))].map(k => `<button type="button" class="chip" data-act="admin-lead-filter" data-v="${k}" aria-pressed="${f === k}">${k === "all" ? "All" : LEAD[k]}${zf === "all" ? ` (${k === "all" ? d.leads_total : L[k] || 0})` : ""}</button>`).join("")}</div>
    ${serverTable("adm-leads", {
      role: "admin", kind: "leads", label: "Search leads", empty: "No leads here.", filters: () => ({ status: S.adminLeadFilter || "all", pincode: (S.zoneFilter || "all") === "all" ? undefined : S.zoneFilter }), html: rows => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ref</th><th>Customer</th><th>PIN</th><th>Area</th><th>Plan</th><th>Status</th><th>DSA</th><th>TIP</th><th></th></tr></thead><tbody>
    ${rows.map(l => `<tr><td class="mono" style="white-space:nowrap">${esc(l.ref_code)}<br><span class="muted">${fdate(l.created_at)}</span></td><td><b>${esc(l.name)}</b><br><span class="muted">${esc(fmtPh(l.phone))}</span>${l.email ? `<br><span class="muted small">${esc(l.email)}</span>` : ""}${contactBtns({ phone: l.phone, email: l.email }, { thread: "lead:" + l.id })}</td><td><b class="mono">${esc(l.pincode)}</b></td><td>${esc(l.area || pinName(l.pincode) || "—")}</td><td>${l.plan ? esc(l.plan.provider.name) + "<br><span class='muted'>" + esc(l.plan.name) + "</span>" : "<span class='muted'>Callback</span>"}</td><td>${leadPill(l.status, l.product)}<br>${productChip(l)}</td><td>${esc((l.dsa && l.dsa.name) || "—")}</td><td>${esc((l.tip && l.tip.name) || "—")}</td>
      <td><div class="row" style="flex-wrap:nowrap">${!["installed", "lost"].includes(l.status) ? `<button class="btn btn-primary btn-sm" data-act="assign" data-id="${l.id}" type="button">${l.status === "booked" ? (l.tip ? "Change TIP" : "Assign TIP") : (l.dsa ? "Reassign DSA" : "Assign DSA")}</button>` : ""}<button class="btn btn-ghost btn-sm" data-act="lead" data-id="${l.id}" type="button">Open</button>${REST ? `<button class="btn btn-ghost btn-sm" data-act="edit-lead" data-id="${l.id}" type="button">Edit</button><button class="btn btn-danger btn-sm" data-act="delete-lead" data-id="${l.id}" data-ref="${esc(l.ref_code)}" data-name="${esc(l.name)}" type="button">Delete</button>` : ""}${(l.dsa || l.tip) && ["assigned", "contacted", "follow_up"].includes(l.status) ? `<button class="btn btn-ghost btn-sm" data-act="book" data-id="${l.id}" type="button">Schedule booking</button>` : ""}${l.tip && l.booking && ["scheduled", "in_progress"].includes(l.booking.status) ? `<button class="btn btn-ghost btn-sm" data-act="booking-status" data-id="${l.booking.id}" type="button">Install</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`
    })}`;
  }
  if (tab === "partners") {
    const pt = S.partnerType || "dsa";
    body = `<div class="row" style="margin-bottom:12px">${pendingCount ? `<button class="chip" type="button" data-act="partners-pending" aria-pressed="${S.partnerStatus === "pending"}">${pendingCount} pending${S.partnerStatus === "pending" ? " · showing only these" : ""}</button>` : `<span class="muted">0 pending</span>`}${S.partnerStatus === "pending" ? `<button class="linkbtn small" data-act="partners-pending" data-all="1" type="button">Show all</button>` : ""}<span class="spacer"></span><button class="btn btn-primary btn-sm" data-act="edit-partner" data-id="" type="button">Add DSA / TIP</button></div>
    <div class="chips" style="margin-bottom:12px">${[["dsa", "DSAs"], ["tip", "TIPs"]].map(([k, l]) => `<button type="button" class="chip" data-act="partner-type" data-v="${k}" aria-pressed="${pt === k}">${l}</button>`).join("")}</div>
    <p class="muted small" style="margin:-4px 0 12px">Account status shows whether a partner can log in. <b>Pending</b> → click Approve. <b>Active</b> → click Suspend to stop access. <b>Suspended</b> → click Activate to restore it. Edit changes details; Delete removes the partner permanently.</p>
    ${serverTable("adm-partners-" + pt, {
      role: "admin", kind: "partners", label: "Search DSAs and TIPs", empty: S.partnerStatus === "pending" ? "No pending applications." : "No one here yet.", filters: () => ({ type: pt, status: S.partnerStatus === "pending" ? "pending" : undefined }), html: rows => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>DSA / TIP</th><th>Type</th><th>Mobile</th><th>Service PINs</th><th class="r">Per install</th><th>KYC</th><th>Account status</th><th>Actions</th></tr></thead><tbody>
    ${rows.map(p => `<tr><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.firm || "")}</span></td><td>${p.type.toUpperCase()}</td><td>${esc(fmtPh(p.phone))}${p.email ? `<br><span class="muted small">${esc(p.email)}</span>` : ""}${contactBtns(p)}</td><td>${esc(p.service_pincodes || "—")}</td><td class="r num">${inr(p.commission_per_install)}<br><span class="muted small">${p.type === "dsa" ? "DSA earns" : "TIP pays + GST"}</span></td><td>${p.kyc_verified ? pill("Verified", "p-ok") : pill("Pending", "p-warn")}</td><td>${p.status === "pending" && p.approved_at ? pill("Approved · fee due", "p-blue") + `<br><span class="muted small">Waiting for the registration fee</span>` : p.status === "pending" && p.fee_paid_at ? pill("Fee paid · check KYC", "p-blue") + `<br><span class="muted small">Check KYC, then approve</span>` : p.status === "pending" ? pill("Pending", "p-warn") + `<br><span class="muted small">${p.kyc_verified ? "Awaiting your approval" : "KYC not verified · awaiting your approval"}</span>` : p.status === "active" ? pill("Active", "p-ok") + `<br><span class="muted small">Can log in and receive leads</span>` : pill("Suspended", "p-bad") + `<br><span class="muted small">Login blocked · click Activate to restore</span>`}</td>
      <td><div class="row" style="gap:6px"><button class="btn btn-ghost btn-sm" data-act="edit-partner" data-id="${p.id}" type="button">Edit</button>${p.status === "pending" && !p.approved_at ? `<button class="btn btn-soft btn-sm" data-act="approve-partner" data-id="${p.id}" type="button">Approve</button>` : p.status === "pending" ? `<button class="btn btn-soft btn-sm" type="button" disabled title="Waiting for the registration fee to be paid or waived">Awaiting fee</button>` : p.status === "suspended" ? `<button class="btn btn-soft btn-sm" data-act="partner-status" data-id="${p.id}" data-name="${esc(p.name)}" data-s="active" type="button">Activate</button>` : `<button class="btn btn-ghost btn-sm" data-act="partner-status" data-id="${p.id}" data-name="${esc(p.name)}" data-s="suspended" type="button">Suspend</button>`}<button class="btn btn-danger btn-sm" data-act="delete-partner" data-id="${p.id}" data-name="${esc(p.name)}" type="button">Delete</button></div></td></tr>`).join("")}</tbody></table></div>`
    })}`;
  }
  if (tab === "providers") {
    const pv = await API.adminProviders(); body = `<div class="row" style="margin-bottom:12px"><span class="spacer"></span><button class="btn btn-primary btn-sm" data-act="edit-provider" data-id="" type="button">Add provider</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Provider</th><th>Type</th><th>Website</th><th>Status</th><th></th></tr></thead><tbody>${pv.map(p => `<tr><td><div class="row" style="flex-wrap:nowrap">${plogo(p)}<b>${esc(p.name)}</b> ${demoBadge(p.is_demo)}</div></td><td>${KIND[p.kind]}</td><td>${p.website ? esc(p.website) : "—"}</td><td>${p.is_active ? pill("Active", "p-ok") : pill("Hidden", "p-grey")}</td><td><div class="row" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-act="edit-provider" data-id="${p.id}" type="button">Edit</button><button class="btn btn-ghost btn-sm" data-act="toggle-provider" data-id="${p.id}" type="button">${p.is_active ? "Hide" : "Show"}</button></div></td></tr>`).join("")}</tbody></table></div>`;
  }
  if (tab === "plans") body = await adminPlansBody();
  if (tab === "cities") body = await adminCitiesBody();
  if (tab === "locations") {
    const locs = await API.adminLocations(); body = `<div class="row" style="margin-bottom:12px"><span class="muted">Coverage decides which plans a PIN code shows, and which TIP installs there.</span><span class="spacer"></span><button class="btn btn-ghost btn-sm" data-act="add-location" type="button">Add PIN / area</button><button class="btn btn-primary btn-sm" data-act="add-coverage" type="button">Add coverage</button></div>
    <div class="list">${locs.map(l => `<div class="item"><div class="ih"><h3><span class="mono">${esc(l.pincode)}</span> · ${esc(l.area)}</h3><span class="muted small">${esc(l.city || "")}</span><span class="spacer"></span><span class="muted small">${l.coverage.length} provider${l.coverage.length === 1 ? "" : "s"}</span>${REST ? `<button class="btn btn-ghost btn-sm" data-act="edit-location" data-id="${l.id}" data-pin="${esc(l.pincode)}" data-area="${esc(l.area)}" type="button">Edit</button><button class="btn btn-danger btn-sm" data-act="delete-location" data-id="${l.id}" data-pin="${esc(l.pincode)}" data-area="${esc(l.area)}" data-n="${locs.filter(x => x.pincode === l.pincode).length}" type="button">Delete</button>` : ""}</div>
      ${l.coverage.length ? `<div class="row">${l.coverage.map(c => `<span class="pill p-grey" style="padding:5px 10px;white-space:normal">${esc(c.provider ? c.provider.name : "")} · ${esc((c.technology || "").toUpperCase())}${c.tip ? " · TIP " + esc(c.tip.name) : ""} <button class="linkbtn" data-act="remove-coverage" data-id="${c.id}" type="button" aria-label="Remove" style="text-decoration:none;margin-left:4px">×</button></span>`).join("")}</div>` : `<p class="muted small">No provider coverage yet. Customers here can request a callback.</p>`}</div>`).join("")}</div>`;
  }
  if (tab === "commissions") {
    const pay = await payables(API);
    body = `${pay.length ? `<div class="card" style="margin-bottom:16px"><h3>Ready to pay</h3><div class="list" style="margin-top:10px">${pay.map(x => `<div class="row"><b>${esc(x.partner.name)}</b><span class="muted">${x.count} approved</span><span class="spacer"></span><b class="num">${inr(x.total)}</b><button class="btn btn-primary btn-sm" data-act="payout" data-id="${x.partner_id}" data-ids="${x.ids.join(",")}" data-total="${x.total}" type="button">Record payout</button></div>`).join("")}</div></div>` : ""}
    ${serverTable("adm-comm", {
      role: "admin", kind: "commissions", label: "Search payouts", empty: "No commissions yet.", html: cs => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>DSA / TIP</th><th>Booking</th><th>Created</th><th class="r">Amount</th><th>Status</th><th></th></tr></thead><tbody>
    ${cs.map(c => `<tr><td><b>${esc(c.partner.name)}</b><br><span class="muted">${c.partner.type.toUpperCase()}</span></td><td class="mono">${esc(c.booking ? c.booking.ref_code : "")}</td><td>${fdate(c.created_at)}</td><td class="r num">${inr(c.amount)}</td><td>${commPill(c.status)}</td><td>${c.status === "pending" ? `<div class="row" style="flex-wrap:nowrap"><button class="btn btn-soft btn-sm" data-act="commission" data-id="${c.id}" data-s="approved" type="button">Approve</button><button class="btn btn-danger btn-sm" data-act="commission" data-id="${c.id}" data-s="rejected" type="button">Reject</button></div>` : ""}</td></tr>`).join("")}</tbody></table></div>`
    })}`;
  }
  if (tab === "billing") body = await adminBilling();
  if (tab === "team") body = await adminTeam();
  if (tab === "chat") body = await chatTab();
  if (tab === "messages") body = await adminMessages();
  if (tab === "payments") body = serverTable("adm-payouts", { role: "admin", kind: "commissions", label: "Search payouts", empty: "No payments recorded.", filters: () => ({ status: "paid" }), html: ps => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>DSA / TIP</th><th>Method</th><th>Reference</th><th class="r">Amount</th></tr></thead><tbody>${ps.map(p => `<tr><td>${fdate(p.paid_at)}</td><td><b>${esc(p.partner.name)}</b></td><td>${esc({ upi: "UPI", bank_transfer: "Bank transfer", cheque: "Cheque", cash: "Cash" }[p.paid_mode || p.method] || p.paid_mode || p.method || "")}</td><td class="mono">${esc(p.paid_reference || p.reference || "")}</td><td class="r num">${inr(p.amount)}</td></tr>`).join("")}</tbody></table></div>` });
  if (tab === "reports") body = await adminReports();
  if (tab === "settings") body = await adminSettings();
  app.innerHTML = dashShell("Admin dashboard", "Connect Bhai · Indore", tabs, tab, body);
}
/* Reports tab: money and lead numbers come from the server (/reports/dashboard, /reports/money, /reports/partners); the per-partner table is paged. */
async function adminReports() {
  const keys = monthKeys(6), cur = keys[5];
  const [d, m, st, totals] = await Promise.all([dashStats(API, "admin", { months: 6, pins: 50 }), moneyStats(API, 6), API.getSettings(), partnerTotals(API)]);
  const kind = k => m.by_kind[k] || 0, collected = Object.values(m.collected).reduce((a, b) => a + b, 0), payPaid = d.commission.paid, payOwed = d.commission.pending + d.commission.approved;
  const inst = d.leads.installed, closed = inst + d.leads.lost, L = d.leads, counts = Object.keys(LEAD).map(k => [LEAD[k], L[k] || 0]), max = Math.max(1, ...counts.map(c => c[1])), pmax = Math.max(1, ...d.top_pins.map(r => r.leads));
  const target = p => Number(p.lead_target) || Number(st.lead_target_default) || 20, share = Number(st.tip_share_percent) || 0;
  const pt = S.perfType || "tip";
  const money = `<h3 style="margin:0 0 10px;font-size:18px">Connect Bhai money</h3>
    <div class="kpis"><div class="kpi"><span>Collected</span><b>${inr(collected)}</b><small>Reg. ${inrK(kind("registration_fee"))} · platform ${inrK(kind("platform_fee"))} · customers ${inrK(kind("customer_payment"))}</small></div><div class="kpi"><span>Paid to DSAs</span><b>${inr(payPaid)}</b><small>${inr(payOwed)} still owed</small></div>
      <div class="kpi"><span>Net so far</span><b>${inr(collected - payPaid)}</b><small>collected − DSA payouts</small></div><div class="kpi"><span>Due from TIPs & customers</span><b>${inr(m.due)}</b><small>open charges</small></div></div>
    <div class="split"><div class="card"><h3>Collected vs paid out</h3><p class="muted small" style="margin-bottom:10px">Money in (fees, customer payments) and DSA commission paid, by month.</p>${colChart(keys, [{ name: "Collected", color: "var(--ok)", values: keys.map(k => m.collected[k] || 0) }, { name: "Paid to DSAs", color: "var(--warn)", values: keys.map(k => m.paid_out[k] || 0) }], inrK)}</div>
      <div class="card"><h3>Leads delivered to DSAs & TIPs</h3><p class="muted small" style="margin-bottom:10px">Website and callback leads assigned to a DSA or TIP, by month.</p>${colChart(keys, [{ name: "Leads delivered", color: "var(--blue)", values: keys.map(k => m.delivered[k] || 0) }])}</div></div>
    <h3 style="margin:22px 0 6px;font-size:18px">DSA & TIP performance & lead promise · ${mLabel(cur)}</h3>
    <p class="muted small" style="margin-bottom:10px">Targets are set per DSA/TIP (DSA & TIP list → Edit) or by default in Settings.</p>
    <div class="chips" style="margin-bottom:12px">${[["tip", "TIPs"], ["dsa", "DSAs"]].map(([k, l]) => `<button type="button" class="chip" data-act="perf-type" data-v="${k}" aria-pressed="${pt === k}">${l}</button>`).join("")}</div>
    ${serverTable("adm-perf-" + pt, {
    role: "admin", kind: "partners", label: "Search DSAs and TIPs", empty: "No active DSAs or TIPs yet.", filters: () => ({ type: pt, status: "active" }), html: rows => `<div class="tbl-wrap"><table class="tbl" style="min-width:980px"><thead><tr><th>DSA / TIP</th><th>Leads this month</th><th class="r">Total leads</th><th class="r">Installed</th><th class="r">Conversion</th><th class="r">${pt === "tip" ? "Fees paid" : "Commission paid"}</th><th>Contact</th></tr></thead><tbody>
    ${rows.map(p => {
      const t = (totals[pt] || {})[p.id] || { leads: 0, leads_month: 0, installs: 0, paid_amount: 0, comm_paid: 0 }, tg = target(p), ok = t.leads_month >= tg, pct = Math.min(100, Math.round(t.leads_month / (tg || 1) * 100));
      return `<tr><td><b>${esc(p.name)}</b><br><span class="muted small">${p.type.toUpperCase()} · PINs ${esc(p.service_pincodes || "—")}</span></td>
        <td style="min-width:150px"><b>${t.leads_month}</b> / ${tg} ${ok ? pill("Met", "p-ok") : pill("Below", "p-warn")}<div class="prog ${ok ? "ok" : ""}" style="height:8px;margin-top:6px"><i style="width:${pct}%"></i></div></td>
        <td class="r num">${t.leads}</td><td class="r num">${t.installs}</td><td class="r num">${t.leads ? Math.round(t.installs / t.leads * 100) : 0}%</td><td class="r num">${inr(pt === "tip" ? t.paid_amount : t.comm_paid)}</td><td>${contactBtns(p)}</td></tr>`;
    }).join("")}</tbody></table></div>`
  })}`;
  return `${money}<h3 style="margin:22px 0 10px;font-size:18px">Lead funnel</h3><div class="kpis"><div class="kpi"><span>Total leads</span><b>${d.leads_total}</b></div><div class="kpi"><span>Installed</span><b>${inst}</b></div><div class="kpi"><span>Win rate</span><b>${closed ? Math.round(inst / closed * 100) : 0}%</b><small>installed ÷ closed leads</small></div><div class="kpi"><span>Commission paid</span><b>${inr(payPaid)}</b><small>${inr(d.commission.approved)} approved · ${inr(d.commission.pending)} pending</small></div></div>
    <div class="split"><div class="card"><h3>Leads by status</h3><div class="bars" style="margin-top:12px">${counts.map(([l, n]) => `<div class="bar"><span>${l}</span><span class="t"><i style="width:${n / max * 100}%"></i></span><b>${n}</b></div>`).join("")}</div></div>
    <div class="card"><h3>Leads by PIN code</h3><div class="bars" style="margin-top:12px">${d.top_pins.map(r => `<div class="bar"><span class="mono">${esc(r.pincode)}</span><span class="t"><i style="width:${r.leads / pmax * 100}%"></i></span><b>${r.leads}</b></div>`).join("")}</div></div></div>
    <p class="muted small" style="margin-top:10px">${d.installs_total} installations completed, ${d.installs_pending} pending. Reports are calculated by the server from the same database as every portal.</p>`;
}
/* Assign a lead. Before it is booked: a DSA (admin only). Once the DSA has booked it: the TIP who installs it (admin or the lead's DSA). */
async function openAssign(id) {
  const l = await (cachedRow("leads", id) || (API.getLead ? API.getLead(id) : API.adminLeads().then(a => a.find(x => x.id === id))));
  const head = `<p class="muted small" style="margin:2px 0 12px"><span class="mono">${esc(l.ref_code)}</span> · ${esc(l.name)} · PIN ${esc(l.pincode)}</p><p class="small" style="margin-bottom:12px">${planLine(l.plan)}</p>`;
  if (l.status === "booked") {   // the TIP who installs it
    const tips = API.tipOptions ? await API.tipOptions(id) : (await allPages("partners", { type: "tip", status: "active" })).map(p => ({ id: p.id, name: p.name, firm: p.firm, covers_pin: false }));   // the demo layer has no picker call
    if (!tips.length) { toast("There is no active TIP to assign.", true); return; }
    const cur = String(l.assigned_tip_id || "");
    openModal(`<h2>${l.tip ? "Change TIP" : "Assign TIP"}</h2>${head}
      <form class="stack" data-form="assign" data-kind="tip" data-id="${id}" novalidate>
      ${field("as-tip", "TIP (installer)", `<select id="as-tip" name="tip"><option value="">— Choose a TIP —</option>${tips.map(t => `<option value="${t.id}" ${String(t.id) === cur ? "selected" : ""}>${esc(t.name)}${t.firm ? " · " + esc(t.firm) : ""}${t.covers_pin ? " (covers " + esc(l.pincode) + ")" : ""}</option>`).join("")}</select>`, "TIPs covering this PIN code are listed first. The TIP only installs.")}
      <button class="btn btn-primary" type="submit">${l.tip ? "Change TIP" : "Assign TIP"}</button></form>`);
    return;
  }
  if (me().role !== "admin") { toast("Only admin can assign a DSA.", true); return; }
  const dsas = await allPages("partners", { type: "dsa", status: "active" });
  const serves = p => String(p.service_pincodes || "").split(/[,\s]+/).includes(l.pincode);
  const cur = String(l.assigned_dsa_id || (dsas.find(serves) || {}).id || "");
  openModal(`<h2>${l.dsa ? "Reassign DSA" : "Assign DSA"}</h2>${head}
    <form class="stack" data-form="assign" data-kind="dsa" data-id="${id}" novalidate>
    ${field("as-dsa", "DSA", `<select id="as-dsa" name="dsa"><option value="">— Choose a DSA —</option>${dsas.map(p => `<option value="${p.id}" ${String(p.id) === cur ? "selected" : ""}>${esc(p.name)}${serves(p) ? " (serves " + esc(l.pincode) + ")" : ""}</option>`).join("")}</select>`, "The DSA calls the customer, follows up and books the installation. DSAs serving this PIN code are marked.")}
    <button class="btn btn-primary" type="submit">${l.dsa ? "Reassign DSA" : "Assign DSA"}</button></form>`);
}
async function openPartner(id) {
  const p = id ? (cachedRow("partners", id) || (API.getPartner ? await API.getPartner(id) : (await API.adminPartners()).find(x => x.id === id))) : { type: "dsa", commission_per_install: 300 };
  openModal(`<h2>${id ? "DSA / TIP details" : "Add DSA / TIP"}</h2><form class="stack" data-form="partner" data-id="${id || ""}" novalidate style="margin-top:12px">
    <div class="grid2">${field("pt-type", "Type", `<select id="pt-type" name="type" ${REST && id ? "disabled" : ""}><option value="dsa" ${p.type === "dsa" ? "selected" : ""}>DSA</option><option value="tip" ${p.type === "tip" ? "selected" : ""}>TIP</option></select>`)}
    ${field("pt-name", "Name", `<input id="pt-name" name="name" value="${esc(p.name || "")}">`)}
    ${field("pt-firm", "Firm", `<input id="pt-firm" name="firm" value="${esc(p.firm || "")}">`)}
    ${field("pt-phone", "Mobile", `<input id="pt-phone" name="phone" inputmode="numeric" maxlength="16" value="${esc(p.phone || "")}">`)}
    ${field("pt-email", "Email", `<input id="pt-email" name="email" type="email" value="${esc(p.email || "")}">`)}
    ${REST ? "" : field("pt-comm", "Per-install amount (₹)", `<input id="pt-comm" name="commission_per_install" type="number" min="0" step="50" value="${esc(p.commission_per_install || 0)}">`, "DSA: payout Connect Bhai pays. TIP: platform fee the TIP pays (+GST).")}
    ${REST ? "" : field("pt-target", "Leads promised per month", `<input id="pt-target" name="lead_target" type="number" min="0" step="1" value="${esc(p.lead_target || "")}" placeholder="Default">`, "Shown on the DSA's dashboard as Connect Bhai's monthly lead promise. Empty = default from Settings.")}</div>
    ${REST && id ? `<div class="grid2">${field("pt-addr", "Address", `<input id="pt-addr" name="address" value="${esc(p.address || "")}" maxlength="255">`)}${field("pt-pin", "PIN code", `<input id="pt-pin" name="pincode" inputmode="numeric" maxlength="6" value="${esc(p.pincode || "")}">`)}</div>
    ${p.type === "dsa" ? field("pt-pins", "Service PIN codes", `<input id="pt-pins" name="service_pincodes" value="${esc(p.service_pincodes || "")}" placeholder="452010, 452016">`, "New leads in these PIN codes go to this DSA. When several DSAs serve a PIN code, the one with the fewest open leads gets the next lead.") : ""}
    <p class="muted small">Works in any status: pending, active or suspended. Status is changed with Approve / Suspend / Activate. Per installation, ${p.type === "dsa" ? "a DSA earns" : "a TIP pays"} <b>${inr(p.commission_per_install)}</b>${p.type === "dsa" ? "" : " + GST"}. This amount and the monthly lead promise are the same for every ${p.type === "dsa" ? "DSA" : "TIP"} and are set in Settings.</p>` : field("pt-pins", "Service PIN codes", `<input id="pt-pins" name="service_pincodes" value="${esc(p.service_pincodes || "")}">`)}
    ${id && (p.aadhaar_last4 || p.pan_last4 || p.bank_name || p.upi_id) ? `<div class="facts" style="margin:4px 0"><div><span>Aadhaar</span><b>${p.aadhaar_last4 ? "•••• " + esc(p.aadhaar_last4) : "—"}</b></div><div><span>PAN</span><b>${p.pan_last4 ? "••••• " + esc(p.pan_last4) : "—"}</b></div><div><span>Bank</span><b>${esc(p.bank_name || "—")}</b></div><div><span>Account</span><b>${p.bank_account_last4 ? "•••• " + esc(p.bank_account_last4) : "—"}</b></div><div><span>IFSC</span><b class="mono">${esc(p.bank_ifsc || "—")}</b></div><div><span>UPI</span><b>${esc(p.upi_id || "—")}</b></div></div>` : ""}
    ${REST && id ? "" : `<label class="check"><input type="checkbox" name="kyc_verified" ${p.kyc_verified ? "checked" : ""}> KYC and agreement verified</label>`}
    ${REST && id ? `<div class="stack" id="pt-docs"><h3 style="margin:6px 0 0">KYC documents</h3><span class="muted small">Loading…</span></div>` : ""}
    <button class="btn btn-primary" type="submit">Save</button></form>`);
  if (REST && id) API.partnerDocs(id).then(r => {
    const box = document.getElementById("pt-docs"); if (!box) return;
    box.innerHTML = `<h3 style="margin:6px 0 0">KYC documents</h3>` + (!r.configured ? `<span class="muted small">File uploads are not configured on the server yet (Cloudinary keys).</span>` : r.documents.length ? r.documents.map(d => `<a class="btn btn-ghost btn-sm" href="${esc(d.url)}" target="_blank" rel="noopener">Open ${esc(d.label)}${d.format ? " (" + esc(String(d.format).toUpperCase()) + ")" : ""}</a>`).join("") + `<span class="muted small">Links work for 10 minutes. Files are private in Cloudinary.</span>` : `<span class="muted small">No documents uploaded.</span>`);
  }).catch(() => { });
}
async function openProvider(id) {
  const p = id ? (await API.adminProviders()).find(x => x.id === id) : { kind: "local_isp" };
  openModal(`<h2>${id ? "Edit provider" : "Add provider"}</h2><form class="stack" data-form="provider" data-id="${id || ""}" novalidate style="margin-top:12px">
    ${field("pv-name", "Provider name", `<input id="pv-name" name="name" value="${esc(p.name || "")}">`)}
    ${field("pv-kind", "Type", `<select id="pv-kind" name="kind">${Object.entries(KIND).map(([k, l]) => `<option value="${k}" ${p.kind === k ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
    ${field("pv-web", "Website (optional)", `<input id="pv-web" name="website" value="${esc(p.website || "")}">`)}
    <button class="btn btn-primary" type="submit">Save provider</button></form>`);
}
async function openCoverage() {
  const [locs, pv, pt] = await Promise.all([API.adminLocations(), API.adminProviders(), allPages("partners", { type: "tip", status: "active" })]);
  openModal(`<h2>Add coverage</h2><form class="stack" data-form="coverage" novalidate style="margin-top:12px">
    ${field("cv-loc", "PIN code / area", `<select id="cv-loc" name="location_id"><option value="">Choose</option>${locs.map(l => `<option value="${l.id}">${l.pincode} · ${esc(l.area)}</option>`).join("")}</select>`)}
    ${field("cv-prov", "Provider", `<select id="cv-prov" name="provider_id"><option value="">Choose</option>${pv.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>`)}
    ${field("cv-tip", "Installing TIP (optional)", `<select id="cv-tip" name="tip_partner_id"><option value="">— None —</option>${pt.filter(p => p.type === "tip" && p.status === "active").map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>`)}
    ${field("cv-tech", "Technology", `<select id="cv-tech" name="technology"><option value="ftth">FTTH (fiber)</option><option value="cable">Cable</option><option value="wireless">Wireless</option></select>`)}
    <button class="btn btn-primary" type="submit">Save coverage</button></form>`);
}

/* =====================================================================
   LOGIN
   ===================================================================== */
function openLogin(tab) {
  const acc = LIVE ? [] : API.demoAccounts(), otp = tab === "otp";
  const desc = { customer: "Bookings, complaints, my modem (restart, Wi-Fi), speed tests", dsa: "Leads, follow-ups, installation status, commission", tip: "Bookings, installations, tickets, modem control", admin: "DSAs &amp; TIPs, plans, team logins, payments, reports" };
  openModal(`<h2>Log in to Connect Bhai</h2>
    <div class="chips" style="margin:10px 0 14px"><button type="button" class="chip" data-act="login-tab" data-v="pw" aria-pressed="${!otp}">Mobile + password</button><button type="button" class="chip" data-act="login-tab" data-v="otp" aria-pressed="${otp}">WhatsApp OTP</button></div>
    ${otp ? `<p class="muted" style="margin-bottom:12px">We'll send a 6-digit OTP to your WhatsApp. New here? The same step creates your customer account.</p>
      <form class="stack" data-form="otp-send" data-purpose="login" novalidate>${field("lg-phone", "WhatsApp number", `<input id="lg-phone" name="phone" inputmode="numeric" maxlength="16" autocomplete="tel-national" placeholder="10-digit mobile">`)}
      <button class="btn btn-primary" type="submit">Send OTP on WhatsApp</button></form>`
      : `<form class="stack" data-form="pw-login" novalidate>${field("pl-phone", "Username (your mobile number)", `<input id="pl-phone" name="phone" inputmode="numeric" maxlength="16" autocomplete="username" placeholder="10-digit mobile">`)}
      ${field("pl-pw", "Password", `<input id="pl-pw" name="password" type="password" autocomplete="current-password">`)}
      <button class="btn btn-primary" type="submit">Log in</button></form>
      <p class="small" style="margin-top:10px"><button class="linkbtn" data-act="forgot-pw" type="button">Forgot password?</button> <span class="muted">Reset it with an OTP on WhatsApp.</span></p>`}
    ${otp ? "" : `<div class="row" style="margin-top:14px;gap:6px"><button class="chip" type="button" data-act="fill-admin">Admin</button><span class="small muted">Fills the admin username. Enter the password and tap Log in.</span></div>`}`);
}
function openForgot() {
  openModal(`<h2>Reset your password</h2><p class="muted" style="margin:4px 0 14px">Enter your registered mobile number. We'll send an OTP on WhatsApp, then you set a new password.</p>
    <form class="stack" data-form="otp-send" data-purpose="reset" novalidate>${field("lg-phone", "Mobile number", `<input id="lg-phone" name="phone" inputmode="numeric" maxlength="16" autocomplete="tel-national">`)}
    <button class="btn btn-primary" type="submit">Send OTP on WhatsApp</button></form>
    <p class="small" style="margin-top:10px"><button class="linkbtn" data-act="login" type="button">Back to log in</button></p>`);
}
function openSetPassword(mode) {   // mode: first (one-time password) · reset (after OTP) · change (from profile)
  const u = me(), needCur = mode === "change" && (u.pw || u.has_password) && !u.must_change;
  const head = { first: ["Set your own password", "You logged in with a one-time password. Choose a new password to continue."], reset: ["Set a new password", "Your number is verified. Choose a new password."], change: [(u.pw || u.has_password) ? "Change password" : "Create a password", "Use it with your mobile number to log in next time."] }[mode];
  openModal(`<h2>${head[0]}</h2><p class="muted" style="margin:4px 0 14px">${head[1]} Username: <b>${esc(fmtPh(u.phone))}</b></p>
    <form class="stack" data-form="set-password" data-mode="${mode}" novalidate>
      ${needCur ? field("sp-cur", "Current password", `<input id="sp-cur" name="current" type="password" autocomplete="current-password">`) : ""}
      ${field("sp-new", "New password", `<input id="sp-new" name="next" type="password" autocomplete="new-password">`, PW_RULE)}
      ${field("sp-new2", "Confirm new password", `<input id="sp-new2" name="next2" type="password" autocomplete="new-password">`)}
      <button class="btn btn-primary" type="submit">Save password</button></form>`);
}
function credBlock(l, who) {
  return `<div class="card stack" style="text-align:left;border-left:4px solid var(--ok);width:100%">
    <b>${who || "Login details"}</b>
    <div class="facts"><div><span>Username</span><b class="mono">${esc(l.username)}</b></div><div><span>One-time password</span><b class="mono" style="font-size:18px;letter-spacing:.06em">${esc(l.temp_password)}</b></div></div>
    <p class="muted small">Also sent on WhatsApp to +91 ${esc(fmtPh(l.username).replace("+91 ", ""))}. It works once: at first login a new password must be set, and a confirmation message is sent.</p>
    <div class="row"><button class="btn btn-ghost btn-sm" data-act="copy-cred" data-v="${esc("Username: " + l.username + "  One-time password: " + l.temp_password)}" type="button">Copy</button></div></div>`;
}
function afterLogin(u) {
  try { localStorage.setItem("cb-session", u.id); } catch (e) { }
  renderHeader();
  if (u.must_change) { openSetPassword("first"); return; }
  if (!u.full_name) { openModal(`<h2>Welcome to Connect Bhai</h2><p class="muted" style="margin:4px 0 14px">What should we call you?</p><form class="stack" data-form="set-name" novalidate>${field("nm-name", "Full name", `<input id="nm-name" name="name" autocomplete="name">`)}<button class="btn btn-primary" type="submit">Continue</button></form>`); return; }
  entering(true); closeModal(); toast("Welcome, " + (u.role === "customer" ? u.full_name.split(" ")[0] : u.full_name) + "."); go(ROLE_HOME[u.role]);
}
let otpTimer = null;
function openOtpStep(phone, purpose) {
  openModal(`<h2>Enter WhatsApp OTP</h2><p class="muted" style="margin:4px 0 14px">Sent to WhatsApp <b>+91 ${esc(phone.slice(0, 5))} ${esc(phone.slice(5))}</b>${purpose === "request" ? ". This confirms your number before we create the request." : ""}</p>
    <form class="stack" data-form="otp-verify" data-phone="${phone}" data-purpose="${purpose}" novalidate>
      ${field("lg-otp", "6-digit OTP", `<div class="otp-boxes" role="group" aria-label="6-digit OTP">${[0, 1, 2, 3, 4, 5].map(i => `<input class="otp-box" data-otp-i="${i}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="${i ? "off" : "one-time-code"}" aria-label="Digit ${i + 1}">`).join("")}</div><input type="hidden" id="lg-otp" name="otp" value="">`)}
      <button class="btn btn-primary" type="submit" disabled>Verify${purpose === "request" ? " and submit request" : ""}</button></form>
    <p class="muted small" style="margin-top:12px;text-align:center">Didn't get it? <button class="linkbtn" id="otp-resend" data-act="otp-resend" data-phone="${phone}" type="button" disabled>Resend in 30s</button> · <button class="linkbtn" data-act="${purpose === "reset" ? "forgot-pw" : "login-otp"}" type="button">Change number</button></p>`);
  const first = document.querySelector(".otp-box"); if (first) first.focus();
  let t = 30; clearInterval(otpTimer);
  otpTimer = setInterval(() => { const r = document.getElementById("otp-resend"); if (!r) return clearInterval(otpTimer); t--; if (t <= 0) { clearInterval(otpTimer); r.disabled = false; r.textContent = "Resend OTP"; } else r.textContent = "Resend in " + t + "s"; }, 1000);
}
function showRequestDone(r, d) {
  const u = me();
  openModal(`<div style="text-align:center;display:grid;gap:12px;justify-items:center;padding:8px 0"><span class="avatar" style="width:56px;height:56px;font-size:24px;background:var(--ok)">✓</span>
    <h2 style="padding:0">Request submitted</h2><p class="muted">Your request number is</p><p class="mono" style="font-size:22px;font-weight:600;color:var(--blue)">${esc(r.ref_code)}</p>
    <p class="muted">An assigned TIP will call you on <b>${esc(d.phone)}</b>. ${u && u.role === "customer" ? "Track every step in your dashboard." : ""}</p>
    ${u && u.role === "customer" ? `<button class="btn btn-primary" data-go="my" type="button">Track in dashboard</button>` : `<button class="btn btn-ghost" data-act="close-modal" type="button">Done</button>`}</div>`);
  S.compare = []; updateCompareBar(); renderHeader();
}

/* =====================================================================
   PAYMENTS (Razorpay) · LOCATION · WHATSAPP LOG
   ===================================================================== */
const KIND_NAME = { registration_fee: "Registration fee", platform_fee: "Platform fee", customer_payment: "Customer payment", other: "Other" };
const CH_TONE = { due: "p-warn", paid: "p-ok", failed: "p-bad", cancelled: "p-grey", waived: "p-grey" };
const chPill = s => pill(s[0].toUpperCase() + s.slice(1), CH_TONE[s] || "p-grey");
function chargeList(cs, emptyMsg) {
  const due = cs.filter(c => ["due", "failed"].includes(c.status)), sum = a => a.reduce((t, c) => t + Number(c.amount), 0);
  return `<div class="kpis"><div class="kpi"><span>Due now</span><b>${inr(sum(due))}</b><small>${due.length} payment${due.length === 1 ? "" : "s"}</small></div><div class="kpi"><span>Paid</span><b>${inr(sum(cs.filter(c => c.status === "paid")))}</b></div></div>
  ${cs.length ? chargeRows(cs)
      : `<div class="empty"><b>${emptyMsg}</b></div>`}`;
}
const chargeRows = cs => `<div class="list">${cs.map(c => `<div class="item"><div class="ih"><h3>${esc(c.description)}</h3>${chPill(c.status)}<span class="spacer"></span><span class="mono muted">${esc(c.ref_code)}</span></div>
    <div class="meta"><span>${KIND_NAME[c.kind] || c.kind}</span><span>${inr(c.base_amount)} + GST ${inr(c.gst_amount)} = <b>${inr(c.amount)}</b></span><span>${c.status === "paid" ? "Paid " + fdate(c.paid_at) + (c.gateway_payment_id ? ` · <span class="mono">${esc(c.gateway_payment_id)}</span>` : "") : "Raised " + fdate(c.created_at)}</span></div>
    ${["due", "failed"].includes(c.status) ? `<div class="row"><button class="btn btn-primary btn-sm" data-act="pay" data-id="${c.id}" type="button">Pay ${inr(c.amount)}</button><span class="muted small">UPI, cards, net banking via Razorpay</span></div>` : ""}</div>`).join("")}</div>`;
function customerPayCard(leads) {
  const o = [];
  leads.filter(l => l.status !== "lost" && l.plan).forEach(l => {
    o.push([`${l.id}|First month rental · ${l.plan.name}|${l.plan.price_monthly}`, `First month rental · ${l.plan.name} (${l.ref_code}) · ${inr(l.plan.price_monthly)}`]);
    if (Number(l.plan.install_charge) > 0) o.push([`${l.id}|Installation charge · ${l.plan.name}|${l.plan.install_charge}`, `Installation charge · ${l.plan.name} (${l.ref_code}) · ${inr(l.plan.install_charge)}`]);
    o.push([`${l.id}|Monthly bill / recharge · ${l.plan.name}|${l.plan.price_monthly}`, `Monthly bill / recharge (${l.ref_code}) · ${inr(l.plan.price_monthly)}`]);
  });
  o.push(["|Router / accessory purchase|", "Router / accessory purchase (enter amount)"], ["|Other payment to Connect Bhai|", "Other payment (enter amount)"]);
  const first = o[0][0].split("|")[2] || "";
  return `<form class="card paycard" data-form="cust-pay" novalidate style="margin-bottom:18px;border-left:4px solid var(--blue)">
    <div><h3>Make a payment</h3><p class="muted small">Pay Connect Bhai online. The amount includes GST. The payment then shows below under <b>Paid</b>.</p></div>
    <div class="grid2">${field("cp-what", "What are you paying for", `<select id="cp-what" name="what">${o.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select>`)}
    ${field("cp-amt", "Amount (₹, incl. GST)", `<input id="cp-amt" name="amount" type="number" min="1" step="1" inputmode="numeric" value="${esc(first)}">`)}</div>
    <div class="methods" aria-label="Payment methods"><span>UPI · GPay, PhonePe, Paytm, BHIM</span><span>Debit / credit card</span><span>Net banking</span><span>Wallets</span></div>
    <div class="row"><button class="btn btn-primary" type="submit">Continue to pay</button><span class="muted small">Secure checkout by Razorpay</span></div></form>`;
}
function activationCard(p, cs, dsa) {
  const fee = dsa ? null : cs.find(c => c.kind === "registration_fee" && ["due", "failed"].includes(c.status));   // a DSA never pays a registration fee
  if (dsa && p.status !== "suspended") return `<div class="card stack" style="max-width:640px;border-left:4px solid var(--blue)"><span class="eyebrow">Activate your account</span>
    <h2 style="font-size:24px">Your application is under review.</h2>
    <p class="muted">Admin is verifying your KYC and agreement. You'll get a WhatsApp message when approved. DSA registration is free.</p></div>`;
  if (p.status === "suspended") return `<div class="empty"><b>Your account is suspended.</b><p class="muted">Please contact Connect Bhai admin.</p></div>`;
  return `<div class="card stack" style="max-width:640px;border-left:4px solid var(--blue)"><span class="eyebrow">Activate your account</span>
    <h2 style="font-size:24px">${p.approved_at ? "You're approved. Pay the registration fee to start getting leads." : "Your application is under review."}</h2>
    <p class="muted">${p.approved_at ? "Leads, bookings and payouts open as soon as the payment is confirmed." : "Admin is verifying your KYC and agreement. You'll get a WhatsApp message when approved."}</p>
    ${fee ? `<div class="facts"><div><span>${esc(fee.description)}</span><b>${inr(fee.base_amount)}</b></div><div><span>GST</span><b>${inr(fee.gst_amount)}</b></div><div><span>Total</span><b>${inr(fee.amount)}</b></div></div>
      <div class="row"><button class="btn btn-primary" data-act="pay" data-id="${fee.id}" type="button">Pay ${inr(fee.amount)} now</button><span class="muted small">UPI, cards, net banking via Razorpay</span></div>` : ""}</div>`;
}
async function openPay(id) {
  const c = (await API.myCharges()).find(x => x.id === id); if (!c) { toast("Payment not found.", true); return; }
  if (LIVE) { openModal(`<h2>Opening secure payment…</h2><p class="muted" style="margin-top:8px">Complete the payment in the Razorpay window.</p>`); try { const r = await API.payCharge(id); paySuccess(r); } catch (e) { closeModal(); toast(errMsg(e), true); } return; }
  openModal(`<h2>Pay ${inr(c.amount)}</h2><p class="notice" style="margin:10px 0 14px">Test checkout: no money is charged in this prototype. On the live site this opens Razorpay.</p>
    <div class="facts" style="margin-bottom:14px"><div><span>${esc(c.description)}</span><b>${inr(c.base_amount)}</b></div><div><span>GST</span><b>${inr(c.gst_amount)}</b></div><div><span>Total</span><b>${inr(c.amount)}</b></div><div><span>Reference</span><b class="mono">${esc(c.ref_code)}</b></div></div>
    <form class="stack" data-form="pay-charge" data-id="${c.id}" novalidate><button class="btn btn-primary btn-block" type="submit">Pay ${inr(c.amount)}</button>
      <p class="muted small" style="text-align:center;margin:0">${LIVE ? "🔒 Secure payment by Razorpay. You choose UPI, card, net banking or wallet on the next screen." : "Test checkout: nothing is charged."}</p></form>`);
}
function openAppFee(c, d, existing) {
  openModal(`<h2>Pay registration fee</h2><p class="muted" style="margin:4px 0 12px">${existing ? "Your application is already with us" : "Application received"} for <b>${esc(d.name)}</b> (+91 ${esc(d.phone)}). Pay the registration fee now to complete your registration. Admin then checks your KYC and agreement and activates your account.</p>
    ${LIVE ? "" : `<p class="notice" style="margin-bottom:14px">Test checkout: no money is charged in this prototype. On the live site this opens Razorpay.</p>`}
    <div class="facts" style="margin-bottom:14px"><div><span>${esc(c.description)}</span><b>${inr(c.base_amount)}</b></div><div><span>GST</span><b>${inr(c.gst_amount)}</b></div><div><span>Total</span><b>${inr(c.amount)}</b></div><div><span>Reference</span><b class="mono">${esc(c.ref_code)}</b></div></div>
    <form class="stack" data-form="pay-public" data-id="${c.id}" data-phone="${esc(d.phone)}" data-name="${esc(d.name)}" data-email="${esc(d.email || "")}" novalidate><button class="btn btn-primary btn-block" type="submit">Pay ${inr(c.amount)}</button>
      <p class="muted small" style="text-align:center;margin:0">${LIVE ? "🔒 Secure payment by Razorpay. You choose UPI, card, net banking or wallet on the next screen." : "Test checkout: nothing is charged."}</p></form>
    <p class="muted small" style="margin-top:10px">You can also pay later: log in with WhatsApp OTP on this mobile number and open Payments.</p>`);
}
function paySuccess(c) {
  openModal(`<div style="text-align:center;display:grid;gap:10px;justify-items:center;padding:8px 0"><span class="avatar" style="width:56px;height:56px;font-size:24px;background:var(--ok)">✓</span>
    <h2 style="padding:0">Payment successful</h2><p class="muted">${esc(c.description)}</p><p style="font-family:var(--display);font-size:28px;font-weight:800">${inr(c.amount)}</p>
    <p class="muted small">Receipt <span class="mono">${esc(c.ref_code)}</span> · Payment ID <span class="mono">${esc(c.gateway_payment_id || "")}</span><br>Keep this reference for your records.</p>
    ${c.kind === "registration_fee" ? `<p class="notice info">${me() ? "Registration fee received and you are logged in. Admin will verify your KYC and agreement, then leads open in your portal." : (c.login ? "Registration confirmed. You can log in right away with the details below. Admin will verify your KYC and agreement, then leads open in your portal. Log in with your mobile number to see the status." : "Registration fee received. Admin will verify your KYC and agreement and activate your account.")}</p>` : ""}${c.login ? credBlock(c.login, "Your Connect Bhai login is ready") + `<button class="btn btn-primary" data-act="login" type="button">Log in now</button>` : (me() ? `<button class="btn btn-primary" data-go="${ROLE_HOME[me().role]}" type="button">Go to my dashboard</button>` : `<button class="btn btn-primary" data-act="close-modal" type="button">Done</button>`)}</div>`);
  render();
}
async function adminTeam() {
  const f = S.teamFilter || "admin";
  const pwTxt = p => !p.has_password ? pill("No password · OTP only", "p-grey") : p.must_change ? pill("One-time password issued", "p-warn") : pill("Own password set", "p-ok");
  return `<div class="card row" style="margin-bottom:14px;padding:14px 16px"><div style="min-width:0;flex:1 1 300px"><b>Create logins for your team</b><p class="muted small">Username is the person's mobile number. A one-time password is sent on WhatsApp; they set their own password at first login. TIPs and DSAs also get their login automatically when they register and pay the fee.</p></div><button class="btn btn-primary btn-sm" data-act="create-user" type="button">Create login</button></div>
    <div class="chips" style="margin-bottom:12px">${[["admin", "Admins"], ["tip", "TIPs"], ["dsa", "DSAs"], ["customer", "Customers"]].map(([k, l]) => `<button type="button" class="chip" data-act="team-filter" data-v="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>
    ${serverTable("adm-team", {
    role: "admin", kind: "team", label: "Search logins", empty: "No users here.", filters: () => ({ role: S.teamFilter || "admin" }), html: rows => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Role</th><th>Username (mobile)</th><th>Email</th><th>Password</th><th>Status</th><th></th></tr></thead><tbody>
    ${rows.map(p => `<tr><td><b>${esc(p.full_name || "—")}</b>${p.partner && p.partner.name !== p.full_name ? `<br><span class="muted small">${esc(p.partner.name)}</span>` : ""}</td><td>${pill(ROLE_NAME[p.role], { admin: "p-bad", tip: "p-blue", dsa: "p-blue", customer: "p-grey" }[p.role])}</td><td class="mono">${esc(p.phone || "")}</td><td>${p.email ? esc(p.email) : "—"}</td><td>${pwTxt(p)}${p.pw_set_at ? `<br><span class="muted small">${fdt(p.pw_set_at)}</span>` : ""}</td><td>${p.disabled ? pill("Disabled", "p-bad") : pill("Active", "p-ok")}</td>
      <td><div class="row" style="flex-wrap:nowrap"><button class="btn btn-soft btn-sm" data-act="reset-user" data-id="${p.id}" data-name="${esc(p.full_name || p.phone)}" type="button">Reset password</button>${p.id === me().id ? "" : `<button class="btn ${p.disabled ? "btn-ghost" : "btn-danger"} btn-sm" data-act="toggle-user" data-id="${p.id}" data-v="${p.disabled ? 0 : 1}" type="button">${p.disabled ? "Enable" : "Disable"}</button>`}</div></td></tr>`).join("")}</tbody></table></div>`
  })}`;
}
function openCreateUser() {
  openModal(`<h2>Create login</h2><p class="muted" style="margin:4px 0 12px">The username is the mobile number. A one-time password is created and sent on WhatsApp.</p>
    <form class="stack" data-form="create-user" novalidate><div class="grid2">
      ${field("cu-role", "Role", `<select id="cu-role" name="role"><option value="dsa">DSA (Direct Selling Agent)</option><option value="tip">TIP (installer)</option><option value="admin">Admin</option></select>`)}
      ${field("cu-name", "Full name", `<input id="cu-name" name="name" autocomplete="off">`)}
      ${field("cu-phone", "Mobile number (username)", `<input id="cu-phone" name="phone" inputmode="numeric" maxlength="16" autocomplete="off">`)}
      ${field("cu-email", "Email", `<input id="cu-email" name="email" type="email" autocomplete="off">`)}
      ${field("cu-firm", "Firm / shop name", `<input id="cu-firm" name="firm">`)}
      ${field("cu-pins", "Service PIN codes", `<input id="cu-pins" name="pincodes" placeholder="452010, 452016">`)}</div>
      <p class="muted small" id="cu-note">For a new DSA or TIP, an account is also created (active, registration fee waived). If the DSA or TIP already exists with this mobile, the login is linked to it.</p>
      <button class="btn btn-primary" type="submit">Create login and send on WhatsApp</button></form>`);
}
/* The Fees form. With the real API every money setting is a row in the database table app_settings, edited here (no environment variables). */
function feeFields(st) {
  if (REST) return `<div class="grid2">${field("st-tip", "TIP registration fee (₹, before GST)", `<input id="st-tip" name="registration_fee_tip" type="number" min="0" value="${esc(st.registration_fee_tip)}">`, "Paid by a TIP when registering")}
      ${field("st-inst", "TIP install fee per installed lead (₹, before GST)", `<input id="st-inst" name="tip_install_fee" type="number" min="0" value="${esc(st.tip_install_fee)}">`, "Charged to the TIP when an installation is completed")}
      ${field("st-cp", "Care Plan fee per lead (₹, before GST)", `<input id="st-cp" name="care_plan_fee_per_lead" type="number" min="0" value="${esc(st.care_plan_fee_per_lead)}">`, "Paid by the TIP to turn Care Plan on for a customer")}
      ${field("st-pay", "DSA payout per installed lead (₹)", `<input id="st-pay" name="dsa_payout_per_lead" type="number" min="0" value="${esc(st.dsa_payout_per_lead)}">`, "Paid to the DSA only when the lead is installed")}
      ${field("st-job", "TIP earning per installed job (₹)", `<input id="st-job" name="tip_job_earning" type="number" min="0" value="${esc(st.tip_job_earning)}">`, "Amount shown in the “job completed” WhatsApp to the TIP")}
      ${field("st-target", "Leads promised per DSA / TIP per month", `<input id="st-target" name="lead_target_default" type="number" min="0" value="${esc(st.lead_target_default ?? 20)}">`, "Same for every DSA and TIP; shown as their monthly target")}
      ${field("st-gst", "GST (%)", `<input id="st-gst" name="gst_percent" type="number" min="0" max="100" value="${esc(st.gst_percent)}">`, "Added to all TIP charges")}</div>`;
  return `<div class="grid2">${field("st-tip", "TIP registration fee (₹)", `<input id="st-tip" name="registration_fee_tip" type="number" min="0" value="${esc(st.registration_fee_tip)}">`)}
      ${field("st-gst", "GST (%)", `<input id="st-gst" name="gst_percent" type="number" min="0" max="28" value="${esc(st.gst_percent)}">`)}
      ${field("st-target", "Leads promised per DSA/TIP / month", `<input id="st-target" name="lead_target_default" type="number" min="0" value="${esc(st.lead_target_default ?? 20)}">`, "Default; set per DSA/TIP in the DSA & TIP list")}
      ${field("st-share", "TIP share of monthly rental (%)", `<input id="st-share" name="tip_share_percent" type="number" min="0" max="100" value="${esc(st.tip_share_percent ?? 0)}">`, "Used to estimate TIP income on their dashboard")}</div>`;
}
/* Admin > Settings: every money setting is a row in the database table app_settings, saved here (no environment variables). */
async function adminSettings() {
  const st = await API.getSettings(), auto = Number(st.auto_assign) === 1;
  return `<div class="split"><form class="card stack" data-form="settings" novalidate><h3>Fees &amp; payouts</h3>
      <p class="muted small">Saved in the database. Changes apply to new charges only; amounts already charged do not change.</p>
      ${feeFields(st)}
      <button class="btn btn-primary" type="submit">Save settings</button></form>
    <div class="card stack"><h3>Lead assignment</h3>
      <div class="row" style="align-items:flex-start;gap:12px"><div style="min-width:0;flex:1 1 220px"><b>Auto-assign new leads by PIN code is ${auto ? "ON" : "OFF"}</b>
        <p class="muted small">${auto ? "Each new request goes to the DSA serving that PIN code with the fewest open leads. The DSA calls, follows up and books it; then admin or the DSA assigns the TIP who installs it." : "Every new request waits in Leads for you to assign it."}</p></div>
        <button class="btn ${auto ? "btn-ghost" : "btn-primary"} btn-sm" data-act="auto-assign" data-v="${auto ? 0 : 1}" type="button">Turn ${auto ? "off" : "on"}</button></div></div></div>`;
}
async function adminBilling() {
  const [m, st] = await Promise.all([moneyStats(API, 1), API.getSettings()]);
  const f = S.billFilter || "due", month = new Date().toISOString().slice(0, 7);
  const cnt = await Promise.all(["due", "paid", "failed", "waived", "all"].map(k => fetchPage(API, "admin", "charges", { status: k, limit: 1 }).then(r => [k, r.total])));   // one count per chip, not the lists
  const n = Object.fromEntries(cnt);
  return `<div class="kpis"><div class="kpi"><span>Due to Connect Bhai</span><b>${inr(m.due)}</b></div><div class="kpi"><span>Collected this month</span><b>${inr(m.collected[month] || 0)}</b></div>
    <div class="kpi"><span>Registration fees</span><b>${inr(m.by_kind.registration_fee || 0)}</b><small>collected</small></div><div class="kpi"><span>Platform fees</span><b>${inr(m.by_kind.platform_fee || 0)}</b><small>collected</small></div></div>
  <div class="split" style="margin-bottom:16px"><div class="card stack"><h3>Fees &amp; GST</h3><p class="muted">Registration, install and Care Plan fees, DSA payout and GST are changed in Settings. Changes apply to new charges only.</p><button class="btn btn-soft" data-tab="settings" type="button">Open Settings</button></div>
    <div class="card stack"><h3>Collect money</h3><p class="muted">Create a charge for a TIP or customer. They get a WhatsApp message and can pay online with UPI, card or net banking through Razorpay.</p><button class="btn btn-primary" data-act="new-charge" type="button">Create charge</button></div></div>
  <div class="chips" style="margin-bottom:12px">${[["due", "Due"], ["paid", "Paid"], ["failed", "Failed"], ["waived", "Waived"], ["all", "All"]].map(([k, l]) => `<button type="button" class="chip" data-act="billing-filter" data-v="${k}" aria-pressed="${f === k}">${l} (${n[k]})</button>`).join("")}</div>
  ${serverTable("adm-bills", {
    role: "admin", kind: "charges", label: "Search charges", empty: "No charges here.", filters: () => ({ status: S.billFilter || "due" }), html: shown => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ref</th><th>Payer</th><th>Type</th><th>Description</th><th class="r">Total</th><th>Status</th><th></th></tr></thead><tbody>
  ${shown.map(c => `<tr><td class="mono">${esc(c.ref_code)}<br><span class="muted">${fdate(c.created_at)}</span></td><td><b>${esc(c.partner ? c.partner.name : c.customer ? c.customer.full_name || "Customer" : "")}</b><br><span class="muted">${c.partner ? c.partner.type.toUpperCase() : "Customer"} · ${esc(c.partner ? c.partner.phone : c.customer ? c.customer.phone : "")}</span></td><td>${KIND_NAME[c.kind]}</td><td>${esc(c.description)}</td><td class="r num">${inr(c.amount)}<br><span class="muted">incl. GST ${inr(c.gst_amount)}</span></td><td>${chPill(c.status)}${c.paid_via ? `<br><span class="muted small">${esc(c.paid_via)}</span>` : ""}</td>
    <td>${["due", "failed"].includes(c.status) ? `<div class="row" style="flex-wrap:nowrap"><button class="btn btn-soft btn-sm" data-act="charge-action" data-id="${c.id}" data-a="paid_offline" type="button">Mark paid</button>${c.status === "due" ? `<button class="btn btn-ghost btn-sm" data-act="charge-action" data-id="${c.id}" data-a="waived" type="button">Waive</button>` : ""}</div>` : ""}</td></tr>`).join("")}</tbody></table></div>`
  })}`;
}
const WA_NAME = {
  cb_request_received: "Request received", cb_new_lead: "New lead (DSA / TIP)", cb_install_scheduled: "Installation scheduled", cb_installed: "Installed", cb_new_ticket: "New ticket (TIP)", cb_ticket_update: "Ticket update",
  cb_payment_due: "Payment due", cb_payment_received: "Payment receipt", cb_partner_approved: "DSA / TIP approved", cb_router_offline: "Router offline", cb_router_offline_tip: "Router offline (TIP)", cb_wifi_changed: "Wi-Fi changed", cb_modem_restarted: "Modem restarted", cb_new_message: "New chat message", cb_partner_registered: "Registration confirmed (DSA / TIP)", cb_partner_credentials: "Login details (DSA / TIP)", cb_login_created: "Login created (team)", cb_password_reset: "Password reset by admin", cb_password_changed: "Password changed", cb_waitlist_joined: "Joined city waiting list", cb_city_launched: "City launched (waiting list)"
};
async function adminMessages() {
  return `<p class="muted" style="margin-bottom:12px">Every WhatsApp message the system sends, using approved Meta templates.${LIVE ? "" : " In this prototype messages are simulated, not sent."}</p>
  ${serverTable("adm-msgs", {
    role: "admin", kind: "messages", label: "Search messages", empty: "No messages yet.", html: ns => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>To</th><th>Message</th><th>Details</th><th>Status</th></tr></thead><tbody>
  ${ns.map(n => `<tr><td>${fdt(n.created_at)}</td><td class="mono">${esc(n.to_phone)}</td><td><b>${esc(WA_NAME[n.template] || n.template)}</b><br><span class="muted mono small">${esc(n.template)}</span></td><td class="small">${esc((n.params || []).join(" · "))}</td><td>${pill(n.status, n.status === "sent" ? "p-ok" : n.status === "failed" ? "p-bad" : "p-warn")}${n.simulated ? ` <span class="badge sim">Simulated</span>` : ""}${n.error ? `<br><span class="small" style="color:var(--bad)">${esc(n.error.slice(0, 80))}</span>` : ""}</td></tr>`).join("")}</tbody></table></div>`
  })}`;
}
async function openNewCharge() {
  const pt = [...await allPages("partners", { type: "dsa" }), ...await allPages("partners", { type: "tip" })];
  openModal(`<h2>Create charge</h2><form class="stack" data-form="new-charge" novalidate style="margin-top:12px">
    ${field("nc-payer", "Who pays", `<select id="nc-payer" name="payer_type"><option value="partner">DSA / TIP</option><option value="customer">Customer</option></select>`)}
    ${field("nc-partner", "DSA / TIP", `<select id="nc-partner" name="partner_id"><option value="">Choose</option>${pt.map(p => `<option value="${p.id}">${esc(p.name)} (${p.type.toUpperCase()})</option>`).join("")}</select>`)}
    ${field("nc-customer", "Customer", `<input id="nc-find" type="search" placeholder="Type a name or mobile to search" autocomplete="off"><select id="nc-customer" name="customer_id" style="margin-top:6px"><option value="">Search above, then choose</option></select>`)}
    ${field("nc-kind", "Type", `<select id="nc-kind" name="kind"><option value="registration_fee">Registration fee</option><option value="platform_fee">Platform fee</option><option value="customer_payment">Customer payment</option><option value="other">Other</option></select>`)}
    ${field("nc-desc", "Description", `<input id="nc-desc" name="description" placeholder="e.g. Router purchase, renewal fee">`)}
    ${field("nc-amt", "Amount before GST (₹)", `<input id="nc-amt" name="base" type="number" min="1">`, "GST is added automatically.")}
    <button class="btn btn-primary" type="submit">Create and send on WhatsApp</button></form>`);
  document.querySelector('[data-f="nc-customer"]').hidden = true;
  /* customers are searched, 20 at a time, instead of listing every customer in a dropdown */
  const find = document.getElementById("nc-find"), pick = document.getElementById("nc-customer"); let t = 0;
  const run = async () => { const r = await fetchPage(API, "admin", "customers", { q: find.value.trim(), limit: 20 }); pick.innerHTML = `<option value="">Choose (${r.total} match${r.total === 1 ? "" : "es"}${r.total > 20 ? ", showing 20 — type more" : ""})</option>` + r.items.map(c => `<option value="${c.id}">${esc(c.full_name || "Customer")} · ${esc(c.phone || "")}</option>`).join(""); };
  find.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => run().catch(() => { }), 250); }); run().catch(() => { });
}
function openChargeAction(id, a) {
  if (a === "waived") { guard(null, () => API.adminSetCharge(id, "waived")).then(() => { toast("Charge waived."); render(); }).catch(() => { }); return; }
  openModal(`<h2>Mark as paid (offline)</h2><p class="muted" style="margin:4px 0 12px">Use this for cash, cheque or a bank transfer received outside Razorpay.</p>
    <form class="stack" data-form="charge-offline" data-id="${id}" novalidate>${field("co-ref", "Reference (receipt / UTR / cheque no.)", `<input id="co-ref" name="reference">`)}<button class="btn btn-primary" type="submit">Mark paid</button></form>`);
}
function getCoords() {
  return new Promise((res, rej) => {
    const sim = () => LIVE ? rej(new AppError("Allow location access in your browser, or type your PIN code.")) : res({ lat: 22.7533 + Math.random() * 0.004, lng: 75.8937 + Math.random() * 0.004, simulated: true });
    if (!navigator.geolocation) return sim();
    let done = false; const t = setTimeout(() => { if (!done) { done = true; sim(); } }, 6000);
    navigator.geolocation.getCurrentPosition(p => { if (done) return; done = true; clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude }); }, () => { if (done) return; done = true; clearTimeout(t); sim(); }, { enableHighAccuracy: true, timeout: 5500, maximumAge: 60000 });
  });
}
function mapLink(l, btn) {
  if (!l) return "";
  const q = l.lat && l.lng ? `${Number(l.lat).toFixed(6)},${Number(l.lng).toFixed(6)}` : [l.address, l.area, l.pincode, "Indore"].filter(Boolean).join(", ");
  return `<a class="${btn ? "btn btn-ghost btn-sm" : "small"}" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}" target="_blank" rel="noopener">${l.lat ? "Open pinned location in Maps" : "Find address in Maps"}</a>`;
}

/* =====================================================================
   MADHYA PRADESH CITIES · launching soon + waiting list
   ===================================================================== */
const CITY_KEY = "cb-city";
const cityList = () => S.cities || [];
const cityById = id => cityList().find(c => c.id === id);
const cityName = id => (cityById(id) || {}).name || "your city";
const cityLive = id => (cityById(id) || {}).status === "live";
const citySort = (a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || a.tier - b.tier || a.name.localeCompare(b.name);
async function loadCities() {
  if (!S.cities) { try { S.cities = await API.cities(); } catch (e) { S.cities = []; } }
  if (!S.city) { let c = null; try { c = localStorage.getItem(CITY_KEY); } catch (e) { } S.city = c && cityById(c) ? c : ((cityList().find(x => x.status === "live") || {}).id || "indore"); }
}
function setCity(id) {
  if (!cityById(id)) return; S.city = id; try { localStorage.setItem(CITY_KEY, id); } catch (e) { }
  S.wlDone = null; resetSearch();
  const sel = document.getElementById("city-pick"); if (sel) sel.value = id;
  const eb = document.getElementById("hero-city"); if (eb) eb.textContent = cityLive(id) ? cityName(id) : "Madhya Pradesh";
  document.querySelectorAll('[data-act="pick-city"]').forEach(b => b.setAttribute("aria-pressed", b.dataset.v === id));
  renderSearchCard(); updateCompareBar();
}
const cityOptions = (cur, all) => {
  const cs = cityList().slice().sort(citySort), live = cs.filter(c => c.status === "live"), soon = cs.filter(c => c.status !== "live");
  return `<optgroup label="Live now">${live.map(c => `<option value="${c.id}" ${cur === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</optgroup>
    <optgroup label="${all ? "Coming soon" : "Launching soon"}">${soon.map(c => `<option value="${c.id}" ${cur === c.id ? "selected" : ""}>${esc(c.name)}${all ? "" : " · soon"}</option>`).join("")}</optgroup>`;
};
function soonBody() {
  const name = cityName(S.city), u = me();
  if (S.wlDone && S.wlDone.city_id === S.city) {
    const share = encodeURIComponent(`Connect Bhai is coming to ${name}: compare broadband, SIM, TV and OTT plans and book online. Join the waiting list: https://www.connectbhai.com`);
    return `<div class="stack" style="gap:10px;text-align:center;justify-items:center;padding:6px 0"><span class="avatar" style="width:48px;height:48px;font-size:22px;background:var(--ok)">✓</span>
      <h2>You're on the list for ${esc(name)}</h2><p class="muted small">We'll WhatsApp <b>${esc(fmtPh(S.wlDone.phone))}</b> the day Connect Bhai starts in ${esc(name)}. ${S.wlDone.waiting > 1 ? `<b>${S.wlDone.waiting}</b> people in ${esc(name)} are waiting so far.` : ""} More people from one city means we launch there sooner.</p>
      <a class="btn btn-soft btn-sm" href="https://wa.me/?text=${share}" target="_blank" rel="noopener">Share with friends in ${esc(name)} on WhatsApp</a>
      <button class="linkbtn small" data-act="wl-again" type="button">Add another number</button></div>`;
  }
  return `<h2>Launching soon in ${esc(name)}</h2><p class="muted small" style="margin-top:2px">Connect Bhai is live in Indore today and is coming to ${esc(name)} next. Leave your number and we'll message you on WhatsApp the day we start here.</p>
    <div class="grid2" style="margin-top:12px">${field("wl-name", "Your name", `<input id="wl-name" name="wl_name" autocomplete="name" value="${esc(u && u.role === "customer" ? u.full_name || "" : "")}">`)}
    ${field("wl-phone", "WhatsApp number", `<input id="wl-phone" name="wl_phone" inputmode="numeric" maxlength="16" autocomplete="tel-national" value="${esc(u && u.role === "customer" ? u.phone || "" : "")}">`)}</div>
    ${field("wl-pin", "PIN code (optional)", `<input id="wl-pin" name="wl_pin" inputmode="numeric" maxlength="6">`, "Helps us plan which areas to start with.")}
    <div class="field" data-f="wl-consent" style="margin-top:4px"><label class="check"><input type="checkbox" name="wl_consent" id="wl-consent"> Message me on WhatsApp when Connect Bhai launches in ${esc(name)}.</label><span class="ferr" id="wl-consent-err"></span></div>
    <button class="btn btn-primary btn-block" type="submit" style="margin-top:10px">Notify me at launch</button>
    <p class="muted small" style="margin-top:8px">Interested in <b>${esc(PRODUCT_NAME[S.product] || "Fiber broadband")}</b>. Change it with the tabs above.</p>`;
}
function citiesSection() {
  const cs = cityList().slice().sort(citySort), shown = S.allCities ? cs : cs.filter(c => c.status === "live" || c.tier <= 2), live = cs.filter(c => c.status === "live");
  return `<section class="sec" id="cities" style="padding-top:0"><div class="wrap">
    <div class="sec-head"><span class="eyebrow">Madhya Pradesh</span><h2>Live in ${esc(live.map(c => c.name).join(", ") || "Indore")}. Coming to every district of MP.</h2>
      <p>Pick your city. Where we are live you can compare and book right away. Everywhere else, join the waiting list and we'll WhatsApp you the day we launch there.</p></div>
    <div class="citychips">${shown.map(c => `<button type="button" class="citychip ${c.status === "live" ? "live" : ""}" data-act="pick-city" data-v="${c.id}" aria-pressed="${S.city === c.id}"><i></i>${esc(c.name)}<small>${c.status === "live" ? "Live" : "Soon"}</small></button>`).join("")}</div>
    <div class="row" style="margin-top:14px">${S.allCities ? "" : `<button class="btn btn-ghost btn-sm" data-act="all-cities" type="button">Show all ${cs.length} districts</button>`}<span class="muted small">Run a broadband or mobile shop in your city? <button class="linkbtn" data-go="home" data-scroll="partners" type="button">Register as a DSA or TIP before launch</button></span></div>
  </div></section>`;
}
async function adminCitiesBody() {
  const [cs, wl] = await Promise.all([API.adminCities(), API.adminWaitlist()]);
  const live = cs.filter(c => c.status === "live"), soon = cs.filter(c => c.status === "soon"), wait = wl.filter(w => w.status === "waiting");
  const top = soon.filter(c => c.waiting).sort((a, b) => b.waiting - a.waiting).slice(0, 5);
  const f = S.wlCity || "all", rows = wl.filter(w => f === "all" || w.city_id === f), nm = id => (cs.find(c => c.id === id) || {}).name || id;
  const order = cs.slice().sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || b.waiting - a.waiting || a.tier - b.tier || a.name.localeCompare(b.name));
  return `<div class="kpis"><div class="kpi"><span>Live cities</span><b>${live.length}</b><small>${esc(live.map(c => c.name).join(", "))}</small></div><div class="kpi"><span>Launching soon</span><b>${soon.length}</b></div>
    <div class="kpi"><span>People waiting</span><b>${wait.length}</b><small>across ${new Set(wait.map(w => w.city_id)).size} cities</small></div><div class="kpi"><span>DSAs & TIPs outside live cities</span><b>${soon.reduce((a, c) => a + c.partners, 0)}</b><small>registered early</small></div></div>
  <div class="card row" style="margin-bottom:16px;padding:14px 16px"><div style="min-width:0;flex:1 1 280px"><b>Where to launch next</b><p class="muted small">${top.length ? "Most people waiting: " + top.map(c => `<b>${esc(c.name)}</b> (${c.waiting})`).join(", ") + "." : "No one on the waiting list yet."} Before launching a city, add its PIN codes and coverage in Locations and activate at least one DSA and TIP there.</p></div><button class="btn btn-ghost btn-sm" data-act="add-city" type="button">Add city / town</button></div>
  <div class="tbl-wrap" style="margin-bottom:22px"><table class="tbl"><thead><tr><th>City</th><th>Status</th><th class="r">Waiting</th><th class="r">DSAs & TIPs</th><th class="r">PIN codes added</th><th></th></tr></thead><tbody>
  ${order.map(c => `<tr><td><b>${esc(c.name)}</b>${c.district && c.district !== c.name ? `<br><span class="muted small">${esc(c.district)} district</span>` : ""}</td><td>${c.status === "live" ? pill("Live" + (c.launched_at ? " · " + fdate(c.launched_at) : ""), "p-ok") : c.status === "soon" ? pill("Launching soon", "p-blue") : pill("Hidden", "p-grey")}</td>
    <td class="r num">${c.waiting}${c.notified ? `<br><span class="muted small">${c.notified} notified</span>` : ""}</td><td class="r num">${c.partners}</td><td class="r num">${c.pins}</td>
    <td><div class="row" style="flex-wrap:nowrap">${c.status !== "live" ? `<button class="btn btn-primary btn-sm" data-act="launch-city" data-id="${c.id}" type="button">Launch</button>` : ""}${c.waiting || c.notified ? `<button class="btn btn-ghost btn-sm" data-act="wl-city" data-v="${c.id}" type="button">Waiting list</button>` : ""}${c.status === "soon" ? `<button class="btn btn-ghost btn-sm" data-act="city-status" data-id="${c.id}" data-s="hidden" type="button">Hide</button>` : c.status === "hidden" ? `<button class="btn btn-ghost btn-sm" data-act="city-status" data-id="${c.id}" data-s="soon" type="button">Show</button>` : `<button class="btn btn-ghost btn-sm" data-act="city-status" data-id="${c.id}" data-s="soon" type="button">Back to soon</button>`}</div></td></tr>`).join("")}</tbody></table></div>
  <div class="row" style="margin-bottom:10px" id="waitlist"><h3 style="font-size:18px">Waiting list</h3><span class="spacer"></span><select class="sel" id="wl-filter" aria-label="Filter waiting list by city"><option value="all">All cities (${wl.length})</option>${cs.filter(c => wl.some(w => w.city_id === c.id)).map(c => `<option value="${c.id}" ${f === c.id ? "selected" : ""}>${esc(c.name)} (${wl.filter(w => w.city_id === c.id).length})</option>`).join("")}</select></div>
  ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>City</th><th>PIN</th><th>Interested in</th><th>Joined</th><th>Status</th><th>Contact</th></tr></thead><tbody>
  ${rows.map(w => `<tr><td><b>${esc(w.name)}</b> ${demoBadge(w.is_demo)}<br><span class="muted">${esc(fmtPh(w.phone))}</span></td><td>${esc(nm(w.city_id))}</td><td class="mono">${esc(w.pincode || "—")}</td><td>${esc(PRODUCT_NAME[w.interest] || w.interest || "—")}</td><td>${fdate(w.created_at)}</td><td>${w.status === "notified" ? pill("Told at launch", "p-ok") : w.status === "converted" ? pill("Booked", "p-ok") : pill("Waiting", "p-blue")}</td><td>${contactBtns({ phone: w.phone }, { text: "Namaste " + w.name + ", Connect Bhai here about your city " + nm(w.city_id) + "." })}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty"><b>No one on the waiting list${f === "all" ? "" : " for " + esc(nm(f))} yet.</b><p class="muted">People join from the home page when they choose a city that is not live yet.</p></div>`}`;
}
async function openLaunchCity(id) {
  const c = (await API.adminCities()).find(x => x.id === id); if (!c) return;
  const ok = (v, t) => `<div><span>${t}</span><b>${v ? pill("Ready", "p-ok") : pill("Not yet", "p-warn")}</b></div>`;
  openModal(`<h2>Launch ${esc(c.name)}</h2><p class="muted" style="margin:4px 0 12px">${esc(c.name)} becomes a live city on the website. ${c.waiting ? `<b>${c.waiting}</b> ${c.waiting === 1 ? "person" : "people"} on the waiting list get a WhatsApp message right away.` : "No one is on the waiting list yet."}</p>
    <div class="facts" style="margin-bottom:14px">${ok(c.pins > 0, `PIN codes added in Locations (${c.pins})`)}${ok(c.partners > 0, `DSAs & TIPs registered in ${esc(c.name)} (${c.partners})`)}</div>
    ${c.pins ? "" : `<p class="notice" style="margin-bottom:12px">Without PIN codes and coverage, customers in ${esc(c.name)} will see "no plans at this PIN code" and can only request a callback. Add them in Locations first.</p>`}
    <div class="row"><button class="btn btn-primary" data-act="launch-confirm" data-id="${c.id}" type="button">Launch ${esc(c.name)}${c.waiting ? " and send WhatsApp" : ""}</button><button class="btn btn-ghost" data-act="close-modal" type="button">Not now</button></div>`);
}

/* =====================================================================
   PLAN MANAGEMENT · admin + TIP · update sheet import (xlsx / csv)
   ===================================================================== */
const CAT_TONE = { fiber: "p-blue", air_fiber: "p-blue", tv: "p-grey", ott: "p-grey", sim_prepaid: "p-warn", sim_postpaid: "p-warn" };
const keyBenefit = p => isSpeedCat(p.category) ? joinDot(speedTxt(p), dataTxt(p)) : planSummary(p);
const PLAN_ST = p => p.status === "pending_review" ? pill("Pending review", "p-warn") : p.status === "rejected" ? pill("Rejected", "p-bad") : p.is_active ? pill("Live", "p-ok") : pill("Hidden", "p-grey");
async function adminPlansBody() {
  const pl = await API.adminPlans();
  const pend = pl.filter(p => p.status === "pending_review"), live = pl.filter(p => p.status === "live");
  const c = S.planCat || "all", shown = live.filter(p => c === "all" || p.category === c);
  return `<div class="row" style="margin-bottom:12px"><span class="muted" style="flex:1 1 280px">Update plans one by one, or many at once with the plan update sheet. Only verified tariffs should go live.</span>
    <button class="btn btn-ghost btn-sm" data-act="plan-template" type="button">Download sheet</button><button class="btn btn-soft btn-sm" data-act="plan-import" data-mode="admin" type="button">Import sheet</button><button class="btn btn-primary btn-sm" data-act="edit-plan" data-id="" type="button">Add plan</button></div>
  ${pend.length ? `<div class="card" style="margin-bottom:16px;border-left:4px solid var(--warn)"><h3>Plan updates from TIPs <span class="cnt pill p-warn">${pend.length}</span></h3>
    <div class="list" style="margin-top:10px">${pend.map(p => `<div class="item"><div class="ih"><h3>${esc(p.provider.name)} · ${esc(p.name)}</h3>${pill(CATS[p.category], CAT_TONE[p.category])}${p.replaces_plan ? pill("Change to existing plan", "p-blue") : pill("New plan", "p-blue")}</div>
      <div class="meta"><span>From <b>${esc(p.submitter ? p.submitter.name : "TIP")}</b></span><span><b>${inr(p.price_monthly)}</b>${priceUnit(p)}</span><span>${esc(keyBenefit(p))}</span>${p.ott_apps.length ? `<span>OTT: ${esc(p.ott_apps.join(", "))}</span>` : ""}${p.source_url ? `<span><a href="${esc(p.source_url)}" target="_blank" rel="noopener">Source</a></span>` : `<span style="color:var(--bad)">No source link</span>`}</div>
      <div class="row"><button class="btn btn-primary btn-sm" data-act="review-plan" data-id="${p.id}" data-v="1" type="button">Approve & publish</button><button class="btn btn-danger btn-sm" data-act="review-plan" data-id="${p.id}" data-v="0" type="button">Reject</button></div></div>`).join("")}</div></div>` : ""}
  <div class="chips" style="margin-bottom:12px">${[["all", "All"], ...Object.entries(CATS)].map(([k, l]) => `<button type="button" class="chip" data-act="plan-cat" data-v="${k}" aria-pressed="${c === k}">${l} (${k === "all" ? live.length : live.filter(p => p.category === k).length})</button>`).join("")}</div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Plan</th><th>Type</th><th>Benefit</th><th class="r">Price</th><th>Verified</th><th>Status</th><th></th></tr></thead><tbody>
  ${shown.map(p => `<tr><td class="mono small" style="white-space:nowrap">${esc(p.plan_code || "—")}</td><td><b>${esc(p.name)}</b> ${demoBadge(p.is_demo)}<br><span class="muted">${esc(p.provider.name)}</span></td><td>${pill(CATS[p.category], CAT_TONE[p.category])}</td><td class="small">${esc(keyBenefit(p))}${p.ott_apps.length && p.category !== "ott" ? "<br>" + p.ott_apps.length + " OTT apps" : ""}</td><td class="r num">${inr(p.price_monthly)}<br><span class="muted small">${priceUnit(p)}</span></td>
    <td>${p.verified_at ? (p.is_demo ? pill("Demo", "p-warn") : pill(fdate(p.verified_at), "p-ok")) : pill("Not verified", "p-bad")}</td><td>${PLAN_ST(p)}</td>
    <td><div class="row" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-act="edit-plan" data-id="${p.id}" type="button">Edit</button><button class="btn btn-ghost btn-sm" data-act="toggle-plan" data-id="${p.id}" type="button">${p.is_active ? "Hide" : "Publish"}</button></div></td></tr>`).join("") || `<tr><td colspan="8" class="muted">No plans in this category.</td></tr>`}</tbody></table></div>`;
}
function planFormFields(p, providers, mode) {
  return `<div class="grid2">${field("pl-cat", "Category", `<select id="pl-cat" name="category">${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${p.category === k ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
    ${field("pl-prov", "Provider", `<select id="pl-prov" name="provider_id"><option value="">Choose</option>${providers.map(x => `<option value="${x.id}" ${p.provider_id === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`)}
    ${field("pl-code", "Plan code", `<input id="pl-code" name="plan_code" value="${esc(p.plan_code || "")}" placeholder="e.g. BSNL-FIB-100" ${mode === "tip" && p.plan_code ? "readonly" : ""}>`, mode === "tip" ? "Same code as an existing plan = price/benefit change" : "Permanent ID used by the update sheet")}
    ${field("pl-name", "Plan name", `<input id="pl-name" name="name" value="${esc(p.name || "")}">`)}
    ${field("pl-price", "Price (₹)", `<input id="pl-price" name="price_monthly" type="number" min="0" value="${esc(p.price_monthly ?? "")}">`, "Monthly; prepaid SIM = recharge amount")}
    ${field("pl-val", "Validity (days)", `<input id="pl-val" name="validity_days" type="number" min="1" value="${esc(p.validity_days || 30)}">`)}
    <div data-for="speed">${field("pl-speed", "Speed (Mbps)", `<input id="pl-speed" name="speed_mbps" type="number" min="1" value="${esc(p.speed_mbps || "")}">`, "Required for Fiber and Air Fiber")}</div>
    ${field("pl-data", "Data limit (GB per month)", `<input id="pl-data" name="data_limit_gb" type="number" min="1" value="${esc(p.data_limit_gb || "")}">`, "Empty = unlimited")}
    <div data-for="sim">${field("pl-dpd", "Data per day (GB)", `<input id="pl-dpd" name="data_per_day_gb" type="number" min="0" step="0.5" value="${esc(p.data_per_day_gb || "")}">`, "SIM plans")}</div>
    <div data-for="sim">${field("pl-voice", "Calls", `<input id="pl-voice" name="voice" value="${esc(p.voice || "")}" placeholder="Unlimited">`)}</div>
    <div data-for="sim">${field("pl-sms", "SMS per day", `<input id="pl-sms" name="sms_per_day" type="number" min="0" value="${esc(p.sms_per_day || "")}">`)}</div>
    ${field("pl-tv", "TV channels", `<input id="pl-tv" name="tv_channels" type="number" min="0" value="${esc(p.tv_channels || 0)}">`)}
    ${field("pl-inst", "Installation charge (₹)", `<input id="pl-inst" name="install_charge" type="number" min="0" value="${esc(p.install_charge || 0)}">`)}</div>
    ${field("pl-ott", "OTT apps", `<input id="pl-ott" name="ott" value="${esc((p.ott_apps || []).join(", "))}">`, "Separate with commas")}
    ${field("pl-src", "Source link (tariff page or circular)", `<input id="pl-src" name="source_url" value="${esc(p.source_url || "")}">`)}`;
}
function syncPlanForm(form) {
  const c = (form.querySelector("[name=category]") || {}).value || "fiber";
  form.querySelectorAll('[data-for="speed"]').forEach(x => (x.hidden = !isSpeedCat(c)));
  form.querySelectorAll('[data-for="sim"]').forEach(x => (x.hidden = !c.startsWith("sim")));
}
async function openPlan(id) {
  const [pv, pl] = await Promise.all([API.adminProviders(), id ? API.adminPlans() : []]);
  const p = id ? pl.find(x => x.id === id) : { category: S.planCat && S.planCat !== "all" ? S.planCat : "fiber", ott_apps: [], validity_days: 30, tv_channels: 0, install_charge: 0 };
  openModal(`<h2>${id ? "Edit plan" : "Add plan"}</h2><form class="stack" data-form="plan" data-id="${id || ""}" novalidate style="margin-top:12px">
    ${planFormFields(p, pv, "admin")}
    <label class="check"><input type="checkbox" name="verified" ${p.verified_at && !p.is_demo ? "checked" : ""}> I verified this tariff from the source above</label>
    <button class="btn btn-primary" type="submit">Save plan</button></form>`, true);
  syncPlanForm(document.querySelector('[data-form="plan"]'));
}
function planFormData(f) {
  const g = n => val(f, n);
  return {
    id: f.dataset.id, category: g("category"), provider_id: g("provider_id"), plan_code: g("plan_code"), name: g("name"), speed_mbps: g("speed_mbps"), price_monthly: g("price_monthly"), data_limit_gb: g("data_limit_gb"),
    data_per_day_gb: g("data_per_day_gb"), voice: g("voice"), sms_per_day: g("sms_per_day"), validity_days: g("validity_days"), tv_channels: g("tv_channels"), install_charge: g("install_charge"), ott: g("ott"), source_url: g("source_url"), verified: g("verified")
  };
}
function planFormErrors(d) {
  const e = {};
  if (!d.provider_id) e["pl-prov"] = "Choose a provider."; if (d.name.length < 2) e["pl-name"] = "Enter the plan name.";
  if (isSpeedCat(d.category) && !(Number(d.speed_mbps) > 0)) e["pl-speed"] = "Enter speed in Mbps.";
  if (d.price_monthly === "" || !(Number(d.price_monthly) >= 0)) e["pl-price"] = "Enter the price."; if (d.verified && !d.source_url) e["pl-src"] = "Add the link you verified from.";
  if (d.plan_code && !/^[A-Za-z0-9-]{3,30}$/.test(d.plan_code)) e["pl-code"] = "Use 3–30 letters, digits or dashes.";
  return e;
}
/* --- TIP: Plans & offers --- */
async function tipPlansBody() {
  const [{ live, mine }, provs] = await Promise.all([API.tipPlans(), API.tipProviders()]);
  return `<p class="muted" style="margin-bottom:12px">You install for: <b>${provs.map(p => esc(p.name)).join(", ") || "no providers yet (ask admin to add coverage)"}</b>. Send new plans, offers or price changes here. Admin reviews them before customers see them.</p>
  <div class="row" style="margin-bottom:16px"><button class="btn btn-primary btn-sm" data-act="tip-plan" data-id="" type="button">Submit plan / price change</button><button class="btn btn-soft btn-sm" data-act="plan-import" data-mode="tip" type="button">Upload sheet</button><button class="btn btn-ghost btn-sm" data-act="plan-template" type="button">Download sheet</button></div>
  <h3 style="font-size:17px;margin-bottom:10px">My submissions</h3>
  ${mine.length ? `<div class="list" style="margin-bottom:22px">${mine.map(p => `<div class="item"><div class="ih"><h3>${esc(p.provider.name)} · ${esc(p.name)}</h3>${p.status === "rejected" && p.review_note === "Applied to existing plan" ? pill("Approved · applied", "p-ok") : PLAN_ST(p)}${pill(CATS[p.category], CAT_TONE[p.category])}</div>
    <div class="meta"><span><b>${inr(p.price_monthly)}</b>${priceUnit(p)}</span><span>${esc(keyBenefit(p))}</span>${p.review_note && p.review_note !== "Applied to existing plan" ? `<span>Admin note: <b>${esc(p.review_note)}</b></span>` : ""}</div></div>`).join("")}</div>` : `<div class="empty" style="margin-bottom:22px"><b>No submissions yet.</b></div>`}
  <h3 style="font-size:17px;margin-bottom:10px">Live plans for my providers</h3>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Plan</th><th>Type</th><th>Benefit</th><th class="r">Price</th><th></th></tr></thead><tbody>
  ${live.map(p => `<tr><td class="mono small" style="white-space:nowrap">${esc(p.plan_code || "")}</td><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.provider.name)}</span></td><td>${pill(CATS[p.category], CAT_TONE[p.category])}</td><td class="small">${esc(keyBenefit(p))}</td><td class="r num">${inr(p.price_monthly)}</td><td><button class="btn btn-ghost btn-sm" data-act="tip-plan" data-id="${p.id}" type="button">Request change</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">No live plans yet.</td></tr>`}</tbody></table></div>`;
}
async function openTipPlan(id) {
  const [{ live }, provs] = await Promise.all([API.tipPlans(), API.tipProviders()]);
  const p = id ? live.find(x => x.id === id) : { category: "fiber", ott_apps: [], validity_days: 30, tv_channels: 0, install_charge: 0 };
  openModal(`<h2>${id ? "Request a change" : "Submit a new plan"}</h2><p class="muted" style="margin:4px 0 12px">Admin checks the source link and publishes it. Customers see the change only after approval.</p>
    <form class="stack" data-form="tip-plan" novalidate>${planFormFields(p, provs, "tip")}<button class="btn btn-primary" type="submit">Send for review</button></form>`, true);
  syncPlanForm(document.querySelector('[data-form="tip-plan"]'));
}
const planToRow = (d, providers) => ({
  plan_code: d.plan_code, category: d.category, provider: (providers.find(p => p.id === d.provider_id) || {}).name, plan_name: d.name, speed_mbps: d.speed_mbps, price: d.price_monthly,
  validity_days: d.validity_days, data_limit_gb: d.data_limit_gb, data_per_day_gb: d.data_per_day_gb, voice: d.voice, sms_per_day: d.sms_per_day, ott_apps: d.ott, tv_channels: d.tv_channels, install_charge: d.install_charge, source_url: d.source_url
});
/* --- sheet reading: .xlsx (no library) and .csv --- */
const colIdx = letters => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
async function readXlsx(buf) {
  const dv = new DataView(buf); let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new AppError("This is not a valid .xlsx file.");
  const n = dv.getUint16(eocd + 10, true); let off = dv.getUint32(eocd + 16, true); const files = {}, td = new TextDecoder();
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), local = dv.getUint32(off + 42, true);
    files[td.decode(new Uint8Array(buf, off + 46, nl))] = { method, csize, local }; off += 46 + nl + el + cl;
  }
  const get = async name => {
    const f = files[name]; if (!f) return null; const lnl = dv.getUint16(f.local + 26, true), lel = dv.getUint16(f.local + 28, true), data = new Uint8Array(buf, f.local + 30 + lnl + lel, f.csize);
    if (f.method === 0) return td.decode(data);
    return td.decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  };
  const X = t => new DOMParser().parseFromString(t, "application/xml");
  const wbx = X(await get("xl/workbook.xml")), rels = X(await get("xl/_rels/workbook.xml.rels"));
  const sheets = [...wbx.getElementsByTagName("sheet")], sh = sheets.find(x => (x.getAttribute("name") || "").toLowerCase() === "plans") || sheets[0];
  const rid = sh.getAttribute("r:id"), rel = [...rels.getElementsByTagName("Relationship")].find(r => r.getAttribute("Id") === rid);
  let target = rel.getAttribute("Target"); target = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
  const ssx = await get("xl/sharedStrings.xml"), ss = ssx ? [...X(ssx).getElementsByTagName("si")].map(si => [...si.getElementsByTagName("t")].map(t => t.textContent).join("")) : [];
  const rows = [];
  for (const r of X(await get(target)).getElementsByTagName("row")) {
    const row = [];
    for (const c of r.getElementsByTagName("c")) {
      const t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0]; let val = v ? v.textContent : "";
      if (t === "s") val = ss[+val] ?? ""; else if (t === "inlineStr") { const it = c.getElementsByTagName("t")[0]; val = it ? it.textContent : ""; }
      row[colIdx((c.getAttribute("r") || "").replace(/\d+/g, ""))] = val;
    }
    rows.push(row);
  }
  return rows;
}
function readCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cur); cur = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function rowsToObjects(rows) {
  const head = (rows[0] || []).map(h => String(h || "").trim().toLowerCase());
  if (!head.includes("plan_name") || !head.includes("category")) throw new AppError("The first row must have the sheet's column names (plan_code, category, provider, plan_name, ...).");
  return rows.slice(1).map((r, i) => { const o = { _row: i + 2 }; head.forEach((h, j) => { if (SHEET_COLS.includes(h)) o[h] = r[j] === undefined ? "" : String(r[j]).trim(); }); return o; })
    .filter(o => (o.plan_code || o.plan_name || o.category) && !/this is sample data/i.test(o.notes || ""));   // the template's sample row is never imported
}
async function openImport(mode) {
  openModal(`<h2>${mode === "tip" ? "Upload plan sheet for review" : "Import plan update sheet"}</h2>
    <p class="muted" style="margin:4px 0 12px">Use the Connect Bhai plan update sheet (.xlsx) or a .csv with the same columns. ${mode === "tip" ? "Rows go to admin for approval." : "Same plan_code updates a plan; a new code adds one."}</p>
    <div class="field"><label for="imp-file">Choose file</label><input id="imp-file" type="file" accept=".xlsx,.csv" data-mode="${mode}"></div>
    <div id="imp-out" style="margin-top:12px"></div>`, true);
}
async function previewImport(input) {
  const out = document.getElementById("imp-out"), file = input.files[0], mode = input.dataset.mode; if (!file) return;
  out.innerHTML = `<p class="muted">Reading ${esc(file.name)}…</p>`;
  try {
    const buf = await file.arrayBuffer();
    const rows = rowsToObjects(/\.csv$/i.test(file.name) ? readCsv(new TextDecoder().decode(buf)) : await readXlsx(buf));
    const provs = mode === "tip" ? await API.tipProviders() : await API.adminProviders();
    const checked = rows.map(r => {
      let err = "";
      try {
        const pv = provs.find(p => p.name.toLowerCase() === String(r.provider || "").toLowerCase()); if (!pv) throw new AppError(mode === "tip" ? `You don't install for "${r.provider}"` : `Unknown provider "${r.provider}"`);
        planFromRow(r, pv.id); if (mode === "admin" && !r.plan_code) throw new AppError("plan_code missing");
        if (["Y", "YES"].includes(String(r.verified || "").toUpperCase()) && !r.source_url) throw new AppError("Verified needs a source link");
      }
      catch (e) { err = errMsg(e); } return Object.assign(r, { _err: err });
    });
    const ok = checked.filter(r => !r._err); S.importRows = ok; S.importMode = mode;
    out.innerHTML = `<div class="row" style="margin-bottom:10px"><b>${rows.length} rows</b>${pill(ok.length + " ready", "p-ok")}${checked.length - ok.length ? pill((checked.length - ok.length) + " with errors (skipped)", "p-bad") : ""}</div>
      <div class="tbl-wrap" style="max-height:340px;overflow:auto;max-width:100%"><table class="tbl" style="min-width:640px"><thead><tr><th>Row</th><th>Code</th><th>Type</th><th>Provider</th><th>Plan</th><th class="r">Price</th><th>Check</th></tr></thead><tbody>
      ${checked.map(r => `<tr><td>${r._row}</td><td class="mono small">${esc(r.plan_code || "")}</td><td>${esc(CATS[r.category] || r.category || "")}</td><td>${esc(r.provider || "")}</td><td>${esc(r.plan_name || "")}</td><td class="r">${esc(r.price || "")}</td><td>${r._err ? `<span style="color:var(--bad);font-weight:700">${esc(r._err)}</span>` : pill("OK", "p-ok")}</td></tr>`).join("")}</tbody></table></div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="import-confirm" type="button" ${ok.length ? "" : "disabled"}>${mode === "tip" ? `Send ${ok.length} plan${ok.length === 1 ? "" : "s"} for review` : `Import ${ok.length} plan${ok.length === 1 ? "" : "s"}`}</button>`;
  } catch (e) { out.innerHTML = `<p class="formerr">${esc(errMsg(e))}</p>`; }
}
/* Generic empty template: headings + sample row(s) that are marked "This is sample data" and skipped on import. */
function downloadSheet(name, head, sampleRows) {
  if (ST_PREVIEW) { toast("Downloads are blocked in this preview. Download from your live site."); return; }
  const q = v => /[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? "");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + [head, ...sampleRows].map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
/* Admin > Locations > Add PIN / area: read a sheet with a "pincode" and an "area" column. Nothing is looked up anywhere: the sheet
   holds the area names. Rows with a bad PIN or no area are listed with the reason and skipped; the rest are added in one go. */
async function readAreaFile(input) {
  const out = document.getElementById("ap-out"), file = input.files[0]; S.areaRows = [];
  if (!file) { if (out) out.innerHTML = ""; return; }
  out.innerHTML = `<p class="muted">Reading ${esc(file.name)}…</p>`;
  try {
    const buf = await file.arrayBuffer();
    const grid = /\.csv$/i.test(file.name) ? readCsv(new TextDecoder().decode(buf)) : await readXlsx(buf);
    const head = (grid[0] || []).map(c => String(c == null ? "" : c).trim().toLowerCase());
    let ci = head.findIndex(h => h === "pincode" || h === "pin code" || h === "pin"), ai = head.findIndex(h => h === "area" || h === "area name");
    if (ci < 0 || ai < 0) { ci = 0; ai = 1; }   // no recognisable heading: first column = PIN code, second = area
    const seen = new Set(), rows = [];
    grid.slice(1).forEach((r, i) => {
      const pin = String(r[ci] == null ? "" : r[ci]).trim(), area = String(r[ai] == null ? "" : r[ai]).trim().replace(/\s+/g, " ");
      if (!pin && !area) return;   // blank row
      if (/this is sample data/i.test(r.map(c => String(c == null ? "" : c)).join(" "))) return;   // the sample row of the template
      const key = pin + "|" + area.toLowerCase();
      const err = !isPin(pin) ? "PIN code must be 6 digits" : area.length < 2 ? "Area name is missing" : area.length > 120 ? "Area name is too long" : seen.has(key) ? "Repeated in this sheet" : "";
      if (!err) seen.add(key);
      rows.push({ row: i + 2, pin, area, err });
    });
    S.areaRows = rows.filter(r => !r.err);
    const bad = rows.length - S.areaRows.length;
    if (!rows.length) { out.innerHTML = `<p class="formerr">No rows found. Use the columns pincode and area, one area per row.</p>`; return; }
    if (S.areaRows.length > 500) { out.innerHTML = `<p class="formerr">At most 500 rows can be added at once. This sheet has ${S.areaRows.length}.</p>`; S.areaRows = []; return; }
    out.innerHTML = `<div class="row" style="margin:8px 0">${pill(S.areaRows.length + " ready", "p-ok")}${bad ? pill(bad + " with errors (skipped)", "p-bad") : ""}</div>
      <div class="tbl-wrap" style="max-height:240px;overflow:auto"><table class="tbl"><thead><tr><th>Row</th><th>PIN</th><th>Area</th><th>Check</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.row}</td><td class="mono">${esc(r.pin)}</td><td>${esc(r.area)}</td><td>${r.err ? `<span style="color:var(--bad)">${esc(r.err)}</span>` : `<span style="color:var(--ok)">OK</span>`}</td></tr>`).join("")}</tbody></table></div>
      <button class="btn btn-primary btn-block" style="margin-top:10px" data-act="areas-bulk" type="button" ${S.areaRows.length ? "" : "disabled"}>Add ${S.areaRows.length} area${S.areaRows.length === 1 ? "" : "s"}</button>`;
  } catch (err) { out.innerHTML = `<p class="formerr">${esc(errMsg(err))}</p>`; }
}
const SAMPLE_NOTE = "This is sample data - delete this row and add your own plans";
async function downloadTemplate() {
  if (ST_PREVIEW) { toast("Downloads are blocked in this preview. Download from your live site."); return; }
  // Empty template: the column names plus ONE clearly-marked sample row (skipped on import) showing the format.
  const csvq = v => /[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? "");
  const sample = ["SAMPLE-001", "fiber", "BSNL", "Sample Fibre 100", 100, 799, 30, 1000, "", "Unlimited", "", "Hotstar, Prime", 0, 0, "https://example.com/plan", "N", "Y", SAMPLE_NOTE];
  const lines = [SHEET_COLS.join(","), sample.map(csvq).join(",")];
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" })); a.download = "connectbhai-plan-template.csv"; document.body.appendChild(a); a.click(); a.remove();
}

/* =====================================================================
   CARE PLAN · through Gene, your personal assistant
   ===================================================================== */
const CARE_NOTE = `<div class="notice info" style="margin-bottom:14px">Status marked <b>Live · Gene</b> comes from the modem through Gene, your personal assistant, the Care plan system: the installer's own Gene or Connect Bhai's. Restart and Wi-Fi change are sent as Gene tasks. Modems not linked yet, and everything in this demo, are marked <b>Simulated</b>.</div>`;
const OUTAGE_MIN = 3;   // offline modems in one area that suggest a line / OLT fault (demo: 3; live site: 10)
function routerCard(b, withCustomer) {
  const d = b.device || {}, u = me(), linked = !!d.acs, active = d.active !== false, on = d.state === "online", off = d.state === "offline";
  const canAct = linked && u && u.role !== "dsa", canTest = linked && active && on, r = linked ? RX(d.rx_dbm) : null, weak = !!(r && r[0] !== "Good"), manyRb = linked && (d.reboots_7d || 0) >= 3;
  return `<div class="item"><div class="ih"><h3>${withCustomer && b.lead ? esc(b.lead.name) + " · " : ""}${planLine(b.plan)}</h3><span class="spacer"></span><span class="mono muted">${esc(b.connection_ref || b.ref_code)}</span></div>
    <div class="row">${deviceView(b.device)}${rxPill(d)}<span class="spacer"></span><button class="btn btn-ghost btn-sm" data-act="refresh-device" data-id="${b.id}" type="button" ${linked ? "" : "disabled"}>Refresh status</button></div>
    <div class="meta">${withCustomer && b.lead ? `<span><b>${esc(b.lead.phone)}</b> · ${esc(b.lead.area || "")} ${esc(b.lead.pincode || "")}</span>` : ""}<span>ONT serial <b class="mono">${esc(b.ont_serial || "not linked")}</b></span>${linked ? `<span>Gene <b>${esc(acsName(b))}</b></span>` : b.ont_serial ? `<span>ACS <b style="color:var(--warn)">not set for this TIP</b></span>` : ""}${d.model ? `<span>Modem <b>${esc(d.make + " " + d.model)}</b></span>` : ""}${d.firmware ? `<span>Firmware <b class="mono">${esc(d.firmware)}</b></span>` : ""}<span>Installed <b>${fdate(b.installed_at)}</b></span>${b.tip ? `<span>Installer <b>${esc(b.tip.name)}</b></span>` : ""}</div>
    ${linked ? `<div class="mstats"><div><span>Wi-Fi name</span><b>${esc(d.ssid || "—")}</b></div><div><span>Devices on Wi-Fi</span><b>${on ? (d.clients ?? "—") : 0}</b></div><div><span>Running for</span><b>${on ? upTxt(d.uptime_h) : "Offline"}</b></div><div><span>Restarts 7 / 30 days</span><b style="${manyRb ? "color:var(--bad)" : ""}">${d.reboots_7d || 0} / ${d.reboots_30d || 0}</b></div></div>` : ""}
    ${weak ? `<p class="notice">Fiber signal is ${r[0].toLowerCase()} (${Number(d.rx_dbm).toFixed(1)} dBm; good is −25 dBm or better). ${u && u.role === "customer" ? "Your installer can see this and will check the fiber." : "Check the fiber connector, patch cord and splitter before the customer complains."}</p>` : ""}
    ${manyRb && u && u.role !== "customer" ? `<p class="notice">Restarted ${d.reboots_7d} times in 7 days. Check the power adapter or the modem.</p>` : ""}
    <div class="row">${canAct ? `<button class="btn btn-primary btn-sm" data-act="modem-reboot" data-id="${b.id}" type="button" ${on ? "" : "disabled"}>Restart modem</button><button class="btn btn-soft btn-sm" data-act="modem-wifi" data-id="${b.id}" data-ssid="${esc(d.ssid || "")}" type="button" ${on ? "" : "disabled"}>Change Wi-Fi name / password</button>` : ""}<button class="btn btn-ghost btn-sm" data-act="router-test" data-id="${b.id}" type="button" ${canTest ? "" : "disabled"}>Line speed test</button>${withCustomer ? "" : `<button class="btn btn-ghost btn-sm" data-go="speed" type="button">Wi-Fi speed test</button>`}${u && u.role === "customer" && off ? `<button class="btn btn-danger btn-sm" data-act="offline-complaint" data-id="${b.id}" type="button">Raise complaint</button>` : ""}</div>
    ${!linked ? `<p class="muted small">${b.ont_serial ? "Gene is not set up for this TIP yet. Admin sets it under Care plan → Gene setup." : "Not linked yet: the installer adds the ONT serial when marking the installation complete."}</p>` : !active ? `<p class="muted small">Care plan is not active for this modem, so restart, Wi-Fi change and the line test are off.</p>` : !on ? `<p class="muted small">${off ? "The modem is offline." : "The modem has not reported yet."} Restart, Wi-Fi change and the line test need it online. Refresh status to check again.</p>` : ""}
    <p class="small" id="rt-${b.id}"></p>
    <div class="split" style="gap:12px;border-top:1px dashed var(--line);padding-top:8px"><div class="stack" style="gap:4px;min-width:0"><span class="muted small" style="font-weight:800">Recent speed tests</span><div class="stack" style="gap:4px" data-hist="${b.id}"><span class="muted small">Loading…</span></div></div>
      <div class="stack" style="gap:4px;min-width:0"><span class="muted small" style="font-weight:800">Recent modem actions</span><div class="stack" style="gap:4px" data-acts="${b.id}"><span class="muted small">Loading…</span></div></div></div></div>`;
}
function routerZones(zones, idx) {   // modems grouped by AREA (PIN code); zones come from the server summary
  const rows = zones.map(z => ({ pin: z.pincode, name: (idx && idx.get(z.pincode)) || "", n: z.n, on: z.on, off: z.off, weak: z.weak })).sort((a, b) => b.off - a.off || b.n - a.n);
  if (!rows.length) return "";
  const alerts = rows.filter(r => r.off >= OUTAGE_MIN);
  return `<div class="card stack" style="margin-bottom:16px"><h3>Modems by area</h3>
    ${alerts.length ? `<p class="notice" style="background:var(--bad-soft);color:var(--bad)"><b>${alerts.map(r => esc(r.pin + (r.name ? " · " + r.name : ""))).join(", ")}</b>: ${OUTAGE_MIN} or more modems offline together. This usually means a line or OLT fault, not a problem in one home.</p>` : ""}
    <div class="zgrid">${rows.slice(0, 4).map(r => `<div class="zcard ${r.off >= OUTAGE_MIN ? "none" : r.off || r.weak ? "low" : "good"}"><b>${esc(r.pin)}</b><span class="muted small">${esc(r.name)} · ${r.n} modem${r.n === 1 ? "" : "s"}</span><div class="row" style="gap:6px">${pill(r.on + " online", "p-ok")}${r.off ? pill(r.off + " offline", "p-bad") : ""}${r.weak ? pill(r.weak + " weak signal", "p-warn") : ""}</div></div>`).join("")}</div>${rows.length > 4 ? `<p class="muted small">Top 4 areas shown, +${rows.length - 4} more. All modems are listed below with search.</p>` : ""}</div>`;
}
function acsCard(tips) {
  const mode = p => p.acs_mode === "partner" ? pill("TIP's own Gene", "p-blue") : p.acs_mode === "connectbhai" ? pill("Connect Bhai Gene", "p-ok") : pill("Not set", "p-grey");
  return `<div class="card stack" style="margin-bottom:16px"><div><h3>Gene setup</h3><p class="muted small">Each TIP's modems report to one Gene. Use the TIP's own Gene through its API (nothing changes on the modem), or Connect Bhai's Gene. The app never talks to a modem directly: app → Connect Bhai backend → Gene → modem. It does not touch BSNL's systems.</p></div>
    <div class="list">${tips.map(p => `<div class="item"><div class="ih"><h3>${esc(p.name)}</h3>${mode(p)}${p.acs_mode ? (p.acs_agreement ? pill("Written OK on file", "p-ok") : pill("Written OK missing", "p-warn")) : ""}<span class="spacer"></span><button class="btn btn-soft btn-sm" data-act="edit-acs" data-id="${p.id}" type="button">Set ACS</button></div>
      <div class="meta"><span>API address <b class="mono">${esc(p.acs_url || "—")}</b></span>${p.acs_mode === "partner" ? `<span>API key <b>${p.acs_key_set ? "added" : "not added"}</b></span>` : ""}${p.linked != null ? `<span>Linked modems <b>${p.linked}</b></span>` : ""}${p.acs_updated_at ? `<span>Updated <b>${fdate(p.acs_updated_at)}</b></span>` : ""}</div></div>`).join("") || `<p class="muted">No TIPs yet.</p>`}</div>
    <details><summary class="linkbtn small" style="display:inline">For the developer: Gene calls the backend makes</summary>
      <div class="dev-dev stack" style="gap:6px;margin-top:8px">
        <span>Find the modem: <code>GET {API}/devices/?query={"_deviceId._SerialNumber":"&lt;ONT serial&gt;"}</code></span>
        <span>Restart: <code>POST {API}/devices/&lt;id&gt;/tasks?connection_request</code> with <code>{"name":"reboot"}</code></span>
        <span>Wi-Fi name / password: same URL with <code>{"name":"setParameterValues","parameterValues":[["…WLANConfiguration.1.SSID","NewName","xsd:string"]]}</code>. The path differs by make (TR-098 InternetGatewayDevice… or TR-181 Device.WiFi…), so keep one map per make.</span>
        <span>Status and fiber signal: read on each inform (every 5 minutes); RX power is a vendor-specific parameter.</span>
        <span>The API address and key stay in the "genieacs" edge function. Only Connect Bhai's server IP may reach a TIP's API. The Wi-Fi password is never logged.</span></div></details></div>`;
}
async function openAcs(id) {
  const p = (await API.adminAcs()).find(x => x.id === id); if (!p) { toast("TIP not found.", true); return; }
  openModal(`<h2>Gene setup for ${esc(p.name)}</h2><p class="muted" style="margin:4px 0 12px">Where this TIP's modems report. Saving here does not change the modems; the installer sets the same Gene address on each modem.</p>
    <form class="stack" data-form="acs" data-id="${p.id}" novalidate>
      ${field("ac-mode", "Gene setup", `<select id="ac-mode" name="mode"><option value="partner" ${p.acs_mode === "partner" ? "selected" : ""}>TIP's own Gene (connect through its API)</option><option value="connectbhai" ${p.acs_mode === "connectbhai" ? "selected" : ""}>Connect Bhai Gene (acs.connectbhai.in)</option><option value="" ${!p.acs_mode ? "selected" : ""}>Not set</option></select>`)}
      <div class="stack" data-acs="partner" ${p.acs_mode === "partner" ? "" : "hidden"}>
        ${field("ac-url", "TIP's Gene API address", `<input id="ac-url" name="url" value="${esc(p.acs_mode === "partner" ? p.acs_url : "")}" placeholder="http://acs.partner.in:7557" autocomplete="off">`, "Only Connect Bhai's server should be allowed to reach it.")}
        ${field("ac-key", "API key", `<input id="ac-key" name="key" type="password" autocomplete="off" placeholder="${p.acs_mode === "partner" && p.acs_key_set ? "Saved · leave empty to keep it" : "Key from the TIP"}">`, "Stored on the server only. It is never shown again.")}</div>
      <div class="field" data-f="ac-agree"><label class="check"><input type="checkbox" name="agreement" ${p.acs_agreement ? "checked" : ""}> Written agreement on file: what Connect Bhai may see (status, fiber signal) and do (restart, Wi-Fi change)</label><span class="ferr" id="ac-agree-err"></span></div>
      <button class="btn btn-primary" type="submit">Save Gene setup</button></form>`);
}
async function renderRouter() {
  const u = me();
  const head = (title, sub) => `<div class="dhead"><div><span class="eyebrow">Care plan · Gene, your personal assistant</span><h1>${title}</h1><p class="muted" style="max-width:64ch;margin-top:6px">${sub}</p></div><div class="row"><button class="btn btn-ghost" data-go="speed" type="button">Wi-Fi speed test</button></div></div>`;
  if (!u || u.role === "dsa") {
    const ico = (d, n = 22) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const I = {
      wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
      activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
      wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>',
      restart: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>', lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      signal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>', pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
      shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'
    };
    const art = `<svg class="care-art" viewBox="0 0 320 220" role="img" aria-hidden="true" focusable="false"><circle cx="160" cy="116" r="96" style="fill:var(--blue-soft)"/><path d="M96 82c36-34 92-34 128 0M118 104c24-22 60-22 84 0" fill="none" style="stroke:var(--sky);stroke-width:7;stroke-linecap:round"/><rect x="62" y="132" width="196" height="46" rx="14" style="fill:var(--blue)"/><circle cx="92" cy="155" r="6" style="fill:var(--ok)"/><circle cx="114" cy="155" r="6" style="fill:#fff"/><circle cx="136" cy="155" r="6" style="fill:#fff"/><rect x="190" y="150" width="50" height="10" rx="5" style="fill:#fff" opacity=".35"/><path d="M92 132V104M228 132V104" style="stroke:var(--blue);stroke-width:7;stroke-linecap:round"/><circle cx="252" cy="62" r="22" style="fill:var(--ok)"/><path d="m241 62 8 8 14-16" fill="none" style="stroke:#fff;stroke-width:5;stroke-linecap:round;stroke-linejoin:round"/></svg>`;
    const steps = [["01", I.wrench, "Scans the ONT serial", "Internet band hua? Aap se pehle Bhai ko pata chalega."], ["02", I.activity, "Modem reports every 5 minutes", "Bhai's Genie spots the problem and messages you on WhatsApp, while Bhai's team gets to work on it."], ["03", I.gauge, "You control it in the app", "Restart your Wi-Fi, change password and test speed on your app."]];
    const feats = [[I.wifi, "Online / Offline"], [I.signal, "Fiber signal"], [I.restart, "Restart modem"], [I.pencil, "Wi-Fi name"], [I.lock, "Wi-Fi password"], [I.gauge, "Line speed test"]];
    app.innerHTML = `<div class="wrap dash care-page">
      <section class="care-hero"><div class="care-copy"><span class="eyebrow">Care plan · Gene, your personal assistant</span><h1>Connect Bhai Care plan</h1>
        <p class="muted">Keep an eye on your home modem and fix common problems yourself.</p>
        ${u ? "" : `<div class="row"><button class="btn btn-primary" data-act="login" type="button">${ico(I.shield, 18)} Log in to Care plan</button></div>`}
        ${u ? `<p class="muted small" style="margin-top:12px">Modem status is shown to the customer, the installing TIP and admin, so it is not available for DSA accounts.</p>` : ""}</div>
        <div class="care-visual">${art}</div></section>
      <div class="steps3 care-steps">${steps.map(([n, ic, t, d]) => `<div class="cstep"><span class="cstep-ico">${ico(ic)}</span><span class="n">${n}</span><h3>${t}</h3><p>${d}</p></div>`).join("")}</div>
      <section class="card care-feats"><h3>What you can do</h3><ul>${feats.map(([ic, t]) => `<li><span>${ico(ic, 20)}</span>${t}</li>`).join("")}</ul></section></div>`;
    return;
  }
  const many = u.role !== "customer", f = S.routerFilter || "all";
  const isLinked = b => !!(b.ont_serial && b.device && b.device.acs);
  const title = u.role === "customer" ? "My Care plan" : u.role === "tip" ? "Care plan · modems I installed" : "Care plan · all modems";
  const sub = u.role === "customer" ? "Live status of your home modem. Restart it, change your Wi-Fi name or password, and test the line speed without Wi-Fi in between." : "Every installed modem through Gene, your personal assistant: online / offline, fiber signal and restarts, by area. Search by customer, phone or reference.";
  if (!many) {   // a customer has only their own few connections
    const list = (await API.myBookings()).filter(b => b.status === "installed");
    app.innerHTML = `<div class="wrap dash">${head(title, sub)}${CARE_NOTE}
      ${list.length ? `<div class="list">${list.map(b => routerCard(b, false)).join("")}</div>` : `<div class="empty"><b>No installed connection yet.</b><p class="muted">Your modem appears here after installation.</p></div>`}</div>`;
    list.forEach(b => loadHist(b.id)); return;
  }
  const sm = await carePlanSummary(API, u.role);
  let zoneHtml = "", acsHtml = "", locs = [];
  if (u.role === "admin") { try { locs = await API.adminLocations(); } catch (e) { } try { acsHtml = acsCard(await API.adminAcs()); } catch (e) { } }
  zoneHtml = routerZones(sm.zones, areaIndex(locs));
  const chips = [["all", "All"], ["offline", "Offline"], ["weak", "Weak signal"], ["reboots", "3+ restarts in 7 days"], ["unlinked", "Not linked"]];
  app.innerHTML = `<div class="wrap dash">${head(title, sub)}
    <div class="kpis"><div class="kpi"><span>Installed</span><b>${sm.installed}</b><small>${sm.linked} on Gene</small></div><div class="kpi"><span>Online</span><b style="color:var(--ok)">${sm.online}</b></div><div class="kpi"><span>Offline</span><b style="color:var(--bad)">${sm.offline}</b></div><div class="kpi"><span>Weak fiber signal</span><b style="color:var(--warn)">${sm.weak}</b></div></div>
    ${acsHtml}${zoneHtml}
    <div class="chips" style="margin-bottom:14px">${chips.map(([k, l]) => `<button type="button" class="chip" data-act="router-filter" data-v="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>
    ${CARE_NOTE}
    ${serverTable("router-" + u.role, { role: u.role, kind: "bookings", filters: () => ({ status: "installed", devices: true, device: f === "all" ? undefined : f }), label: "Search modems", empty: "No installed modems yet.", html: rows => `<div class="list">${rows.map(b => routerCard(b, true)).join("")}</div>`, onData: r => r.items.forEach(b => loadHist(b.id)) })}
  </div>`;
}

/* =====================================================================
   WI-FI SPEED TEST
   ===================================================================== */
const ST_PREVIEW = location.protocol === "file:" || /claude|anthropic/.test(location.hostname);
async function openTicketModal(prefill) {
  const bookings = (await API.myBookings()).filter(b => b.status !== "cancelled");
  openModal(`<h2>${esc(prefill.title || "Report slow speed")}</h2><form class="stack" data-form="ticket" novalidate style="margin-top:12px">
    <input type="hidden" name="type" value="complaint">
    ${field("tk-booking", "Connection", `<select id="tk-booking" name="booking_id"><option value="">Choose connection</option>${bookings.map(b => `<option value="${b.id}" ${b.id === prefill.booking_id ? "selected" : ""}>${esc(b.ref_code)} · ${esc(b.plan ? b.plan.name : "")}</option>`).join("")}</select>`)}
    <input type="hidden" name="category" value="${esc(prefill.category || "Slow speed")}">
    ${field("tk-desc", "Details", `<textarea id="tk-desc" name="description" maxlength="1000">${esc(prefill.description)}</textarea>`)}
    <button class="btn btn-primary" type="submit">Submit complaint</button></form>`);
}

/* =====================================================================
   EVENTS
   ===================================================================== */
const actions = {
  "app-soon": () => toast("The Connect Bhai app is coming soon. Until then the website works fully on your phone."),
  "close-modal": () => closeModal(),
  "chat": b => openChat(b.dataset.thread),
  "login-tab": b => openLogin(b.dataset.v),
  "login-otp": () => openLogin("otp"),
  "forgot-pw": () => openForgot(),
  "change-password": () => openSetPassword("change"),
  "copy-cred": async b => { try { await navigator.clipboard.writeText(b.dataset.v); toast("Copied."); } catch (e) { toast("Select and copy the details by hand.", true); } },
  "create-user": () => openCreateUser(),
  "team-filter": b => { S.teamFilter = b.dataset.v; resetServerTable("adm-team"); render(); },
  "reset-user": async b => {
    if (!confirm("Reset the password for " + b.dataset.name + "? A new one-time password will be sent on WhatsApp.")) return;
    const r = await guard(b, () => API.adminResetPassword(b.dataset.id)); openModal(`<h2>Password reset</h2><p class="muted" style="margin:4px 0 12px">Their old password no longer works.</p>${credBlock(r, esc(r.name || "") + " · " + ROLE_NAME[r.role])}`); render();
  },
  /* QA point 6: View any admin table row as a readable detail card (column name → value), for <table> and role="table" grids */
  "row-view": b => {
    const row = b.closest("tr, [role=row]"), tbl = row && row.closest("table, [role=table]"); if (!row || !tbl) return;
    const heads = [...tbl.querySelectorAll("thead th, [role=columnheader]")].map(h => h.textContent.trim());
    const cells = [...row.querySelectorAll(":scope > td, :scope > [role=cell]")];
    // the cell as laid out on screen (line breaks kept), minus its buttons
    const text = el => { let t = el.innerText; el.querySelectorAll("button, a.pt-more").forEach(x => { const bt = x.innerText.trim(); if (bt) t = t.replace(bt, ""); }); return t.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim(); };
    const pairs = cells.map((c, i) => [heads[i] || "", text(c)]).filter(([h, v]) => v && !/^actions?$/i.test(h));
    const title = ((pairs.find(([, v]) => v !== "—") || [])[1] || "Details").split("\n")[0];
    openModal(`<h2>${esc(title)}</h2><p class="muted small" style="margin:2px 0 12px">${esc(tbl.getAttribute("aria-label") || (b.closest(".card, section") || {}).querySelector?.("h2, h3")?.textContent || "Details")}</p>
      <div class="facts">${pairs.map(([h, v]) => `<div><span>${esc(h || "—")}</span><b style="white-space:pre-line;text-align:right">${esc(v)}</b></div>`).join("")}</div>
      <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn btn-primary btn-sm" data-act="close-modal" type="button">Close</button></div>`);
  },
  "delete-partner": async b => {
    if (!confirm(`Delete ${b.dataset.name} permanently?\n\nTheir leads stay, but lose this DSA / TIP. Their installations, payouts, payments, support tickets and messages are deleted too.\n\nThis cannot be undone. To only stop access, use Suspend instead.`)) return;
    await guard(b, () => API.deletePartner(b.dataset.id)); toast("DSA / TIP deleted."); render();
  },
  "toggle-user": async b => { await guard(b, () => API.adminSetDisabled(b.dataset.id, b.dataset.v === "1")); toast(b.dataset.v === "1" ? "Login disabled." : "Login enabled."); render(); },
  "pick-thread": b => { S.thread = b.dataset.thread; render(); },
  "edit-profile": () => {
    const u = me(); openModal(`<h2>Your details</h2><p class="muted" style="margin:4px 0 12px">Your mobile number is your WhatsApp login (+91 ${esc(u.phone || "")}). Your name and email are shown to the people working on your connection.</p>
    <form class="stack" data-form="set-profile" novalidate>${field("pf-name", "Full name", `<input id="pf-name" name="name" autocomplete="name" value="${esc(u.full_name || "")}">`)}${field("pf-email", "Email", `<input id="pf-email" name="email" type="email" autocomplete="email" value="${esc(u.email || "")}">`)}<button class="btn btn-primary" type="submit">Save</button></form>
    <div class="row" style="margin-top:14px;border-top:1px dashed var(--line);padding-top:12px"><b class="small">Password</b><span class="muted small">${u.pw || u.has_password ? "Log in with mobile + password" : "Not set yet. You log in with WhatsApp OTP."}</span><span class="spacer"></span><button class="btn btn-soft btn-sm" data-act="change-password" type="button">${u.pw || u.has_password ? "Change password" : "Create password"}</button></div>`);
  },
  "pick-city": b => { setCity(b.dataset.v); const s = document.getElementById("search"); if (s) s.scrollIntoView({ behavior: "smooth", block: "center" }); },
  "all-cities": () => { S.allCities = true; const sec = document.getElementById("cities"); if (sec) sec.outerHTML = citiesSection(); },
  "focus-city": () => { const s = document.getElementById("city-pick"); if (s) { s.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => s.focus(), 300); } },
  "wl-again": () => { S.wlDone = null; renderSearchCard(); },
  "add-city": () => openModal(`<h2>Add city or town</h2><p class="muted" style="margin:4px 0 12px">All 55 districts of Madhya Pradesh are already listed. Add a town (for example Pithampur or Itarsi) to give it its own launch and waiting list.</p>
    <form class="stack" data-form="add-city" novalidate>${field("ac-name", "City / town name", `<input id="ac-name" name="name">`)}${field("ac-dist", "District", `<input id="ac-dist" name="district" placeholder="e.g. Dhar">`)}
    ${field("ac-tier", "Show on home page", `<select id="ac-tier" name="tier"><option value="2">Yes, with the main cities</option><option value="3">Only under "Show all"</option></select>`)}<button class="btn btn-primary" type="submit">Add as launching soon</button></form>`),
  "launch-city": b => openLaunchCity(b.dataset.id),
  "launch-confirm": async b => { const n = await guard(b, () => API.adminLaunchCity(b.dataset.id)); closeModal(); S.cities = null; toast("City is live." + (n ? " WhatsApp sent to " + n + " " + (n === 1 ? "person" : "people") + " on the waiting list." : "")); render(); },
  "city-status": async b => { await guard(b, () => API.adminSetCityStatus(b.dataset.id, b.dataset.s)); S.cities = null; toast(b.dataset.s === "hidden" ? "City hidden from the website." : "City set to launching soon."); render(); },
  "wl-city": b => { S.wlCity = b.dataset.v; render(); setTimeout(() => { const w = document.getElementById("waitlist"); if (w) w.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); },
  "product": b => { S.product = b.dataset.v; resetSearch(); },
  "reset-pin": () => { window.location.reload(); },
  "sim-type": b => { S.simType = b.dataset.v; renderSearchCard(); },
  "sim-type-results": b => { S.simType = b.dataset.v; showCatalog(); },
  "plan-cat": b => { S.planCat = b.dataset.v; render(); },
  "plan-import": b => openImport(b.dataset.mode),
  "plan-template": () => downloadTemplate(),
  "area-template": () => downloadSheet("connectbhai-areas-template.csv", ["pincode", "area"], [["452010", "Vijay Nagar"], ["452010", "Scheme 54"], ["452016", "This is sample data - delete these rows and add your own"]]),
  "import-confirm": async b => {
    const rows = S.importRows || [];
    if (S.importMode === "tip") { const n = await guard(b, () => API.tipSubmitPlans(rows)); closeModal(); toast(n + " plan" + (n === 1 ? "" : "s") + " sent for review."); }
    else { const r = await guard(b, () => API.adminImportPlans(rows)); closeModal(); toast(`Imported: ${r.inserted} new, ${r.updated} updated.`); }
    render();
  },
  "review-plan": async b => {
    if (b.dataset.v === "1") { await guard(b, () => API.adminReviewPlan(b.dataset.id, true, "")); toast("Approved and published."); render(); }
    else openModal(`<h2>Reject submission</h2><form class="stack" data-form="review-reject" data-id="${b.dataset.id}" novalidate style="margin-top:12px">${field("rv-note", "Reason (shown to the TIP)", `<textarea id="rv-note" name="note" placeholder="e.g. Price doesn't match the circular"></textarea>`)}<button class="btn btn-danger" type="submit">Reject</button></form>`);
  },
  "tip-plan": b => openTipPlan(b.dataset.id),
  "activate-sim": b => openModal(`<h2>Mark as activated</h2><p class="muted" style="margin:4px 0 12px">Confirm the SIM was delivered, KYC was completed and the connection is active.</p>
    <form class="stack" data-form="activate-sim" data-id="${b.dataset.id}" novalidate>${field("as-ref", "Activation reference", `<input id="as-ref" name="reference" placeholder="e.g. last 4 digits of new number / order ID">`)}
    <div class="field" data-f="as-kyc"><label class="check"><input type="checkbox" name="kyc"> KYC completed and SIM activated</label><span class="ferr" id="as-kyc-err"></span></div><button class="btn btn-primary" type="submit">Confirm activation</button></form>`),
  "story-toggle": b => { const st = document.getElementById("story"); const p = st.classList.toggle("paused"); b.textContent = p ? "▶" : "❚❚"; b.setAttribute("aria-label", p ? "Play animation" : "Pause animation"); },
  "story-replay": () => { const st = document.getElementById("story"); st.getAnimations({ subtree: true }).forEach(a => { a.currentTime = 0; }); },
  "router-filter": b => { S.routerFilter = b.dataset.v;["admin", "tip"].forEach(r => resetServerTable("router-" + r)); render(); },
  "edit-acs": b => openAcs(b.dataset.id).catch(e => toast(errMsg(e), true)),
  "modem-reboot": b => openModal(`<h2>Restart modem?</h2><p class="muted" style="margin:6px 0 16px">Internet and Wi-Fi will be off for about 2 minutes while the modem restarts. Phones and laptops reconnect by themselves.</p>
    <div class="row"><button class="btn btn-primary" data-act="modem-reboot-go" data-id="${esc(b.dataset.id)}" type="button">Restart now</button><button class="btn btn-ghost" data-act="close-modal" type="button">Cancel</button></div>`),
  "modem-reboot-go": async b => {
    const d = await guard(b, () => API.deviceAction(b.dataset.id, "reboot")); closeModal();
    if (await trackAction(b.dataset.id, "reboot")) { toast("Restart sent."); return; }
    toast("Restart sent. The modem restarts when it next checks in (about a minute), then is back in about 2 minutes. The status shows under Restarts and Wi-Fi changes." + (d && d.is_simulated ? " (simulated)" : "")); render();
  },
  "modem-wifi": b => openModal(`<h2>Change Wi-Fi name / password</h2><p class="notice" style="margin:8px 0 14px">Every phone and laptop on this Wi-Fi will disconnect. After about 1 minute, join the new Wi-Fi name with the new password.</p>
    <form class="stack" data-form="modem-wifi" data-id="${esc(b.dataset.id)}" data-old="${esc(b.dataset.ssid || "")}" novalidate>
      ${field("mw-ssid", "New Wi-Fi name", `<input id="mw-ssid" name="ssid" maxlength="32" autocomplete="off" placeholder="${esc(b.dataset.ssid || "")}">`, "Now: <b>" + esc(b.dataset.ssid || "—") + "</b>. Leave empty to keep it.")}
      ${field("mw-pw", "New Wi-Fi password", `<input id="mw-pw" name="password" type="password" maxlength="63" autocomplete="new-password">`, "8 to 63 characters. Leave empty to keep it.")}
      <button class="btn btn-primary" type="submit">Change Wi-Fi</button></form>`),
  "offline-complaint": b => openTicketModal({ booking_id: b.dataset.id, title: "Report modem offline", category: "No internet", description: "My modem shows Offline in Connect Bhai since " + fdt(new Date()) + ". Please check the line." }).catch(e => toast(errMsg(e), true)),
  "router-test": async b => {
    const out = document.getElementById("rt-" + b.dataset.id); const label = b.textContent;
    b.disabled = true; b.textContent = "Router test running…"; if (out) out.textContent = "The router is downloading a test file. This can take 1–5 minutes.";
    try {
      const t = await API.routerTest(b.dataset.id, q => { if (q && out) out.textContent = "Waiting for the modem to check in with Gene (up to 5 minutes)…"; });
      if (!out) toast(t.status === "done" ? `Router speed: ${Number(t.download_mbps).toFixed(1)} Mbps (line speed, without Wi-Fi).` : "Router test failed. Please try again later.", t.status !== "done");
      if (out) out.innerHTML = t.status === "done" ? `Router speed: <b>${Number(t.download_mbps).toFixed(1)} Mbps</b> (line speed, without Wi-Fi)${t.is_simulated ? ` <span class="badge sim">Simulated</span>` : ""}` : "Router test failed. Please try again later.";
      loadHist(b.dataset.id);
    } catch (e) { if (out) out.textContent = errMsg(e); else toast(errMsg(e), true); }
    finally { if (document.body.contains(b)) { b.disabled = false; b.textContent = label; } }
  },
  "otp-resend": async b => { await guard(b, () => API.sendOtp(b.dataset.phone, ((document.querySelector('[data-form="otp-verify"]') || { dataset: {} }).dataset.purpose === "request") ? "customer" : undefined)); toast("OTP sent again on WhatsApp."); openOtpStep(b.dataset.phone, (document.querySelector('[data-form="otp-verify"]') || { dataset: {} }).dataset.purpose || "login"); },
  "reload": () => render(),
  "login": () => openLogin(),
  // full page load on purpose: logging out clears every in-memory screen
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  "logout": async () => { await API.signOut(); try { localStorage.removeItem("cb-session"); localStorage.removeItem("cb-role"); } catch (e) { } window.location.href = "/"; },
  "fill-admin": () => {
    const ph = document.getElementById("pl-phone"), pw = document.getElementById("pl-pw");
    if (ph) ph.value = LIVE ? "9999999999" : "9876500999";
    const stagingPw = process.env.NEXT_PUBLIC_STAGING_ADMIN_PW || "";
    if (pw) pw.value = LIVE ? stagingPw : "Demo@1234";
    (pw || ph) && (pw || ph).focus();
  },
  "demo-login": async b => { const u = await API.signInDemo(b.dataset.id); try { localStorage.setItem("cb-session", u.id); } catch (e) { } closeModal(); toast(`Logged in as ${u.full_name} (${ROLE_NAME[u.role]}).`); go(ROLE_HOME[u.role]); },
  "reset-demo": () => { resetDemoData(); S.cities = null; S.results = null; S.compare = []; toast("Demo data reset."); go(S.view === "home" ? "home" : S.view, S.tab); },
  "pick-pin": b => { $("#pin").value = b.dataset.pin; searchPin(b.dataset.pin); },
  "f-speed": b => { S.f.speed = Number(b.dataset.v); renderResults(); },
  "reset-filters": () => { resetFilters(); renderResults(); },
  "toggle-compare": b => {
    const id = b.dataset.id;
    if (S.compare.includes(id)) S.compare = S.compare.filter(x => x !== id);
    else { if (S.compare.length >= 3) { b.checked = false; toast("You can compare up to 3 plans."); return; } S.compare.push(id); }
    b.closest(".plan").classList.toggle("sel", S.compare.includes(id)); updateCompareBar();
  },
  "open-compare": () => openCompare(),
  "clear-compare": () => { S.compare = []; renderResults(); updateCompareBar(); },
  "request": b => openRequest(b.dataset.plan),
  "refresh-device": async b => { const d = await guard(b, () => API.refreshDevice(b.dataset.id)); toast(stateMsg(d)); render(); },
  "dsa-filter": b => { S.dsaFilter = b.dataset.v; resetServerTable("dsa-leads"); render(); },
  "admin-lead-filter": b => { S.adminLeadFilter = b.dataset.v; resetServerTable("adm-leads"); render(); },
  "partners-pending": b => { if (S.view !== "admin" || S.tab !== "partners") { S.partnerStatus = "pending"; go("admin", "partners"); return; } S.partnerStatus = b.dataset.all || S.partnerStatus === "pending" ? "all" : "pending"; render(); },
  "partner-type": b => { S.partnerType = b.dataset.v; render(); },
  "perf-type": b => { S.perfType = b.dataset.v; render(); },
  "zone-filter": b => { S.zoneFilter = b.dataset.v; resetServerTable("adm-leads"); render(); setTimeout(() => { const t = document.querySelector("#tabbody .tbl-wrap"); if (t && b.dataset.v !== "all") t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); },
  "zone-all": () => { S.zoneAll = !S.zoneAll; render(); },
  "lead": b => openLead(b.dataset.id).catch(e => toast(errMsg(e), true)),
  "book": b => openBook(b.dataset.id),
  "care-plan-buy": async b => {
    if (!API.carePlanCharge) { toast("Adding Care plan needs the live API.", true); return; }
    b.disabled = true;
    try { paySuccess(await API.carePlanCharge(b.dataset.id)); } catch (e) { toast(errMsg(e), true); } finally { b.disabled = false; }
  },
  "booking-status": b => openBookingStatus(b.dataset.id).catch(e => toast(errMsg(e), true)),
  "ticket-status": b => openTicketStatus(b.dataset.id, b.dataset.s),
  "assign": b => openAssign(b.dataset.id),
  "edit-partner": b => openPartner(b.dataset.id),
  "partner-status": async b => {
    const on = b.dataset.s === "active", who = b.dataset.name || "this account";
    if (!confirm(on ? `Activate ${who}? They will be able to log in and receive leads again.` : `Suspend ${who}? They will not be able to log in until you activate them again. A TIP's PIN-code coverage is also switched off.`)) return;
    await guard(b, () => API.setPartnerStatus(b.dataset.id, b.dataset.s)); toast(on ? "Account activated." : "Account suspended."); render();
  },
  "edit-provider": b => openProvider(b.dataset.id),
  "toggle-provider": async b => { await guard(b, () => API.toggleProvider(b.dataset.id)); render(); },
  "edit-plan": b => openPlan(b.dataset.id),
  "toggle-plan": async b => { await guard(b, () => API.togglePlan(b.dataset.id)); render(); },
  "edit-lead": async b => {
    const l = await API.leadDetail(b.dataset.id);
    const areas = ((await API.adminLocations().catch(() => [])) || []).filter(x => x.pincode === l.pincode);
    openModal(`<h2>Edit lead</h2><p class="muted small" style="margin:2px 0 12px"><span class="mono">${esc(l.ref_code)}</span> · ${leadPill(l.status, l.product)} · works in any status. Status, DSA and TIP change with their own buttons.</p>
      <form class="stack" data-form="lead-edit" data-id="${esc(l.id)}" data-pin="${esc(l.pincode)}" novalidate>
        <div class="grid2">${field("le-name", "Customer name", `<input id="le-name" name="name" value="${esc(l.name || "")}">`)}${field("le-phone", "Mobile", `<input id="le-phone" name="phone" inputmode="numeric" maxlength="16" value="${esc(l.phone || "")}">`)}
        ${field("le-email", "Email", `<input id="le-email" name="email" type="email" value="${esc(l.email || "")}">`)}${field("le-pin", "PIN code", `<input id="le-pin" name="pincode" inputmode="numeric" maxlength="6" value="${esc(l.pincode || "")}">`)}</div>
        ${areas.length ? field("le-area", "Area", `<select id="le-area" name="area_id"><option value="">— None —</option>${areas.map(a => `<option value="${esc(a.id)}" ${String(a.id) === String(l.area_id) ? "selected" : ""}>${esc(a.area)}</option>`).join("")}</select>`, "Changing the PIN code clears the area.") : ""}
        ${field("le-addr", "Address", `<input id="le-addr" name="address" value="${esc(l.address || "")}" maxlength="255">`)}
        ${field("le-notes", "Notes", `<textarea id="le-notes" name="notes" maxlength="1000">${esc(l.notes || "")}</textarea>`)}
        <button class="btn btn-primary" type="submit">Save</button></form>`);
  },
  "delete-lead": async b => {
    if (!confirm(`Delete lead ${b.dataset.ref} (${b.dataset.name}) permanently?\n\nIts booking, payout, modem record, chat and history are deleted too. Invoices and payments stay as records, unlinked from the lead.\n\nThis cannot be undone.`)) return;
    await guard(b, () => API.deleteLead(b.dataset.id)); toast("Lead deleted."); render();
  },
  "delete-location": async b => {
    const only = Number(b.dataset.n) <= 1;
    if (!confirm(`Delete ${b.dataset.pin} · ${b.dataset.area}?\n\nLeads linked to this area stay, they just lose the area (their PIN code is kept).${only ? `\n\nThis is the only area for PIN ${b.dataset.pin}, so customers can no longer search or order there until you add it again. TIP coverage and plan settings for this PIN are kept and come back when you add it again.` : ""}\n\nThis cannot be undone.`)) return;
    await guard(b, () => API.deleteLocation(b.dataset.id)); toast("Area deleted."); render();
  },
  "edit-location": b => openModal(`<h2>Rename area</h2><p class="muted" style="margin:4px 0 12px">PIN <b class="mono">${esc(b.dataset.pin)}</b>. The new name shows on every lead linked to this area. The PIN code itself cannot be changed here.</p>
    <form class="stack" data-form="location-edit" data-id="${esc(b.dataset.id)}" novalidate>${field("el-area", "Area name", `<input id="el-area" name="area" value="${esc(b.dataset.area)}" maxlength="120" autocomplete="off">`)}
    <button class="btn btn-primary" type="submit">Save</button></form>`),
  "add-location": () => {
    S.areaRows = [];
    openModal(`<h2>Add PIN / area</h2><p class="muted" style="margin:4px 0 12px">Type the PIN code and the area name yourself. Nothing is looked up or filled in for you.</p>
    <form class="stack" data-form="location" novalidate>${field("lc-pin", "PIN code", `<input id="lc-pin" name="pincode" inputmode="numeric" maxlength="6" autocomplete="off">`)}
    ${field("lc-area", "Area name", `<input id="lc-area" name="area" maxlength="120" autocomplete="off">`, "One area at a time. Add the same PIN again for another area.")}
    ${field("lc-city", "City", `<select id="lc-city" name="city_id">${cityOptions("indore", true)}</select>`, "Add PIN codes of a city before you launch it.")}
    <button class="btn btn-primary" type="submit">Add area</button></form>
    ${REST ? `<hr style="margin:16px 0;border:0;border-top:1px solid var(--line)"><h3 style="margin:0 0 6px;font-size:16px">Or add many from a sheet</h3>
    <p class="muted small" style="margin:0 0 10px">A .xlsx or .csv with two columns: <b>pincode</b> and <b>area</b>, one area per row. The city above is used for every row.</p>
    <div class="row" style="margin-bottom:10px"><button class="btn btn-ghost btn-sm" data-act="area-template" type="button">Download sample sheet</button></div>
    <input id="ap-file" type="file" accept=".xlsx,.csv"><div id="ap-out"></div>` : ""}`);
  },
  "areas-bulk": async b => {
    const rows = S.areaRows || []; if (!rows.length) return;
    const r = await guard(b, () => API.addAreasBulk(Number((document.getElementById("lc-city") || {}).value) || 1, rows.map(x => ({ pincode: x.pin, name: x.area })))); closeModal(); S.areaRows = [];
    toast(`${r.added} area${r.added === 1 ? "" : "s"} added.${r.skipped ? " " + r.skipped + " already existed." : ""}`); render();
  },
  "use-location": async b => {
    const err = document.getElementById("pin-err");
    try {
      const c = await guard(b, getCoords); const r = await API.geoReverse(c.lat, c.lng);
      document.getElementById("pin").value = r.pincode; toast(`Location found: ${r.pincode}${r.area ? " · " + r.area : ""}${r.simulated || c.simulated ? " (simulated in preview)" : ""}`); searchPin(r.pincode);
    }
    catch (e) { if (err) err.textContent = errMsg(e); }
  },
  "pin-location": async b => {
    const f = b.closest("form"), out = document.getElementById("rq-loc");
    try {
      const c = await guard(b, getCoords); f.dataset.lat = c.lat.toFixed(6); f.dataset.lng = c.lng.toFixed(6);
      out.innerHTML = `<b style="color:var(--ok)">Location pinned</b> (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)})${c.simulated ? " · simulated in preview" : ""}`; b.textContent = "Update location";
    }
    catch (e) { out.textContent = errMsg(e); }
  },
  "auto-assign": async b => { await guard(b, () => API.setAutoAssign(b.dataset.v === "1")); toast("Auto-assign turned " + (b.dataset.v === "1" ? "on." : "off.")); render(); },
  "dsa-add": () => openModal(`<h2>Add a lead</h2><p class="muted" style="margin:4px 0 12px">For a customer you met in the field. The lead is recorded as yours. You call, follow up and book it, then assign the TIP who installs it.</p>
    <form class="stack" data-form="dsa-add" novalidate><div class="grid2">
      ${field("dl-name", "Customer name", `<input id="dl-name" name="name">`)}${field("dl-phone", "Customer mobile", `<input id="dl-phone" name="phone" inputmode="numeric" maxlength="16">`)}
      ${field("dl-pin", "PIN code", `<input id="dl-pin" name="pincode" inputmode="numeric" maxlength="6">`)}${field("dl-area", "Area / colony", `<input id="dl-area" name="area">`)}</div>
      ${field("dl-addr", "Address", `<input id="dl-addr" name="address">`)}
      ${field("dl-plan", "Plan (optional)", `<select id="dl-plan" name="plan_id"><option value="">Enter PIN code to load plans</option></select>`)}
      <div class="field" data-f="dl-consent"><label class="check"><input type="checkbox" name="consent"> The customer agreed to be contacted by Connect Bhai and its DSAs and TIPs.</label><span class="ferr" id="dl-consent-err"></span></div>
      <button class="btn btn-primary" type="submit">Add lead</button></form>`),
  "approve-partner": async b => { await guard(b, () => API.approvePartner(b.dataset.id)); toast("DSA / TIP approved. Registration fee sent on WhatsApp."); render(); },
  "pay": b => openPay(b.dataset.id),
  "charge-action": b => openChargeAction(b.dataset.id, b.dataset.a),
  "new-charge": () => openNewCharge(),
  "billing-filter": b => { S.billFilter = b.dataset.v; resetServerTable("adm-bills"); render(); },
  "add-coverage": () => openCoverage(),
  "remove-coverage": async b => { await guard(null, () => API.removeCoverage(b.dataset.id)); toast("Coverage removed."); render(); },
  "commission": async b => { await guard(b, () => API.setCommission(b.dataset.id, b.dataset.s)); toast(b.dataset.s === "approved" ? "Commission approved." : "Commission rejected."); render(); },
  "payout": b => openModal(`<h2>Record payout</h2><p class="muted" style="margin:4px 0 12px">${b.dataset.ids.split(",").length} approved commission(s) · <b>${inr(b.dataset.total)}</b></p>
    <form class="stack" data-form="pay" data-id="${b.dataset.id}" data-ids="${b.dataset.ids}" novalidate>${field("py-method", "Method", `<select id="py-method" name="method"><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="cash">Cash</option></select>`)}${field("py-ref", "Reference (UTR / cheque no.)", `<input id="py-ref" name="reference">`)}<button class="btn btn-primary" type="submit">Mark as paid</button></form>`)
};
const onClick = e => {
  const g = e.target.closest("[data-go]");
  if (g) { e.preventDefault(); closeModal(); go(g.dataset.go, g.dataset.goTab || null, { scroll: g.dataset.scroll }); return; }
  const t = e.target.closest("[data-tab]");
  if (t && !t.closest("form")) { S.tab = t.dataset.tab; renderedKey = S.view + "/" + S.tab; navigate(pathFor(S.view, S.tab), "replace"); render(); return; }
  const a = e.target.closest("[data-act]");
  if (a && actions[a.dataset.act]) { if (a.tagName !== "INPUT") e.preventDefault(); track(actions[a.dataset.act](a, e)).catch(() => { }); }
};
/* PIN lookup in forms (India Post directory through our API): checks the PIN, shows state / district / serviceability and suggests area names. */
/* A list of PIN codes ("452010, 452016"): every one is checked against India Post; bad ones are flagged and block the form. */
const PIN_LISTS = ["pa-pins"];
let pinListTimer = null;
function pinListAssist(el) {
  if (!REST || !PIN_LISTS.includes(el.id)) return;
  clearTimeout(pinListTimer);
  const wrap = el.closest(".field") || el.parentElement;
  let box = wrap.querySelector(".pin-list"); if (!box) { box = document.createElement("div"); box.className = "pin-list small"; el.insertAdjacentElement("afterend", box); }
  const pins = [...new Set(el.value.split(/[,\s]+/).filter(Boolean))];
  el.dataset.bad = ""; if (!pins.length) { box.innerHTML = ""; return; }
  if (pins.length > 10) { box.innerHTML = `<span style="color:var(--bad)">Enter at most 10 PIN codes.</span>`; el.dataset.bad = "1"; return; }
  pinListTimer = setTimeout(async () => {
    try {
      const rows = await API.pinLookupMany(pins); if (el.value.split(/[,\s]+/).filter(Boolean).join() !== pins.join() && [...new Set(el.value.split(/[,\s]+/).filter(Boolean))].join() !== pins.join()) return;
      el.dataset.bad = rows.some(r => !r.valid) ? "1" : "";
      box.innerHTML = rows.map(r => r.valid ? `<div style="color:var(--ok)">✓ <b>${esc(r.pincode)}</b> · ${esc(r.district || r.city || "")}, ${esc(r.state || "")} · ${esc(r.areas.slice(0, 3).join(", "))}${r.areas.length > 3 ? " +" + (r.areas.length - 3) : ""}</div>` : `<div style="color:var(--bad)">✗ <b>${esc(r.pincode)}</b> · ${esc(r.error || "not found in the India Post directory")}</div>`).join("");
    } catch (e) { box.innerHTML = ""; }
  }, 450);
}
const PIN_FIELDS = { "rq-pin": "rq-area", "pa-pin1": null, "dl-pin": "dl-area" };   // "lc-pin" (admin Add PIN / area) is typed by hand: no India Post check or auto-fill
let pinTimer = null;
function pinAssist(el) {
  if (!REST || !(el.id in PIN_FIELDS)) return;
  clearTimeout(pinTimer);
  const wrap = el.closest(".field") || el.parentElement;
  let hint = wrap.querySelector(".pin-hint"); if (!hint) { hint = document.createElement("span"); hint.className = "hint pin-hint"; el.insertAdjacentElement("afterend", hint); }
  const pin = el.value.trim();
  if (!/^\d{6}$/.test(pin)) { hint.textContent = ""; return; }
  hint.style.color = ""; hint.textContent = "Checking PIN code…";
  pinTimer = setTimeout(async () => {
    try {
      const r = await API.pinLookup(pin); if (el.value.trim() !== pin) return;
      if (!r.valid) { hint.style.color = "var(--bad)"; hint.textContent = "This PIN code was not found. Please check it."; return; }
      hint.style.color = r.serviceable ? "var(--ok)" : "";
      hint.textContent = `${r.district || r.city || ""}${r.state ? ", " + r.state : ""}${r.serviceable ? " · we serve this area" : " · we are not live here yet"}`;
      const areaId = PIN_FIELDS[el.id], area = areaId && document.getElementById(areaId);
      if (area && r.areas.length) {
        let dl = document.getElementById("pin-areas"); if (!dl) { dl = document.createElement("datalist"); dl.id = "pin-areas"; document.body.appendChild(dl); }
        dl.innerHTML = r.areas.map(a => `<option value="${esc(a)}">`).join(""); area.setAttribute("list", "pin-areas");
        if (!area.value) area.placeholder = "e.g. " + r.areas[0];
      }
    } catch (e) { hint.textContent = ""; }   // lookup is a convenience; the form still works without it
  }, 350);
}
const onInput = e => {
  pinAssist(e.target); pinListAssist(e.target); pinSuggest(e.target, API);
  const t = e.target;
  if (t && t.tagName === "INPUT" && /phone$/.test(t.name)) { const c = normPhone(t.value).slice(0, 12); if (t.value !== c) t.value = c; }   // strips + spaces - and the 91 / 0 prefix
  if (t && t.classList && t.classList.contains("otp-box")) { const d = t.value.replace(/\D/g, ""); t.value = ""; if (d) otpFill(t, d); else otpSync(t); return; }
  if (t && t.tagName === "INPUT" && t.name === "otp") { const c = t.value.replace(/\D/g, "").slice(0, 6); if (t.value !== c) t.value = c; }
  const el = e.target; if (!el.dataset || !el.dataset.filter) return;
  const k = el.dataset.filter;
  if (k === "price") { S.f.price = Number(el.value); $("#f-price-v").textContent = inr(el.value); clearTimeout(S.pt); S.pt = setTimeout(renderResults, 120); return; }
};
/* KYC documents: start uploading the moment a file is chosen (while the person keeps typing), so "Submit" only has to wait
   for whatever is still in flight. Phone photos are shrunk first: a 4 MB Aadhaar photo becomes ~300 KB and uploads in a second or two. */
const KYC_INPUTS = { doc_aadhaar: "aadhaar", doc_pan: "pan", doc_bank: "bank_proof" };
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png)$/.test(file.type) || file.size < 600 * 1024 || typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch (e) { return file; }
}
function startKycUpload(input) {
  const file = input.files && input.files[0], box = input.parentElement;
  let note = box && box.querySelector("[data-up]");
  if (box && !note) { note = document.createElement("span"); note.className = "muted small"; note.dataset.up = "1"; box.appendChild(note); }
  if (!file) { input._up = null; if (note) note.textContent = ""; return; }
  if (note) note.textContent = "Uploading…";
  const p = shrinkImage(file).then(f => API.uploadFile(f, "kyc"));
  input._up = { file, promise: p };
  p.then(() => { if (note && input._up && input._up.promise === p) note.textContent = "Uploaded ✓"; }, err => { if (note) note.textContent = ""; toast(errMsg(err), true); });
}
const onChange = e => {
  if (e.target.type === "file" && KYC_INPUTS[e.target.name] && e.target.closest("form[data-form=partner-apply]")) { startKycUpload(e.target); return; }
  if (e.target.id === "pa-type") { syncPartnerType(); return; }
  if (e.target.id === "city-pick") { setCity(e.target.value); return; }
  if (e.target.id === "wl-filter") { S.wlCity = e.target.value; render(); return; }
  if (e.target.id === "lc-city") { const z = document.querySelector('[data-f="lc-zone"]'); if (z) z.hidden = e.target.value !== "indore"; return; }
  if (e.target.id === "ac-mode") { const el = document.querySelector('[data-acs="partner"]'); if (el) el.hidden = e.target.value !== "partner"; return; }
  if (e.target.id === "imp-file") { previewImport(e.target); return; }
  if (e.target.id === "ap-file") { readAreaFile(e.target); return; }
  if (e.target.name === "category" && e.target.closest("form[data-form=plan], form[data-form=tip-plan]")) { syncPlanForm(e.target.closest("form")); return; }
  if (e.target.name === "sim_conn") { const port = e.target.value === "port"; document.getElementById("sm-port").hidden = !port; document.getElementById("sm-prefwrap").hidden = port; return; }
  if (e.target.dataset && e.target.dataset.zoneLoc) { const v = e.target.value; guard(null, () => API.saveLocationZone(e.target.dataset.zoneLoc, v)).then(() => { toast(v ? "Zone set to " + ZONE_NAME[v] + "." : "Zone removed."); }).catch(() => { }); return; }
  if (e.target.id === "zone-pick") { S.zoneFilter = e.target.value; resetServerTable("adm-leads"); render(); return; }
  if (e.target.id === "lc-pin") { const z = ZONE_BY_PIN[e.target.value.trim()], sel = document.getElementById("lc-zone"); if (z && sel && !sel.value) sel.value = z; }
  if (e.target.id === "cu-role") { const a = e.target.value === "admin";["cu-firm", "cu-pins"].forEach(k => { document.querySelector(`[data-f="${k}"]`).hidden = a; }); document.getElementById("cu-note").hidden = a; return; }
  if (e.target.id === "cp-what") { const a = e.target.value.split("|")[2], inp = document.getElementById("cp-amt"); if (inp) { inp.value = a || ""; if (!a) inp.focus(); } return; }
  if (e.target.id === "dl-pin" && isPin(e.target.value.trim())) { API.searchPlans(e.target.value.trim()).then(r => { const sel = document.getElementById("dl-plan"); if (!sel) return; sel.innerHTML = `<option value="">${r.plans.length ? "No plan yet / callback" : "No plans at this PIN code"}</option>` + r.plans.sort((a, b) => a.price_monthly - b.price_monthly).map(p => `<option value="${p.id}">${esc(joinDot(p.provider && p.provider.name, p.name, speedTxt(p), inr(p.price_monthly)))}</option>`).join(""); const ar = document.getElementById("dl-area"); if (ar && !ar.value && r.areas[0]) ar.value = r.areas[0]; }).catch(() => { }); return; }
  if (e.target.id === "nc-payer") { const c = e.target.value === "customer"; document.querySelector('[data-f="nc-partner"]').hidden = c; document.querySelector('[data-f="nc-customer"]').hidden = !c; document.getElementById("nc-kind").value = c ? "customer_payment" : "registration_fee"; return; }
  const el = e.target; if (!el.dataset || !el.dataset.filter) return;
  const k = el.dataset.filter;
  if (k === "sort") S.f.sort = el.value;
  if (k === "ott") S.f.ott = el.checked;
  if (k === "tv") S.f.tv = el.checked;
  if (k === "prov") S.f.providers = el.checked ? S.f.providers.concat(el.value) : S.f.providers.filter(x => x !== el.value);
  if (k !== "price") renderResults();
};

/* ---------- forms ---------- */
const forms = {
  pin: async (f, btn) => {
    if (S.city && cityList().length && !cityLive(S.city)) {
      const d = { city_id: S.city, name: val(f, "wl_name"), phone: val(f, "wl_phone"), pincode: val(f, "wl_pin"), interest: S.product, consent: val(f, "wl_consent") }, e = {};
      if (d.name.length < 2) e["wl-name"] = "Enter your name."; if (!isPhone(d.phone)) e["wl-phone"] = "Enter a valid 10-digit WhatsApp number.";
      if (d.pincode && !isPin(d.pincode)) e["wl-pin"] = "Enter a valid 6-digit PIN code."; if (!d.consent) e["wl-consent"] = "Tick this so we can message you at launch.";
      if (!setErr(f, e)) return;
      const r = await guard(btn, () => API.joinWaitlist(d)); S.wlDone = { city_id: d.city_id, phone: d.phone, waiting: r.waiting }; renderSearchCard(); toast("You're on the list for " + r.city + "."); return;
    }
    return ["sim", "ott"].includes(S.product) ? showCatalog() : searchPin(val(f, "pin"));
  },
  "pw-login": async (f, btn) => {
    const phone = val(f, "phone"), pw = f.elements.password.value, e = {};
    if (phoneError(phone)) e["pl-phone"] = phoneError(phone); if (!pw) e["pl-pw"] = "Enter your password.";
    if (!setErr(f, e)) return;
    let u; try { u = await guard(btn, () => API.signInPassword(phone, pw)); } catch (x) { setErr(f, { "pl-pw": errMsg(x) }); return; }
    afterLogin(u);
  },
  "set-password": async (f, btn) => {
    const cur = f.elements.current ? f.elements.current.value : "", nx = f.elements.next.value, nx2 = f.elements.next2.value, e = {};
    if (f.elements.current && !cur) e["sp-cur"] = "Enter your current password.";
    if (!pwOk(nx)) e["sp-new"] = PW_RULE; else if (nx !== nx2) e["sp-new2"] = "Passwords do not match.";
    if (!setErr(f, e)) return;
    let u; try { u = await guard(btn, () => API.changePassword(cur, nx)); } catch (x) { setErr(f, { [f.elements.current ? "sp-cur" : "sp-new"]: errMsg(x) }); return; }
    const mode = f.dataset.mode;
    openModal(`<div style="text-align:center;display:grid;gap:10px;justify-items:center;padding:8px 0"><span class="avatar" style="width:56px;height:56px;font-size:24px;background:var(--ok)">✓</span>
      <h2 style="padding:0">Password ${mode === "change" ? "changed" : "set"}</h2><p class="muted">A confirmation message has been sent on WhatsApp to <b>${esc(fmtPh(u.phone))}</b>.<br>Next time, log in with your mobile number and this password.</p>
      <button class="btn btn-primary" ${mode === "change" ? `data-act="close-modal"` : `data-go="${ROLE_HOME[u.role]}"`} type="button">${mode === "change" ? "Done" : "Go to my dashboard"}</button></div>`);
    renderHeader(); if (mode === "change") render();
  },
  "create-user": async (f, btn) => {
    const d = { role: val(f, "role"), name: val(f, "name"), phone: val(f, "phone"), email: val(f, "email"), firm: val(f, "firm"), pincodes: val(f, "pincodes") }, e = {};
    if (d.name.length < 2) e["cu-name"] = "Enter the name."; if (!isPhone(d.phone)) e["cu-phone"] = "Enter a valid 10-digit mobile number.";
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e["cu-email"] = "Enter a valid email.";
    if (d.role !== "admin" && d.pincodes && !d.pincodes.split(",").every(p => isPin(p.trim()))) e["cu-pins"] = "Enter 6-digit PIN codes separated by commas.";
    if (!setErr(f, e)) return;
    const r = await guard(btn, () => API.adminCreateUser(d));
    openModal(`<h2>Login created</h2><p class="muted" style="margin:4px 0 12px">${esc(r.name)} can now log in as <b>${ROLE_NAME[r.role]}</b>.</p>${credBlock(r, "Share only with " + esc(r.name))}`); render();
  },
  "chat-send": async (f, btn) => {
    const body = val(f, "body"); if (!body) return;
    await guard(btn, () => API.sendMessage(f.dataset.thread, body));
    if (f.closest("#mbox")) { await openChat(f.dataset.thread); return; }
    S.thread = f.dataset.thread; await render(); const i = document.querySelector(".sendbar input"); if (i) i.focus();
  },
  "set-profile": async (f, btn) => {
    const d = { name: val(f, "name"), email: val(f, "email") }, e = {};
    if (d.name.length < 2) e["pf-name"] = "Enter your name."; if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e["pf-email"] = "Enter a valid email.";
    if (!setErr(f, e)) return; await guard(btn, () => API.setMyProfile(d)); closeModal(); toast("Details saved."); renderHeader(); render();
  },
  "cust-pay": async (f, btn) => {
    const [lead_id, description] = val(f, "what").split("|"), amount = Number(val(f, "amount"));
    if (!setErr(f, amount >= 1 ? {} : { "cp-amt": "Enter an amount of ₹1 or more." })) return;
    const c = await guard(btn, () => API.customerPay({ lead_id: lead_id || null, description, amount }));
    await openPay(c.id);
  },
  "pay-public": async (f, btn) => {
    const m = (f.querySelector("input[name=method]:checked") || {}).value || "upi"; btn.disabled = true; btn.textContent = "Processing payment…";
    try { const c = await API.payPublicCharge(f.dataset.id, m, { name: f.dataset.name, phone: f.dataset.phone, email: f.dataset.email }); if (me()) renderHeader(); paySuccess(c); } catch (e) { btn.disabled = false; btn.textContent = "Try again"; toast(errMsg(e), true); }
  },
  "partner-apply": async (f, btn) => {
    const d = { type: val(f, "type"), name: val(f, "name"), firm: val(f, "firm"), phone: val(f, "phone"), email: val(f, "email"), pincodes: val(f, "pincodes"), city_id: val(f, "city_id") }, e = {};
    if (REST) {
      Object.assign(d, { address: val(f, "address"), pincode: val(f, "pincode"), aadhaar: val(f, "aadhaar"), pan: val(f, "pan").toUpperCase(), gst_number: val(f, "gst_number").toUpperCase(), bank_name: val(f, "bank_name"), bank_account: val(f, "bank_account"), bank_ifsc: val(f, "bank_ifsc").toUpperCase() });
      if (d.address.length < 5) e["pa-addr"] = "Enter your address."; if (!isPin(d.pincode)) e["pa-pin1"] = "Enter a valid 6-digit PIN code.";
      if (!/^\d{4}\s?\d{4}\s?\d{4}$/.test(d.aadhaar)) e["pa-aadhaar"] = "Aadhaar must be 12 digits."; if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(d.pan)) e["pa-pan"] = "Enter a valid PAN, e.g. ABCDE1234F.";
      if (d.gst_number && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(d.gst_number)) e["pa-gst"] = "Enter a valid GSTIN.";
      if (d.bank_name.length < 2) e["pa-bank"] = "Enter the bank name."; if (!/^\d{6,20}$/.test(d.bank_account)) e["pa-acct"] = "Enter the account number (digits only).";
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(d.bank_ifsc)) e["pa-ifsc"] = "Enter a valid IFSC, e.g. SBIN0001234.";
      // the server requires all three documents: say so on the form, not after the instant confirmation
      for (const [id, name, label] of [["pa-doc-aadhaar", "doc_aadhaar", "Aadhaar card"], ["pa-doc-pan", "doc_pan", "PAN card"], ["pa-doc-bank", "doc_bank", "bank proof"]]) if (!(f[name] && f[name].files[0])) e[id] = `Upload your ${label} (photo or PDF).`;
    }
    if (d.name.length < 2) e["pa-name"] = "Enter your name."; if (!isPhone(d.phone)) e["pa-phone"] = "Enter a valid 10-digit mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e["pa-email"] = d.email ? "Enter a valid email." : "Enter your email.";
    if (!d.pincodes || !d.pincodes.split(",").every(p => isPin(p.trim()))) e["pa-pins"] = "Enter 6-digit PIN codes separated by commas.";
    if (REST && f.querySelector("#pa-pins").dataset.bad === "1") e["pa-pins"] = "Some PIN codes were not found. Please correct them.";
    if (!setErr(f, e)) return;
    // Instant: confirm on screen right away, then do the slow parts (documents, saving, payment set-up) in the background.
    if (btn) btn.disabled = true;
    openModal(`<div style="text-align:center;display:grid;gap:10px;justify-items:center;padding:8px 0"><span class="avatar" style="width:56px;height:56px;font-size:24px;background:var(--ok)">✓</span>
      <h2 style="padding:0">Application received</h2><p class="muted">Thank you, ${esc(d.name)}. We are saving your details${d.type === "tip" ? " and preparing your registration payment" : ""}. You can keep this window open, it takes a moment.</p>
      <div class="sk-card" style="width:100%">${sk("w60", 14)}${sk("", 40)}</div></div>`);
    (async () => {
      try {
        if (REST) {
          const files = { aadhaar: f.doc_aadhaar && f.doc_aadhaar.files[0], pan: f.doc_pan && f.doc_pan.files[0], bank_proof: f.doc_bank && f.doc_bank.files[0] }, documents = {};
          const inputs = { aadhaar: f.doc_aadhaar, pan: f.doc_pan, bank_proof: f.doc_bank };
          try {
            // all three together, reusing the uploads that already started when the files were chosen
            await Promise.all(Object.entries(files).filter(([, file]) => file).map(async ([k, file]) => {
              const up = inputs[k] && inputs[k]._up;
              documents[k] = await (up && up.file === file ? up.promise : shrinkImage(file).then(x => API.uploadFile(x, "kyc")));
            }));
          } catch (err) { if (!/not configured/i.test(err.message || "")) throw err; /* local development without Cloudinary keys: continue without files */ }
          if (Object.keys(documents).length) d.documents = documents;
        }
        const r = await API.applyPartner(d);
        f.reset(); f.querySelectorAll("[data-up]").forEach(n => { n.textContent = ""; }); f.querySelectorAll("input[type=file]").forEach(i => { i._up = null; });
        if (r && r.charge && d.type === "tip") openAppFee(r.charge, d, r.existing);   // payment step is for a TIP only; a DSA never sees a payment window
        else openModal(`<div style="text-align:center;display:grid;gap:10px;justify-items:center;padding:8px 0"><span class="avatar" style="width:56px;height:56px;font-size:24px;background:var(--ok)">✓</span><h2 style="padding:0">Registration received</h2><p class="muted">Admin will verify your details and contact you on WhatsApp.</p><button class="btn btn-primary" data-act="close-modal" type="button">Done</button></div>`);
      } catch (err) {
        $("#modal").hidden = true; document.body.style.overflow = "";   // back to the form, nothing typed is lost
        toast(errMsg(err), true);
      } finally { if (btn) btn.disabled = false; }
    })();
  },
  request: async (f, btn) => {
    const d = { name: val(f, "name"), phone: val(f, "phone"), email: val(f, "email"), pincode: val(f, "pincode"), area: val(f, "area"), address: val(f, "address"), preferred_date: val(f, "preferred_date"), consent: val(f, "consent"), plan_id: f.dataset.plan || null, lat: f.dataset.lat ? Number(f.dataset.lat) : null, lng: f.dataset.lng ? Number(f.dataset.lng) : null, product: f.dataset.product || "broadband" }, e = {};
    if (d.product === "sim") {
      const conn = (f.querySelector("input[name=sim_conn]:checked") || {}).value || "new";
      d.sim = {
        connection: conn, type: f.dataset.simtype || "prepaid", for_whom: val(f, "for_whom"), port_number: conn === "port" ? val(f, "port_number") : null, current_operator: conn === "port" ? val(f, "current_operator") : null,
        number_preference: conn === "new" ? val(f, "number_preference") : null, delivery_slot: val(f, "delivery_slot"), kyc: (f.querySelector("input[name=kyc]:checked") || {}).value || "doorstep"
      };
      if (conn === "port" && !isPhone(d.sim.port_number || "")) e["sm-portno"] = "Enter the 10-digit number to port.";
      if (d.sim.number_preference && !/^\d{1,4}$/.test(d.sim.number_preference)) e["sm-pref"] = "Use up to 4 digits.";
      if (d.address.length < 5) e["rq-addr"] = "Enter the delivery address.";
    }
    if (d.name.length < 2) e["rq-name"] = "Enter your full name."; if (!isPhone(d.phone)) e["rq-phone"] = "Enter a valid 10-digit mobile number.";
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e["rq-email"] = "Enter a valid email.";
    if (!isPin(d.pincode)) e["rq-pin"] = "Enter a valid 6-digit PIN code."; if (d.plan_id && d.address.length < 5) e["rq-addr"] = "Enter your installation address.";
    if (d.preferred_date && d.preferred_date < todayISO()) e["rq-date"] = "Choose today or a future date."; if (!d.consent) e["rq-consent"] = "Please agree so a TIP can contact you.";
    if (!setErr(f, e)) return;
    if (!me()) { await guard(btn, () => API.sendOtp(d.phone, "customer")); S.pendingReq = d; openOtpStep(d.phone, "request"); return; }   // verify the number on WhatsApp first
    const r = await guard(btn, () => API.requestConnection(d));
    showRequestDone(r, d);
  },
  ticket: async (f, btn) => {
    const d = { type: val(f, "type"), booking_id: val(f, "booking_id"), category: val(f, "category"), description: val(f, "description") }, e = {};
    if (d.type === "complaint" && !d.booking_id) e["tk-booking"] = "Choose the connection for a complaint.";
    if (d.description.length < 5) e["tk-desc"] = "Describe the issue in a few words.";
    if (!setErr(f, e)) return;
    const ref = await guard(btn, () => API.raiseTicket(d)); closeModal(); toast("Submitted. Ticket " + ref + "."); render();
  },
  "lead-status": async (f, btn) => {
    const d = { status: val(f, "status"), next: val(f, "next"), note: val(f, "note") }, e = {};
    if (d.status === "follow_up" && !d.next) e["ls-next"] = "Choose a follow-up date.";
    if (d.next && d.next < todayISO()) e["ls-next"] = "Choose today or a future date.";
    if (d.status === "lost" && d.note.length < 3) e["ls-note"] = "Add the reason the lead was lost.";
    if (!setErr(f, e)) return;
    await guard(btn, () => API.updateLeadStatus(f.dataset.id, d.status, d.note, d.status === "follow_up" ? d.next : null)); closeModal(); toast("Lead updated to " + LEAD[d.status] + "."); render();
  },
  book: async (f, btn) => {
    const date = val(f, "date"); if (!setErr(f, !date || date < todayISO() ? { "bk-date": "Choose today or a future date." } : {})) return;
    const ref = await guard(btn, () => API.createBooking(f.dataset.id, date)); closeModal(); toast("Booking " + ref + " created."); render();
  },
  "booking-status": async (f, btn) => {
    const s = val(f, "status"), ref = val(f, "ref"), ont = val(f, "ont"), e = {};
    if (s === "installed" && !ref) e["bs-ref"] = "Enter the connection reference.";
    if (ont && !/^[A-Za-z0-9-]{6,32}$/.test(ont)) e["bs-ont"] = "Serial should be 6–32 letters or digits.";
    if (!setErr(f, e)) return;
    await guard(btn, () => API.updateBookingStatus(f.dataset.id, s, ref, ont)); closeModal(); toast(s === "installed" ? "Installed. Commissions created for approval." : "Booking updated to " + BOOK[s] + "."); render();
  },
  "modem-wifi": async (f, btn) => {
    const ssid = val(f, "ssid"), pw = f.elements.password.value, e = {};
    if (!ssid && !pw) e["mw-ssid"] = "Enter a new name, a new password, or both.";
    else if (ssid && ssid === f.dataset.old) e["mw-ssid"] = "This is the current Wi-Fi name.";
    else if (ssid && !/^[\x20-\x7E]{1,32}$/.test(ssid)) e["mw-ssid"] = "Up to 32 English letters, digits or symbols.";
    if (pw && (pw.length < 8 || pw.length > 63)) e["mw-pw"] = "8 to 63 characters.";
    if (!setErr(f, e)) return;
    const d = await guard(btn, () => API.deviceAction(f.dataset.id, "wifi", { ssid, password: pw }));
    closeModal(); const nm = ssid || (d && d.ssid) || "";
    if (await trackAction(f.dataset.id, "wifi", nm)) { toast("Wi-Fi change sent."); return; }
    toast("Wi-Fi change sent. It applies when the modem next checks in (about a minute). Then join " + (nm || "your Wi-Fi") + (pw ? " with the new password." : ".")); render();
  },
  acs: async (f, btn) => {
    const d = { mode: val(f, "mode"), url: val(f, "url"), key: f.elements.key ? f.elements.key.value.trim() : "", agreement: val(f, "agreement") }, e = {};
    if (d.mode === "partner" && !/^https?:\/\/\S+$/.test(d.url)) e["ac-url"] = "Enter the address, e.g. http://acs.partner.in:7557";
    if (d.mode && !d.agreement) e["ac-agree"] = "Get the written agreement from the TIP first.";
    if (!setErr(f, e)) return;
    await guard(btn, () => API.saveAcs(f.dataset.id, d)); closeModal(); toast("Gene setup saved."); render();
  },
  "ticket-status": async (f, btn) => { const s = val(f, "status"), n = val(f, "note"); if (!setErr(f, ["resolved", "closed"].includes(s) && n.length < 3 ? { "ts-note": "Tell the customer what was done." } : {})) return; await guard(btn, () => API.updateTicket(f.dataset.id, s, n)); closeModal(); toast("Ticket updated."); render(); },
  assign: async (f, btn) => {
    const kind = f.dataset.kind, who = val(f, kind);
    if (!setErr(f, !who ? { [kind === "tip" ? "as-tip" : "as-dsa"]: kind === "tip" ? "Choose a TIP (installer)." : "Choose a DSA." } : {})) return;
    await guard(btn, () => kind === "tip" ? API.assignLead(f.dataset.id, null, who) : API.assignLead(f.dataset.id, who, null));
    closeModal(); toast(kind === "tip" ? "TIP assigned." : "DSA assigned."); render();
  },
  partner: async (f, btn) => {
    const d = { id: f.dataset.id, type: val(f, "type"), name: val(f, "name"), firm: val(f, "firm"), phone: val(f, "phone"), email: val(f, "email"), commission_per_install: val(f, "commission_per_install"), service_pincodes: val(f, "service_pincodes"), kyc_verified: val(f, "kyc_verified"), lead_target: val(f, "lead_target"), address: val(f, "address"), pincode: val(f, "pincode") }, e = {};
    if (d.name.length < 2) e["pt-name"] = "Enter the name."; if (!isPhone(d.phone)) e["pt-phone"] = "Enter a valid 10-digit mobile."; if (!(Number(d.commission_per_install) >= 0)) e["pt-comm"] = "Enter 0 or more."; if (d.pincode && !isPin(d.pincode)) e["pt-pin"] = "Enter a valid 6-digit PIN code."; if (d.type === "dsa" && REST && String(d.service_pincodes || "").split(/[,\s]+/).filter(Boolean).some(x => !isPin(x))) e["pt-pins"] = "PIN codes must be 6 digits, separated by commas.";
    if (!setErr(f, e)) return; await guard(btn, () => API.savePartner(d)); closeModal(); toast("Saved."); render();
  },
  provider: async (f, btn) => { const d = { id: f.dataset.id, name: val(f, "name"), kind: val(f, "kind"), website: val(f, "website") }; if (!setErr(f, d.name.length < 2 ? { "pv-name": "Enter the provider name." } : {})) return; await guard(btn, () => API.saveProvider(d)); closeModal(); toast("Provider saved."); render(); },
  plan: async (f, btn) => { const d = planFormData(f); if (!setErr(f, planFormErrors(d))) return; await guard(btn, () => API.savePlan(d)); closeModal(); toast("Plan saved."); render(); },
  "tip-plan": async (f, btn) => {
    const d = planFormData(f); if (!setErr(f, planFormErrors(d))) return; const provs = await API.tipProviders();
    await guard(btn, () => API.tipSubmitPlans([planToRow(d, provs)])); closeModal(); toast("Sent to admin for review."); render();
  },
  "activate-sim": async (f, btn) => {
    const r = val(f, "reference"), e = {}; if (r.length < 3) e["as-ref"] = "Enter the activation reference."; if (!val(f, "kyc")) e["as-kyc"] = "Confirm KYC is complete.";
    if (!setErr(f, e)) return; await guard(btn, () => API.dsaActivateSim(f.dataset.id, r)); closeModal(); toast("Activated. Payout created for approval."); render();
  },
  "review-reject": async (f, btn) => { await guard(btn, () => API.adminReviewPlan(f.dataset.id, false, val(f, "note"))); closeModal(); toast("Submission rejected."); render(); },
  "add-city": async (f, btn) => { const d = { name: val(f, "name"), district: val(f, "district"), tier: val(f, "tier") }; if (!setErr(f, d.name.length < 2 ? { "ac-name": "Enter the city or town name." } : {})) return; await guard(btn, () => API.adminAddCity(d)); closeModal(); S.cities = null; toast(d.name + " added as launching soon."); render(); },
  "lead-edit": async (f, btn) => {
    const d = { name: val(f, "name"), phone: val(f, "phone"), email: val(f, "email"), pincode: val(f, "pincode"), address: val(f, "address"), notes: val(f, "notes") }, e = {};
    if (d.name.length < 2) e["le-name"] = "Enter the customer name."; if (!isPhone(d.phone)) e["le-phone"] = "Enter a valid 10-digit mobile."; if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e["le-email"] = "Enter a valid email.";
    if (!isPin(d.pincode)) e["le-pin"] = "Enter a valid 6-digit PIN code."; if (!setErr(f, e)) return;
    if (d.pincode === f.dataset.pin && f.elements.area_id) d.area_id = val(f, "area_id");   // a new PIN code drops the old area on the server
    await guard(btn, () => API.updateLead(f.dataset.id, d)); closeModal(); toast("Lead saved."); render();
  },
  "location-edit": async (f, btn) => { const area = val(f, "area"), e = {}; if (area.length < 2) e["el-area"] = "Enter the area name."; if (!setErr(f, e)) return; await guard(btn, () => API.updateLocation(f.dataset.id, area)); closeModal(); toast("Area renamed."); render(); },
  location: async (f, btn) => { const d = { pincode: val(f, "pincode"), area: val(f, "area"), zone: val(f, "zone"), city_id: val(f, "city_id") }, e = {}; if (!isPin(d.pincode)) e["lc-pin"] = "Enter a valid 6-digit PIN code."; if (d.area.length < 2) e["lc-area"] = "Enter the area."; if (!setErr(f, e)) return; await guard(btn, () => API.saveLocation(d)); closeModal(); toast("Location added."); render(); },
  coverage: async (f, btn) => { const d = { location_id: val(f, "location_id"), provider_id: val(f, "provider_id"), tip_partner_id: val(f, "tip_partner_id"), technology: val(f, "technology") }, e = {}; if (!d.location_id) e["cv-loc"] = "Choose the area."; if (!d.provider_id) e["cv-prov"] = "Choose the provider."; if (!setErr(f, e)) return; await guard(btn, () => API.saveCoverage(d)); closeModal(); toast("Coverage saved."); render(); },
  pay: async (f, btn) => { const ref = val(f, "reference"); if (!setErr(f, ref.length < 3 ? { "py-ref": "Enter the payment reference." } : {})) return; await guard(btn, () => API.recordPayment(f.dataset.id, f.dataset.ids.split(","), val(f, "method"), ref)); closeModal(); toast("Payment recorded."); render(); },
  "dsa-add": async (f, btn) => {
    const d = { name: val(f, "name"), phone: val(f, "phone"), pincode: val(f, "pincode"), area: val(f, "area"), address: val(f, "address"), plan_id: val(f, "plan_id"), consent: val(f, "consent") }, e = {};
    if (d.name.length < 2) e["dl-name"] = "Enter the customer's name."; if (!isPhone(d.phone)) e["dl-phone"] = "Enter a valid 10-digit mobile number."; if (!isPin(d.pincode)) e["dl-pin"] = "Enter a valid 6-digit PIN code."; if (!d.consent) e["dl-consent"] = "Customer consent is required.";
    if (!setErr(f, e)) return; const r = await guard(btn, () => API.dsaAddLead(d)); closeModal(); toast("Lead " + r.ref_code + " added" + (r.tip ? " · TIP: " + r.tip : "") + "."); S.dsaFilter = "open"; render();
  },
  "pay-charge": async (f, btn) => { const m = (f.querySelector("input[name=method]:checked") || {}).value || "upi"; btn.disabled = true; btn.textContent = "Processing payment…"; try { const c = await API.payCharge(f.dataset.id, m); paySuccess(c); } catch (e) { btn.disabled = false; btn.textContent = "Try again"; toast(errMsg(e), true); } },
  settings: async (f, btn) => {
    if (REST) {   // every fee is a row in app_settings
      const keys = [["registration_fee_tip", "st-tip"], ["tip_install_fee", "st-inst"], ["care_plan_fee_per_lead", "st-cp"], ["dsa_payout_per_lead", "st-pay"], ["tip_job_earning", "st-job"], ["lead_target_default", "st-target"], ["gst_percent", "st-gst"]], d = {}, e = {};
      keys.forEach(([k, id]) => { d[k] = val(f, k); const n = Number(d[k]); if (d[k] === "" || !(n >= 0) || (k === "gst_percent" && n > 100)) e[id] = k === "gst_percent" ? "Enter 0 to 100." : "Enter 0 or more."; });
      if (!setErr(f, e)) return; await guard(btn, () => API.saveSettings(d)); toast("Settings saved."); return;
    }
    const d = { registration_fee_tip: val(f, "registration_fee_tip"), gst_percent: val(f, "gst_percent"), lead_target_default: val(f, "lead_target_default"), tip_share_percent: val(f, "tip_share_percent") }, e = {};
    if (!(Number(d.lead_target_default) >= 0) || d.lead_target_default === "") e["st-target"] = "Enter 0 or more."; if (!(Number(d.tip_share_percent) >= 0 && Number(d.tip_share_percent) <= 100) || d.tip_share_percent === "") e["st-share"] = "Enter 0 to 100.";
    if (!(Number(d.registration_fee_tip) >= 0) || d.registration_fee_tip === "") e["st-tip"] = "Enter 0 or more."; if (!(Number(d.gst_percent) >= 0 && Number(d.gst_percent) <= 28)) e["st-gst"] = "Enter 0 to 28.";
    if (!setErr(f, e)) return; await guard(btn, () => API.saveSettings(d)); toast("Fees saved.");
  },
  "new-charge": async (f, btn) => {
    const d = { payer_type: val(f, "payer_type"), partner_id: val(f, "partner_id"), customer_id: val(f, "customer_id"), kind: val(f, "kind"), description: val(f, "description"), base: val(f, "base") }, e = {};
    if (d.payer_type === "partner" && !d.partner_id) e["nc-partner"] = "Choose the DSA or TIP."; if (d.payer_type === "customer" && !d.customer_id) e["nc-customer"] = "Choose the customer.";
    if (d.description.length < 3) e["nc-desc"] = "Add a description."; if (!(Number(d.base) > 0)) e["nc-amt"] = "Enter an amount.";
    if (!setErr(f, e)) return; await guard(btn, () => API.adminCreateCharge(d)); closeModal(); toast("Charge created and sent on WhatsApp."); render();
  },
  "charge-offline": async (f, btn) => { const r = val(f, "reference"); if (!setErr(f, r.length >= 3 ? {} : { "co-ref": "Enter the reference." })) return; await guard(btn, () => API.adminSetCharge(f.dataset.id, "paid_offline", r)); closeModal(); toast("Marked as paid."); render(); },
  "otp-send": async (f, btn) => {
    const phone = val(f, "phone"); if (!setErr(f, phoneError(phone) ? { "lg-phone": phoneError(phone) } : {})) return;
    try { await guard(btn, () => API.sendOtp(phone)); } catch (x) { setErr(f, { "lg-phone": errMsg(x) }); return; }
    openOtpStep(phone, f.dataset.purpose || "login");
  },
  "otp-verify": async (f, btn) => {
    const otp = val(f, "otp"); if (!setErr(f, /^\d{6}$/.test(otp) ? {} : { "lg-otp": "Enter the 6-digit OTP." })) return;
    const purpose = f.dataset.purpose, pend = S.pendingReq;
    let u;
    try { u = await guard(btn, () => API.verifyOtp(f.dataset.phone, otp, purpose === "request" && pend ? pend.name : "", purpose === "request" ? "customer" : undefined)); }
    catch (e) { setErr(f, { "lg-otp": errMsg(e) }); return; }
    clearInterval(otpTimer); try { localStorage.setItem("cb-session", u.id); } catch (e) { }
    renderHeader();
    if (purpose === "reset") { openSetPassword("reset"); return; }
    if (purpose === "request" && pend) { S.pendingReq = null; const r = await guard(null, () => API.requestConnection(pend)); showRequestDone(r, pend); return; }
    if (!u.full_name) { openModal(`<h2>Welcome to Connect Bhai</h2><p class="muted" style="margin:4px 0 14px">What should we call you?</p><form class="stack" data-form="set-name" novalidate>${field("nm-name", "Full name", `<input id="nm-name" name="name" autocomplete="name">`)}<button class="btn btn-primary" type="submit">Continue</button></form>`); return; }
    entering(true); closeModal(); toast("Welcome, " + (u.role === "customer" ? u.full_name.split(" ")[0] : u.full_name) + "."); go(ROLE_HOME[u.role]);
  },
  "set-name": async (f, btn) => { const n = val(f, "name"); if (!setErr(f, n.length >= 2 ? {} : { "nm-name": "Enter your name." })) return; const u = await guard(btn, () => API.setMyName(n)); entering(true); closeModal(); toast("Welcome, " + n.split(" ")[0] + "."); go(ROLE_HOME[u.role]); }
};
const onSubmit = e => {
  const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault();
  const fn = forms[f.dataset.form]; if (fn) track(fn(f, f.querySelector('[type="submit"]'))).catch(() => { });
};


/* ---------- bridge for the React speed-test page (components/speed/SpeedTest.jsx) ---------- */
export const speedBridge = {
  user: () => { const u = me(); return u ? { role: u.role, full_name: u.full_name } : null; },
  async connections() {
    const u = me(); if (!u || u.role !== "customer") return [];
    try { return (await API.myBookings()).filter(b => b.status === "installed").map(b => ({ id: b.id, label: b.plan ? b.plan.provider.name + " · " + b.plan.name + " (" + b.plan.speed_mbps + " Mbps)" : b.ref_code })); } catch (e) { return []; }
  },
  async save(connId, r) { await API.recordSpeedTest(connId || null, r); },
  toast: (m, bad) => toast(m, bad),
  errMsg,
  report(r, connId) {
    const u = me(); if (!u) return openLogin(); if (u.role !== "customer") { toast("Only customers can raise complaints."); return; }
    const f = (v, d) => (v == null || isNaN(v)) ? "–" : Number(v).toFixed(d == null ? 1 : d);
    openTicketModal({ booking_id: connId || "", description: `Wi-Fi speed test on ${fdt(new Date())}: ${f(r.down)} Mbps download, ${f(r.up)} Mbps upload, ${f(r.ping, 0)} ms ping. Speed feels slow.` });
  },
};

/* ---------- boot ---------- */
let resolveReady; const ready = new Promise(r => { resolveReady = r; });
let booted = false;

async function bootData() {
  if (LIVE) { try { await API.init(); } catch (e) { toast("Could not connect to the server.", true); } }
  else { loadDemo(); migrateCities(); let sid = null; try { sid = localStorage.getItem("cb-session"); } catch (e) { } if (sid) await API.restore(sid); }
  renderHeader(); updateCompareBar(); publish({ ready: true });
  resolveReady();
}

/* QA point 6: every row of an older (string-built) admin table gets a "View" button. Rows that already open a detail
   (leads "Open") are left alone. Runs after each render and each server-table fill (MutationObserver), idempotent. */
const VIEW_BTN = `<button class="btn btn-ghost btn-sm" data-act="row-view" type="button">View</button>`;
function addRowViews() {
  if (S.view !== "admin") return;
  app.querySelectorAll("table").forEach(t => {
    const hr = t.querySelector("thead tr"); if (!hr || t.closest("[data-react]")) return;
    let added = false;
    t.querySelectorAll("tbody tr").forEach(tr => {
      if (tr.cells.length < 2 || tr.querySelector("[data-act=row-view], [data-act=lead], .empty")) return;
      const last = tr.cells[tr.cells.length - 1], box = last.querySelector(".row");
      if (last.querySelector("button")) (box || last).insertAdjacentHTML("afterbegin", VIEW_BTN);
      else { tr.insertAdjacentHTML("beforeend", `<td class="row-acts">${VIEW_BTN}</td>`); added = true; }
    });
    if (added && !hr.querySelector(".row-acts")) hr.insertAdjacentHTML("beforeend", `<th class="row-acts">Actions</th>`);
  });
}
let rowViewObs = null;
/* A field turns red only while its error stands: typing, choosing or uploading clears the red border and the message for that field. */
const clearBad = e => { const f = e.target && e.target.closest && e.target.closest(".field.bad"); if (!f) return; f.classList.remove("bad"); const er = f.querySelector(".ferr"); if (er) er.textContent = ""; };

/* QA points 5, 7, 9: live data without refreshing the page. Every 30 s while the tab is visible, and at once when the user
   comes back to it, a quiet "cb:poll" reloads the React pages, the sidebar badges and the paged tables (what is on screen
   stays until the new data arrives). Older views reload their server tables only, and never while a modal is open or the
   user is typing, so nothing they are entering is lost. */
const POLL_MS = 30_000;
let pollT = null, hiddenAt = 0;
function poll() {
  if (document.hidden || !me()) return;
  window.dispatchEvent(new CustomEvent("cb:poll"));
  const a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  if ($("#modal").hidden && !typing) fillServerTables();
}
const onVisibility = () => { if (document.hidden) hiddenAt = Date.now(); else if (Date.now() - hiddenAt > 5000) poll(); };

/* Wires the document-level delegation and boots the data layer. Returns a cleanup function (React StrictMode safe). */
export function init({ navigate: nav }) {
  navigate = nav;
  app = document.getElementById("app");
  $("#modal").addEventListener("click", onModalClick);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("input", clearBad); document.addEventListener("change", clearBad);
  document.addEventListener("paste", onPaste);
  document.addEventListener("focusout", pinSuggestBlur);
  document.addEventListener("visibilitychange", onVisibility);
  rowViewObs = new MutationObserver(() => addRowViews()); rowViewObs.observe(app, { childList: true, subtree: true });
  clearInterval(pollT); pollT = setInterval(poll, POLL_MS);
  document.addEventListener("change", onChange);
  document.addEventListener("submit", onSubmit);
  initServerTables(API);
  if (!booted) { booted = true; bootData(); }
  return () => {
    $("#modal")?.removeEventListener("click", onModalClick);
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("click", onClick);
    document.removeEventListener("focusout", pinSuggestBlur);
    document.removeEventListener("visibilitychange", onVisibility); clearInterval(pollT); if (rowViewObs) rowViewObs.disconnect();
    document.removeEventListener("input", onInput); document.removeEventListener("paste", onPaste);
    document.removeEventListener("input", clearBad); document.removeEventListener("change", clearBad);
    document.removeEventListener("change", onChange);
    document.removeEventListener("submit", onSubmit);
  };
}
export { show };



