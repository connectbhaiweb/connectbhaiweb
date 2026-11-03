"""Steps 3-5: DSA, TIP and Admin dashboards. python3 tests/roles_check.py [base_url]  (needs Playwright + Chromium)"""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
EXE = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
R = []
def check(n, ok, info=""): R.append(bool(ok)); print(("PASS " if ok else "FAIL ") + n + (f"  [{info}]" if info and not ok else ""))
USERS = {"dsa": ("u-dsa", "dsa"), "tip": ("u-tip", "tip"), "admin": ("u-admin", "admin")}

def open_page(b, role, path="", w=1440, h=900):
    uid, base = USERS[role]
    c = b.new_context(viewport={"width": w, "height": h}); c.add_init_script(f"localStorage.setItem('cb-session','{uid}')")
    pg = c.new_page(); pg.on("dialog", lambda d: d.accept()); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"{BASE}/{base}{path}"); pg.wait_for_function(f"document.documentElement.dataset.shell === '{role}'", timeout=15000)
    return c, pg, errs
def modal(pg, sel="", t=5000): pg.wait_for_selector(f"#modal:not([hidden]) {sel}".strip(), timeout=t); return True
def close(pg): pg.keyboard.press("Escape"); pg.wait_for_timeout(150)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)

    # ---- every sidebar item opens a real page (no fallback to Home) ----
    for role in USERS:
        c, pg, errs = open_page(b, role)
        tabs = [h.split("/")[-1] for h in pg.eval_on_selector_all(".dsh-side .dsh-item", "els=>els.map(e=>e.getAttribute('href'))")]
        home = None; bad = []
        for t in tabs:
            pg.goto(f"{BASE}/{USERS[role][1]}/{t}"); pg.wait_for_timeout(700)
            html = pg.evaluate("(document.querySelector('.dsh-page .pt')||document.getElementById('app')).innerText.slice(0,400)")
            if not html.strip(): bad.append(t + ":empty")
            if home is None: home = html
            elif html == home: bad.append(t + ":same as home")
        check(f"R1 {role}: all {len(tabs)} sidebar pages open their own content", not bad and not errs, ", ".join(bad) + " ".join(errs[:1]))
        c.close()

    # ---- DSA ----
    c, pg, errs = open_page(b, "dsa"); pg.wait_for_selector(".pt-kpi")
    check("D1 DSA home: 4 KPIs, chart, 7 pipeline tiles, calls table, commission tiles", pg.locator(".pt-kpi").count() == 4 and pg.locator(".recharts-bar-rectangle").count() > 0 and pg.locator(".pt-pipe li").count() == 7 and pg.locator(".pt-tiles>div").count() == 3)
    n6 = pg.locator(".recharts-xAxis .recharts-cartesian-axis-tick").count()
    pg.select_option(".pt-period select", "3"); pg.wait_for_timeout(300)
    check("D2 'Last 6 months' dropdown changes the chart", n6 == 6 and pg.locator(".recharts-xAxis .recharts-cartesian-axis-tick").count() == 3)
    hrefs = pg.eval_on_selector_all(".pt-t-calls .pt-ibtn", "els=>els.map(a=>a.getAttribute('href'))")
    check("D3 call / WhatsApp buttons are tel: and wa.me links", hrefs and all(h.startswith(("tel:+91", "https://wa.me/91")) for h in hrefs), hrefs[:2])
    pg.locator(".pt-pipe a").first.click(); pg.wait_for_url("**/dsa/leads")
    check("D4 pipeline tiles open Leads", True)
    pg.goto(f"{BASE}/dsa/customers"); pg.wait_for_selector(".pt-t-cust .pt-tr:not(.pt-th)")
    check("D5 My customers lists installed customers with commission", pg.locator(".pt-t-cust .pt-tr:not(.pt-th)").count() >= 1 and "₹" in pg.locator(".pt-t-cust").inner_text())
    pg.goto(f"{BASE}/dsa/tickets"); pg.wait_for_selector(".pt-threads button")
    pg.locator(".pt-threads button").first.click()
    check("D6 Tickets opens the conversation", modal(pg, "[data-convo], .msgs")); close(pg)
    pg.locator(".dsh-acct-btn").click(); pg.get_by_role("menuitem", name="Fees to Connect Bhai").click(); pg.wait_for_url("**/dsa/payments"); pg.wait_for_timeout(500)
    check("D7 Fees to Connect Bhai: opens from the account menu, Commission marked active", pg.locator(".dsh-side [aria-current=page]").inner_text().strip() == "Commission" and pg.locator("#app").inner_text().strip() != "")
    pg.goto(f"{BASE}/dsa"); pg.wait_for_selector(".pt-kpi"); inp = pg.locator(".dsh-search input"); inp.fill("arjun"); pg.wait_for_selector(".dsh-results li")
    check("D8 search finds a lead by name", "Arjun" in pg.locator(".dsh-results").inner_text())
    check("D9 no page errors", not errs, errs[:1]); c.close()

    # ---- TIP ----
    c, pg, errs = open_page(b, "tip"); pg.wait_for_selector(".pt-kpi")
    check("T1 TIP home: 4 KPIs, chart, plan sheet, installs, tickets", pg.locator(".pt-kpi").count() == 4 and pg.locator(".recharts-bar-rectangle").count() > 0 and pg.locator(".pt-drop").count() == 1 and pg.locator(".pt-tickets li").count() >= 1)
    pg.locator(".pt-drop").click()
    check("T2 Upload plan sheet opens the file import", modal(pg, "input[type=file]")); close(pg)
    with pg.expect_download(timeout=5000) as d: pg.locator("[data-act=plan-template]").click()
    check("T3 Download template gives a file", d.value.suggested_filename != "")
    pg.locator(".pt-t-inst .pt-chipbtn").first.click()
    check("T4 installation status opens the update form", modal(pg)); close(pg)
    pg.locator(".pt-tickets button").first.click()
    check("T5 ticket opens the ticket update", modal(pg)); close(pg)
    pg.goto(f"{BASE}/tip/leads"); pg.wait_for_selector(".pt-t-leads")
    n_open = pg.locator(".pt-t-leads .pt-tr:not(.pt-th)").count()
    pg.locator(".pt-filters button").last.click(); pg.wait_for_timeout(200)
    check("T6 Leads page with working filters", pg.locator(".pt-t-leads .pt-tr:not(.pt-th)").count() >= n_open > 0)
    pg.locator(".pt-filters button").first.click(); pg.wait_for_timeout(200)
    sch = pg.locator(".pt-t-leads [data-act=book]")
    if sch.count(): sch.first.click(); check("T7 Schedule opens the booking form", modal(pg)); close(pg)
    else: check("T7 Schedule opens the booking form", False, "no schedulable lead")
    pg.locator(".dsh-acct-btn").click(); pg.get_by_role("menuitem", name="Payments to Connect Bhai").click(); pg.wait_for_url("**/tip/payments"); pg.wait_for_timeout(500)
    check("T8 Payments to Connect Bhai: opens, Customers marked active", pg.locator(".dsh-side [aria-current=page]").inner_text().strip() == "Customers")
    pg.goto(f"{BASE}/tip"); pg.wait_for_selector(".pt-kpi"); inp = pg.locator(".dsh-search input"); inp.fill("TK2"); pg.wait_for_selector(".dsh-results li")
    check("T9 search finds a ticket", "Ticket" in pg.locator(".dsh-results").inner_text())
    check("T10 no page errors", not errs, errs[:1]); c.close()

    # ---- Admin ----
    c, pg, errs = open_page(b, "admin"); pg.wait_for_selector(".pt-kpi")
    check("A1 Admin overview: 6 KPIs, assignment, applications, chart, zones, cities", pg.locator(".pt-kpi").count() == 6 and pg.locator(".pt-t-assign .pt-tr:not(.pt-th)").count() >= 1 and pg.locator(".recharts-bar-rectangle").count() > 0 and pg.locator(".pt-t-zone .pt-tr:not(.pt-th)").count() >= 3 and pg.locator(".pt-t-city .pt-tr:not(.pt-th)").count() >= 3)
    pg.locator(".pt-t-assign [data-act=assign]").first.click()
    check("A2 Assign DSA / TIP opens the assignment form", modal(pg)); close(pg)
    apps = pg.locator(".pt-t-apps .pt-tr:not(.pt-th)").count()
    pg.locator(".pt-t-apps .pt-ok").first.click(); pg.wait_for_selector("#toast:not([hidden])", timeout=5000)
    t = pg.locator("#toast").inner_text()
    check("A3 Approve runs the app's check (demo applicant: KYC not verified yet)", "KYC" in t or "approved" in t.lower(), t)
    pg.locator(".pt-t-apps .pt-no").first.click(); pg.wait_for_timeout(1200)
    check("A4 Reject removes the application", pg.locator(".pt-t-apps .pt-tr:not(.pt-th)").count() == apps - 1 or pg.locator(".pt-t-apps").count() == 0)
    inp = pg.locator(".dsh-search input"); inp.fill("452009"); pg.wait_for_selector(".dsh-results li")
    check("A5 search finds leads / partners / locations by PIN", "452009" in pg.locator(".dsh-results").inner_text())
    check("A6 no page errors", not errs, errs[:1]); c.close()

    # ---- layout at all widths ----
    bad = []
    for role, path in (("dsa", ""), ("dsa", "/customers"), ("dsa", "/tickets"), ("tip", ""), ("tip", "/leads"), ("admin", "")):
        for w in (360, 390, 768, 1024, 1440, 1672):
            c, pg, _ = open_page(b, role, path, w, 850); pg.wait_for_selector(".pt .pt-card", timeout=15000); pg.wait_for_timeout(250)
            sw = pg.evaluate("Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)")
            if sw > w: bad.append(f"{role}{path}@{w}:{sw}")
            c.close()
    check("L1 no sideways page scroll at 360/390/768/1024/1440/1672 (wide tables scroll inside their card)", not bad, ", ".join(bad))
    b.close()
print(f"\n{sum(R)}/{len(R)} passed")
