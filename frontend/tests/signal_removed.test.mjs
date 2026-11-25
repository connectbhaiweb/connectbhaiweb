// The Care plan page has no Signal column or line.  Run from frontend/:  node --test tests/signal_removed.test.mjs
// The page is a React component, so these tests read its source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const src = read("../src/components/careplan/CarePlan.jsx");
const headers = label => JSON.parse(src.slice(src.indexOf(`aria-label="${label}"`)).match(/\{(\["Customer".*?\])\.map/)[1]);

test("no Signal anywhere on the page", () => assert.doesNotMatch(src, /"Signal"|No signal|d\.signal/));

test("the Devices table and the Genie tab have 9 columns each, and the grid matches", () => {
  assert.deepEqual(headers("Devices"), ["Customer", "Status", "Wi-Fi speed", "Last seen", "Model", "SSID", "Devices", "Uptime", "Actions"]);
  assert.deepEqual(headers("Modems in Genie"), ["Customer", "Status", "IP", "Last seen", "Model", "SSID", "Firmware", "Care plan", "Linked"]);
  const grid = [...read("../src/app/portal.css").matchAll(/^\.cp-table \.pt-tr\{grid-template-columns:([^;}]+)/gm)].at(-1)[1];
  assert.equal(grid.trim().split(/\s+/).length, 9);
});

test("each row has as many cells as its header", () => {
  const between = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
  const genieRow = between('<div className="pt-tr" role="row" key={d.id}>\n                      {custCell(d)}', "</div>");
  assert.equal((genieRow.match(/role="cell"/g) || []).length + (genieRow.match(/\{(cust|care|link)Cell\(d\)\}/g) || []).length, 9);
});
