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

test("router card: no router buttons for any role, and no speed or modem history", () => {
  for (const role of ["customer", "tip", "admin"]) {
    user = { role };
    for (const state of ["online", "unknown"]) {
      const html = routerCard(onu(state), role !== "customer");
      assert.deepEqual(acts(html), [], `${role} ${state}`);
      assert.doesNotMatch(html, /data-go|data-hist|data-acts|Genie|speed/i);
      assert.match(html, /GPON1/);
    }
  }
});

test("only a customer with an offline ONU can raise a complaint", () => {
  user = { role: "customer" };
  assert.deepEqual(acts(routerCard(onu("offline"), false)), ["offline-complaint"]);
  user = { role: "admin" };
  assert.deepEqual(acts(routerCard(onu("offline"), true)), []);
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
