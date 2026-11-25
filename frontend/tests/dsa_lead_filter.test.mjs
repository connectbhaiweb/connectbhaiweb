// DSA > Leads: "All" is the first filter and is selected when the page opens.  Run from frontend/:  node --test tests/dsa_lead_filter.test.mjs
// ui.js needs a browser to load, so these tests read its source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/connectbhai/ui.js", import.meta.url), "utf8");

test("All is first, and the other filters keep their order", () => {
  const list = src.match(/\$\{(\[\["all", "All"\].*?\])\.map\(\(\[k, l\]\) => `<button type="button" class="chip" data-act="dsa-filter"/);
  assert.ok(list, "the DSA filter list starts with All");
  assert.deepEqual(JSON.parse(list[1]).map(x => x[1]), ["All", "Open", "Follow-up due", "New to call", "Contacted", "Booked", "Installed", "Lost"]);
});

test("All is preselected, for both the highlighted chip and the rows", () => {
  assert.match(src, /const filt = S\.dsaFilter \|\| "all";/);
  assert.match(src, /filters: \(\) => \(\{ status: S\.dsaFilter \|\| "all" \}\), label: "Search leads", html: dsaLeadsTable/);
  assert.doesNotMatch(src, /S\.dsaFilter \|\| "open"|S\.dsaFilter = "open"/);
});
