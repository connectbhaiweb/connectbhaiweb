// Zabbix ONUs show Online / Offline only, with no router buttons.  Run from frontend/:  node --test tests/zabbix_onu.test.mjs
// ui.js needs a browser to load, so the router card code is cut out of its source and rendered here with stand-in helpers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const src = read("../src/lib/connectbhai/ui.js");
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); assert.ok(a >= 0 && b > a, `ui.js no longer contains: ${from}`); return src.slice(a, b); };

let user = { role: "customer" };
const context = vm.createContext({
  me: () => user, esc: v => String(v ?? ""), planLine: () => "Plan", pill: t => `<i>${t}</i>`, fdate: v => String(v), fdt: v => String(v),
  RX: () => null, rxPill: () => "", upTxt: () => "", acsName: () => "Genie",
});
const { routerCard, deviceView } = vm.runInContext(`${cut("function deviceView(d)", "\nconst stLine")}\n${cut("/* An ONU read from Zabbix", "\nfunction routerZones")}\n({ routerCard, deviceView })`, context);

const onu = (state, extra = {}) => ({ id: "5", ref_code: "BK-5", ont_serial: "GPON1", installed_at: "2026-11-01", lead: { name: "Asha", phone: "9000000000" }, device: { status_only: true, state, serial: "GPON1", acs: "connectbhai", active: true, ...extra } });
const acts = html => [...html.matchAll(/data-act="([a-z-]+)"/g)].map(m => m[1]);

test("the status is Online, Offline or unavailable, with no Genie label", () => {
  assert.equal(deviceView(onu("online").device), "<i>Online</i>");
  assert.equal(deviceView(onu("offline").device), "<i>Offline</i>");
  assert.equal(deviceView(onu("unknown").device), "<i>Status unavailable</i>");
});

test("router card: only Refresh for any role, with no router commands, speed test or modem history", () => {
  for (const role of ["customer", "tip", "admin"]) {
    user = { role };
    for (const state of ["online", "unknown"]) {
      const html = routerCard(onu(state), role !== "customer");
      assert.deepEqual(acts(html), ["refresh-device"], `${role} ${state}`);
      assert.doesNotMatch(html, /data-go|data-hist|data-acts|Genie|speed/i);
      assert.match(html, /GPON1/);
    }
  }
});

test("only a customer with an offline ONU can raise a complaint", () => {
  user = { role: "customer" };
  assert.deepEqual(acts(routerCard(onu("offline"), false)), ["refresh-device", "offline-complaint"]);
  user = { role: "admin" };
  assert.deepEqual(acts(routerCard(onu("offline"), true)), ["refresh-device"]);
});

test("a GenieACS modem keeps its buttons", () => {
  user = { role: "customer" };
  const html = routerCard(onu("online", { status_only: false }), false);
  assert.deepEqual(acts(html), ["refresh-device", "modem-reboot", "modem-wifi", "router-test"]);
});

test("the other screens hide the buttons for a Zabbix ONU", () => {
  assert.match(src, /b\.device && b\.device\.status_only \? "" : `<button class="btn btn-ghost btn-sm" data-act="refresh-device"/);
  assert.match(read("../src/components/customer/CustomerDashboard.jsx"), /d\.status_only\) return/);
  assert.match(read("../src/components/careplan/CarePlan.jsx"), /list\.map\(d => d\.statusOnly \?/);
});

test("linking a Zabbix ONU saves only its serial number", () => {
  assert.match(read("../src/lib/connectbhai/rest.js"), /acsDevice\.source === "zabbix" \? \{ serial_number: acsDevice\.serial \}/);
});

test("the Devices table and customer cards offer Refresh for a Zabbix ONU", () => {
  const page = read("../src/components/careplan/CarePlan.jsx");
  assert.equal(page.split("<ZbxRefresh id={d.id}").length - 1, 2);   // customer Care plan card and the admin / TIP table
  assert.match(read("../src/components/customer/CustomerDashboard.jsx"), /<ZbxRefresh id=\{d\.id\}/);
  const button = page.slice(page.indexOf("export function ZbxRefresh"), page.indexOf("async function loadDevices"));
  assert.match(button, /API\.deviceRefresh\(id\)/);
  assert.doesNotMatch(button, /deviceActById|deviceAction|reboot|wifi/i);
});

test("GenieACS modems keep their own actions in the Devices table", () => {
  assert.match(read("../src/components/careplan/CarePlan.jsx"), /<DeviceActs d=\{d\} onDone=\{reload\} \/>/);
});

test("Last seen of a Zabbix ONU comes from the API, as for Genie modems, with the Indian date and time", () => {
  const page = read("../src/components/careplan/CarePlan.jsx");
  assert.match(page, /<span role="cell" data-l="Last seen">\{ago\(d\.lastInform\)\}\{d\.lastInform && <small className="cp-sn cp-when">\{readAt\(d\.lastInform\)\}<\/small>\}<\/span>/);
  const readAt = vm.runInNewContext(`${page.match(/const readAt = .*;/)[0]} readAt`);
  assert.match(readAt("2026-11-25T11:32:49.000Z"), /25 Nov.*0?5:02\s?pm/i);   // 11:32 UTC is 17:02 in India
  assert.equal(readAt(null), "—");
});

test("in the Devices table the Zabbix Refresh is the same small button as on a Genie row", () => {
  const page = read("../src/components/careplan/CarePlan.jsx");
  assert.match(page, /<ZbxRefresh id=\{d\.id\} onDone=\{reload\} small \/>/);
  assert.match(page, /\{small \? <span className="cp-btns"><ActBtn Icon=\{RefreshCw\} label="Refresh" off=\{busy\} onClick=\{run\} \/><\/span>/);
  assert.match(page, /<ActBtn Icon=\{RefreshCw\} label="Refresh" off=\{!linked\}/);   // the Genie one
});

test("the small text in the Care plan tables uses the page font, and the time stays on one line", () => {
  const css = read("../src/app/portal.css");
  assert.doesNotMatch(css.match(/^\.cp-sn\{[^}]*\}/m)[0], /font-family/);
  assert.match(css, /\.cp-sn\.cp-when\{white-space:nowrap\}/);
});
