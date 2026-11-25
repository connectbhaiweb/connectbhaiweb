// "Recommended" mark on BSNL plans: card ribbon and Compare order.  Run from frontend/:  node --test tests/recommended_plan.test.mjs
// ui.js needs a browser to load, so the plan card and compare code are cut out of its source and run here with stand-in helpers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../src/lib/connectbhai/ui.js", import.meta.url), "utf8");
const a = src.indexOf("const isRecommended"), b = src.indexOf("\nconst planSummary", a);
assert.ok(a >= 0 && b > a, "ui.js no longer contains the plan card / compare code");

let modal = "", toasts = [];
const S = { compare: [], results: [], pin: "452001" };
const context = vm.createContext({
  S, CATS: {}, esc: v => String(v ?? ""), inr: v => "Rs " + v, demoBadge: () => "", plogo: () => "", priceUnit: () => "/month", planBig: () => "",
  planFacts: () => "", ctaFor: () => "Request connection", isSpeedCat: () => true, dataTxt: () => "Unlimited", publish: () => {},
  toast: t => toasts.push(t), openModal: h => { modal = h; },
});
const { isRecommended, planCard, openCompare } = vm.runInContext(`${src.slice(a, b)}\n({ isRecommended, planCard, openCompare })`, context);

const plan = (id, brand, extra = {}) => ({ id, name: `Plan ${id}`, category: "fiber", provider: { name: brand, brand }, speed_mbps: 50, price_monthly: 500, ott_apps: [], tv_channels: 0, ...extra });
const jio = plan("1", "Jio"), bsnl = plan("2", "BSNL"), airtel = plan("3", "Airtel"), bsnl2 = plan("4", "BSNL");

function compare(...picked) {
  S.results = [jio, bsnl, airtel, bsnl2]; S.compare = picked.map(p => p.id); modal = ""; toasts = [];
  openCompare();
  const head = [...modal.split("</thead>")[0].matchAll(/<th>(Plan \d+)<\/th>/g)].map(m => m[1]);
  const cells = label => [...modal.split(`>${label}</td>`)[1].split("</tr>")[0].matchAll(/<td>(.*?)<\/td>/g)].map(m => m[1]);
  const choose = [...modal.matchAll(/data-plan="(\d+)"/g)].map(m => m[1]);
  return { head, cells, choose };
}

test("only BSNL is recommended, including its Air Fiber / TV / OTT names", () => {
  for (const name of ["BSNL", "bsnl", "BSNL · Air Fiber", "BSNL · TV", "BSNL · OTT"]) assert.ok(isRecommended({ provider: { name } }), name);
  for (const name of ["Jio", "Airtel", "Standalone · OTT", ""]) assert.ok(!isRecommended({ provider: { name } }), name);
  assert.ok(!isRecommended({}));
});

test("BSNL card has one ribbon, other cards have none", () => {
  S.compare = [];
  assert.equal(planCard(bsnl).split("Recommended").length - 1, 1);
  assert.match(planCard(bsnl), /<span class="rec-tag">Recommended<\/span>/);
  for (const p of [jio, airtel]) assert.doesNotMatch(planCard(p), /Recommended|rec-tag/);
});

test("the mark is blue and the BSNL card has the same border as the others", () => {
  assert.match(planCard(bsnl), /<article class="plan ">/);
  const css = readFileSync(new URL("../src/app/recommended.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /border(?!-radius)|--ok|\.plan/);
  assert.match(css, /\.rec-tag\{[^}]*background:var\(--blue\)/);
  assert.match(css, /\.rec-pill\{[^}]*color:var\(--blue\)/);
});

test("card keeps its compare tick and request button", () => {
  S.compare = [bsnl.id];
  const html = planCard(bsnl);
  assert.match(html, /<article class="plan sel">/);
  assert.match(html, /data-act="toggle-compare" data-id="2" checked/);
  assert.match(html, /data-act="request" data-plan="2"/);
});

test("results order is left to the customer's sort", () => {
  const filtered = src.slice(src.indexOf("function filtered()"), src.indexOf("function renderResults()"));
  assert.doesNotMatch(filtered, /isRecommended/);
});

test("compare: BSNL picked last still comes first, in every row and button", () => {
  const { head, cells, choose } = compare(jio, airtel, bsnl);
  assert.deepEqual(head, ["Plan 2", "Plan 1", "Plan 3"]);
  assert.deepEqual(choose, ["2", "1", "3"]);
  assert.match(cells("Provider")[0], /^BSNL <span class="rec-pill">Recommended<\/span>$/);
  assert.deepEqual(cells("Provider").slice(1), ["Jio", "Airtel"]);
});

test("compare: several BSNL plans come first in the order picked", () => {
  assert.deepEqual(compare(bsnl2, jio, bsnl).head, ["Plan 4", "Plan 2", "Plan 1"]);
});

test("compare: without BSNL the picked order stays and nothing is marked", () => {
  assert.deepEqual(compare(airtel, jio).head, ["Plan 3", "Plan 1"]);
  assert.doesNotMatch(modal, /Recommended/);
});

test("compare: the customer's picked list is not reordered, and two plans are still needed", () => {
  compare(jio, bsnl);
  assert.deepEqual([...S.compare], ["1", "2"]);
  compare(bsnl);
  assert.equal(modal, "");
  assert.equal(toasts.length, 1);
});

test("the mark has a Hindi label and its style is loaded", async () => {
  const { EXTRA } = await import("../src/lib/i18n/hi-extra.js");
  assert.ok(EXTRA.Recommended);
  assert.match(readFileSync(new URL("../src/app/layout.js", import.meta.url), "utf8"), /import "\.\/recommended\.css";/);
});
