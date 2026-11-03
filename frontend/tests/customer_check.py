"""Step 2 customer dashboard checks. python3 tests/customer_check.py [base_url]  (needs Playwright + Chromium)"""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
EXE = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
R = []
def check(n, ok, info=""): R.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{info}]" if info and not ok else ""))
# test data: one booked request (current) + one lost request, on top of the demo customer's installed connection
SEED = """(() => { const K = "cb-demo-v6"; const db = JSON.parse(localStorage.getItem(K)); if (db.__seeded) return;
  const ago = d => new Date(Date.now() - d * 864e5).toISOString(), add = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const L = (id, ref, plan, status, pin, area, days) => db.leads.push({ id, ref_code: ref, customer_id: "u-cust", name: "Ramesh Sharma", phone: "9876500001", pincode: pin, area, address: "", plan_id: plan, source: "website", status, assigned_dsa_id: "pt-d1", assigned_tip_id: "pt-t1", assigned_at: ago(days - .05), consent: true, created_at: ago(days), updated_at: ago(days) });
  L("ld-s1", "CB-104B2", "pl-a3", "booked", "452010", "Vijay Nagar", 1.2);
  db.lead_events.push({ id: "e1", lead_id: "ld-s1", to_status: "contacted", created_at: ago(1) }, { id: "e2", lead_id: "ld-s1", to_status: "booked", created_at: ago(.5) });
  db.bookings.push({ id: "bk-s1", ref_code: "BK-S1", lead_id: "ld-s1", customer_id: "u-cust", plan_id: "pl-a3", tip_partner_id: "pt-t1", dsa_partner_id: "pt-d1", status: "scheduled", scheduled_date: add(1), created_at: ago(.5) });
  L("ld-s2", "CB-0934F", "pl-a1", "lost", "452009", "Annapurna", 40);
  db.__seeded = 1; localStorage.setItem(K, JSON.stringify(db)); })()"""

def page(b, w=1440, h=900, seed=True):
    c = b.new_context(viewport={"width": w, "height": h}); c.add_init_script("localStorage.setItem('cb-session','u-cust')")
    pg = c.new_page(); pg.on("dialog", lambda d: d.accept()); pg.goto(f"{BASE}/my"); pg.wait_for_selector(".cu-booking", timeout=15000)
    if seed:
        pg.evaluate("(()=>{const b=document.createElement('button');b.dataset.act='reset-demo';document.body.append(b);b.click();b.remove()})()")
        pg.wait_for_function("!!localStorage.getItem('cb-demo-v6')"); pg.evaluate("localStorage.setItem('cb-session','u-cust')"); pg.evaluate(SEED)
        pg.goto(f"{BASE}/my"); pg.wait_for_selector(".cu-booking"); pg.wait_for_timeout(400)
    return c, pg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    c, pg = page(b, seed=False)
    check("C1 demo customer: booking card, tracker 5 steps, router, payments, speed, past", pg.locator(".cu-step").count() == 5 and pg.locator(".cu-router,.cu-pay,.cu-speed,.cu-past").count() == 4)
    check("C2 #app is empty and hidden (React page owns /my)", pg.evaluate("document.getElementById('app').children.length===0 && getComputedStyle(document.getElementById('app')).display==='none'"))
    check("C3 sidebar badges still shown (bookings/support/payments/chat)", pg.locator(".dsh-side .dsh-badge").count() >= 3, pg.locator(".dsh-side .dsh-badge").count())
    c.close()

    c, pg = page(b)
    check("C4 current = booked request, chip 'Installation in progress'", "CB-104B2" in pg.locator("#cu-bk-title").inner_text() and "Installation in progress" in pg.locator(".cu-bk-chip").inner_text())
    st = pg.eval_on_selector_all(".cu-step", "els=>els.map(e=>e.className.split('is-')[1])")
    check("C5 tracker states done,done,done,now,todo", st == ["done", "done", "done", "now", "todo"], st)
    check("C6 router shows the live connection (online, speed, signal)", "Online" in pg.locator(".cu-router .cu-dotchip").inner_text() and "Mbps" in pg.locator(".cu-rt-stats b").inner_text() and "Good" in pg.locator(".cu-signal").inner_text())
    hrefs = pg.eval_on_selector_all(".cu-person-acts a", "els=>els.map(a=>a.getAttribute('href'))")
    check("C7 Call = tel:, WhatsApp = wa.me", any(h.startswith("tel:+91") for h in hrefs) and any(h.startswith("https://wa.me/91") for h in hrefs), hrefs)
    check("C8 past requests list the other 2 requests", pg.locator(".cu-tr:not(.cu-th)").count() == 2)
    pg.locator(".cu-tr", has_text="CB-0934F").locator(".cu-more .cu-btn").click(); pg.wait_for_url("**ref=CB-0934F"); pg.wait_for_timeout(300)
    check("C9 View details opens that request in the main card", "CB-0934F" in pg.locator("#cu-bk-title").inner_text() and "Lost" in pg.locator(".cu-bk-chip").inner_text())
    pg.goto(f"{BASE}/my"); pg.wait_for_selector(".cu-booking")
    pg.locator(".cu-pay [data-act=pay]").click(); pg.wait_for_selector("#modal:not([hidden]) form[data-form=pay-charge]", timeout=5000)
    check("C10 Pay now opens the payment checkout", True)
    pg.locator("#modal form[data-form=pay-charge] button[type=submit]").click(); pg.wait_for_timeout(2500)
    check("C11 after paying, the card refreshes (no payment due)", "Nothing to pay" in pg.locator(".cu-pay").inner_text() or "Paid" in pg.locator(".cu-pay").inner_text(), pg.locator(".cu-pay").inner_text()[:80])
    pg.keyboard.press("Escape")
    pg.locator(".cu-rt-acts [data-act=modem-reboot]").click(); pg.wait_for_selector("#modal:not([hidden]) [data-act=modem-reboot-go]")
    check("C12 Restart router asks to confirm", True)
    pg.locator("[data-act=modem-reboot-go]").click(); pg.wait_for_timeout(2200)
    check("C13 restart runs and the page reloads its data", pg.locator(".cu-router").count() == 1 and pg.locator("#modal").get_attribute("hidden") is not None)
    pg.locator(".cu-rt-acts [data-act=modem-wifi]").click(); pg.wait_for_selector("#modal:not([hidden]) form[data-form=modem-wifi]")
    check("C14 Change Wi-Fi opens the Wi-Fi form", True); pg.keyboard.press("Escape")
    inp = pg.locator(".dsh-search input"); inp.fill("0934"); pg.wait_for_selector(".dsh-results li", timeout=5000)
    check("C15 search finds a booking by ref", "CB-0934F" in pg.locator(".dsh-results").inner_text())
    inp.press("Enter"); pg.wait_for_url("**ref=CB-0934F")
    check("C16 Enter opens it", "CB-0934F" in pg.locator("#cu-bk-title").inner_text())
    inp.fill("slow"); pg.wait_for_selector(".dsh-results li"); 
    check("C17 search finds a complaint", "Complaint" in pg.locator(".dsh-results").inner_text())
    inp.fill("payments"); pg.wait_for_function("document.querySelector('.dsh-results')?.innerText.includes('Page')")
    check("C18 search still finds pages by name", True)
    inp.fill(""); pg.goto(f"{BASE}/my"); pg.wait_for_selector(".cu-booking")
    pg.locator(".cu-speed [data-go=speed]").click(); pg.wait_for_url("**/speed")
    check("C19 Test now opens the speed test", True)
    pg.goto(f"{BASE}/my/support"); pg.wait_for_selector("#app .item, #app .empty, #app form", timeout=10000)
    check("C20 other tabs still show their pages (React page hidden)", pg.locator(".cu-booking").count() == 0)
    c.close()

    bad = []
    for w in (360, 390, 768, 1024, 1440, 1672):
        c, pg = page(b, w, 800)
        sw = pg.evaluate("Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)")
        if sw > w: bad.append(f"{w}:{sw}")
        cut = pg.eval_on_selector_all(".cu-step-txt b,.cu-btn", "els=>els.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)")
        if cut: bad.append(f"{w} cut:{cut[:3]}")
        c.close()
    check("C21 no sideways scroll, no cut labels/buttons at 360-1672", not bad, ", ".join(bad))
    c, pg = page(b, 390, 844)
    order = pg.evaluate("['.cu-booking','.cu-router','.cu-speed','.cu-past'].map(s=>Math.round(document.querySelector(s).getBoundingClientRect().top))")
    check("C22 phone order: booking, router+payments, speed test, past requests", order == sorted(order), order)
    c.close()
    c = b.new_context(viewport={"width": 1440, "height": 900}); pg = c.new_page(); pg.goto(f"{BASE}/my"); pg.wait_for_selector("#app .locked")
    check("C23 logged out: login prompt, no customer page", pg.locator(".cu").count() == 0 or not pg.locator(".cu").first.is_visible())
    c.close(); b.close()
print(f"\n{sum(R)}/{len(R)} passed")
