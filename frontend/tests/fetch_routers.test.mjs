// Admin Care plan: "Fetch routers" with a Genie tab and a Zabbix tab.  Run from frontend/:  node --test tests/fetch_routers.test.mjs
// The page is a React component, so these tests read its source; the screen itself is checked in the browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/components/careplan/CarePlan.jsx", import.meta.url), "utf8");

test("the button no longer says Genie", () => {
  assert.match(src, /"Fetching…" : "Fetch routers"/);
  assert.doesNotMatch(src, /Fetch from Genie/);
});

test("there are two tabs, Genie and Zabbix", () => {
  assert.match(src, /role="tablist"/);
  assert.match(src, /\["genie", "Genie", genie\.length\], \["zabbix", "Zabbix", zbx\.length\]/);
});

test("the Zabbix columns start with OLT, zone and serial number, with no power or router buttons", () => {
  const cols = JSON.parse(src.match(/const ZBX_COLS = (\[.*?\]);/)[1]);
  assert.deepEqual(cols, ["OLT", "Zone", "Serial number", "ONT name", "Status", "Last read", "Customer", "Care plan", "Linked"]);
  const table = src.slice(src.indexOf('aria-label="ONUs in Zabbix"'), src.indexOf('aria-label="Modems in Genie"'));
  const cells = [...table.matchAll(/data-l="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(cells, cols.slice(0, 6));   // then the three shared cells, in the same order
  assert.match(table, /\{custCell\(d, "Customer"\)\}\{careCell\(d\)\}\{linkCell\(d\)\}/);
  assert.doesNotMatch(table, /rx_power|DeviceActs|Restart|Wi-Fi/);
});

test("both tabs link customers the same way; an ONU without a serial cannot be linked", () => {
  assert.equal(src.split("{careCell(d)}{linkCell(d)}").length - 1, 2);
  assert.match(src, /d\.source === "zabbix" && !d\.serial \? <Chip label="No serial"/);
});

test("switching tabs removes the old tab's search bar and pager", () => {
  // tableTools.js adds them next to the table, outside React: only replacing the surrounding box takes them away
  assert.match(src, /<div key=\{`\$\{source\}-\$\{\(source === "zabbix" \? zbx : genie\)\.length > 0\}`\}>\{source === "zabbix" \?/);
});

test("on phones the Genie customer cell has no extra label, as before the tabs", () => {
  const genie = src.slice(src.indexOf('aria-label="Modems in Genie"'), src.indexOf('role === "admin" && linkFor'));
  assert.match(genie, /\{custCell\(d\)\}/);
  assert.doesNotMatch(src, /className="pt-name" data-l="Customer"/);
});
