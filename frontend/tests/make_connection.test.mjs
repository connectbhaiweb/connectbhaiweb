// "Make connection" button in the DSA and admin lead tables.  Run from frontend/:  node --test tests/make_connection.test.mjs
// ui.js needs a browser to load, so the two table templates are cut out of its source and rendered here with stand-in helpers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const URL_ = "https://wsc.cdr.bsnl.co.in/portal/";
const src = readFileSync(new URL("../src/lib/connectbhai/ui.js", import.meta.url), "utf8");

function cut(from, to, after = 0) {
  const a = src.indexOf(from, after), b = src.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `ui.js no longer contains: ${from}`);
  return src.slice(a, b);
}

const helpers = {
  REST: true, todayISO: () => "2026-11-25", esc: v => String(v ?? ""), fdate: v => String(v), fmtPh: v => String(v),
  contactBtns: () => "", leadPill: s => `<i>${s}</i>`, productChip: () => "", pill: t => `<i>${t}</i>`, pinName: () => "",
};

const buttonDef = cut("const MAKE_CONNECTION_BTN", "\nfunction dsaLeadsTable");
const dsaDef = cut("function dsaLeadsTable", "\nfunction commissionList");
const adminStart = src.indexOf('serverTable("adm-leads"');
const adminDef = cut("html: rows => ", "\n    })}`;", adminStart).replace("html: ", "");

const context = vm.createContext({ ...helpers });
const { dsa, admin } = vm.runInContext(`${buttonDef}\n${dsaDef}\n({ dsa: dsaLeadsTable, admin: ${adminDef} })`, context);

const STATUSES = ["new", "assigned", "contacted", "follow_up", "booked", "installed", "lost"];
const person = { name: "Test Partner" };
const lead = (status, extra = {}, i = 0) => ({
  id: String(i + 1), ref_code: "CB-" + (i + 1), created_at: "2026-11-01", name: "Test Customer", phone: "9000000000", pincode: "452010",
  status, product: "broadband", plan: null, dsa: person, tip: null, next_follow_up: null, ...extra,
});
const rows = STATUSES.map((s, i) => lead(s, {}, i));

const bodyRows = html => html.split("<tbody>")[1].split("</tbody>")[0].split("</tr>").filter(r => r.includes("<tr"));
const links = html => html.match(/<a\b[^>]*>Make connection<\/a>/g) || [];

for (const [name, table] of [["DSA", dsa], ["Admin", admin]]) {
  test(`${name} table: every row has one button, whatever the status`, () => {
    const out = bodyRows(table(rows));
    assert.equal(out.length, STATUSES.length);
    out.forEach((r, i) => assert.equal(links(r).length, 1, `status "${STATUSES[i]}"`));
  });

  test(`${name} table: button is also there with no DSA, with a TIP, and for SIM / OTT leads`, () => {
    const out = bodyRows(table([
      lead("new", { dsa: null }), lead("booked", { tip: person, booking: { id: "9", status: "scheduled" } }),
      lead("assigned", { product: "sim" }), lead("assigned", { product: "ott" }),
    ]));
    out.forEach(r => assert.equal(links(r).length, 1));
  });

  test(`${name} table: button opens the portal in a new tab and does not touch the lead`, () => {
    const [a] = links(table([lead("assigned")]));
    assert.match(a, new RegExp(`href="${URL_.replaceAll(".", "\\.")}"`));
    assert.match(a, /target="_blank"/);
    assert.match(a, /rel="noopener"/);
    assert.doesNotMatch(a, /data-act|data-go|data-tab|data-id/);   // the app's click handler must leave it alone
  });

  test(`${name} table: button sits in the last column`, () => {
    const [row] = bodyRows(table([lead("assigned")]));
    assert.ok(row.slice(row.lastIndexOf("<td")).includes("Make connection"));
  });
}

test("DSA table: existing buttons are unchanged", () => {
  const html = dsa([lead("assigned")]) + dsa([lead("booked")]) + dsa([lead("assigned", { product: "sim" })]);
  for (const label of ["Update", "Schedule booking", "Assign TIP", "Mark SIM activated"]) assert.ok(html.includes(`>${label}</button>`), label);
});

test("Admin table: existing buttons are unchanged", () => {
  const html = admin([lead("new", { dsa: null }), lead("assigned"), lead("booked", { tip: person, booking: { id: "9", status: "scheduled" } }), lead("installed")]);
  for (const label of ["Assign DSA", "Reassign DSA", "Change TIP", "Open", "Edit", "Delete", "Schedule booking", "Install", "Buy Care plan"])
    assert.ok(html.includes(`>${label}</button>`), label);
});

test("button is used only in those two tables", () => {
  assert.equal(src.split(URL_).length - 1, 1, "portal address appears once");
  assert.equal(src.split("MAKE_CONNECTION_BTN").length - 1, 3, "one definition and two uses");
});

test("button has a Hindi label", async () => {
  const { EXTRA } = await import("../src/lib/i18n/hi-extra.js");
  assert.equal(EXTRA["Make connection"], "कनेक्शन बनाएं");
});
