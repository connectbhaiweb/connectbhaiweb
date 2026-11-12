"""Step 1 shell checks. Run against a running server: python3 tests/shell_check.py [base_url]"""
import sys, json
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
EXE = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
USERS = {"customer": ("u-cust", "my", 5), "dsa": ("u-dsa", "dsa", 8), "tip": ("u-tip", "tip", 8), "admin": ("u-admin", "admin", 16)}
WIDTHS = [360, 390, 768, 1024, 1440]
results = []

def check(name, ok, info=""):
    results.append((name, bool(ok), info)); print(("PASS " if ok else "FAIL ") + name + (f"  [{info}]" if info and not ok else ""))

# probe installed before any page script: records header visibility on every frame from the first one
PROBE = """
window.__frames = [];
(function tick(){ const h = document.querySelector('header.top'); const d = document.documentElement;
  window.__frames.push({ hdr: h ? getComputedStyle(h).display : 'none-yet', pend: d.hasAttribute('data-shell-pending'), shell: d.dataset.shell || null });
  if (window.__frames.length < 240) requestAnimationFrame(tick); })();
"""

def login(ctx, uid):
    ctx.add_init_script(f"try{{localStorage.setItem('cb-session','{uid}')}}catch(e){{}}")

def wait_shell(page, role):
    page.wait_for_function(f"document.documentElement.dataset.shell === '{role}'", timeout=15000)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=EXE)

    # A: per role at 1440
    for role, (uid, base, n) in USERS.items():
        ctx = br.new_context(viewport={"width": 1440, "height": 900}); login(ctx, uid); pg = ctx.new_page()
        pg.goto(f"{BASE}/{base}"); wait_shell(pg, role)
        check(f"A1 {role}: shell on, site header/footer hidden", pg.evaluate("getComputedStyle(document.querySelector('header.top')).display==='none' && getComputedStyle(document.querySelector('footer')).display==='none'"))
        check(f"A2 {role}: sidebar has {n} items", pg.locator(".dsh-side .dsh-item").count() == n, pg.locator(".dsh-side .dsh-item").count())
        check(f"A3 {role}: first item active on base URL", pg.locator(".dsh-side .dsh-item").first.get_attribute("aria-current") == "page")
        second = pg.locator(".dsh-side .dsh-item").nth(1); href = second.get_attribute("href"); second.click()
        pg.wait_for_url(f"**{href}"); pg.wait_for_timeout(300)
        check(f"A4 {role}: sidebar link navigates + marks active", second.get_attribute("aria-current") == "page" and pg.evaluate("document.querySelector('#app').children.length>0 || !!document.querySelector('.dsh-page .pt, .dsh-page .cu')"))
        ctx.close()

    # B: no horizontal scroll + right navigation form per width (all roles, every tab)
    for role, (uid, base, n) in USERS.items():
        bad, form_bad = [], []
        for w in WIDTHS:
            ctx = br.new_context(viewport={"width": w, "height": 800}); login(ctx, uid); pg = ctx.new_page()
            pg.goto(f"{BASE}/{base}"); wait_shell(pg, role)
            tabs = [h.split("/")[-1] for h in pg.eval_on_selector_all(".dsh-side .dsh-item", "els=>els.map(e=>e.getAttribute('href'))")]
            for t in tabs:
                pg.goto(f"{BASE}/{base}/{t}"); wait_shell(pg, role); pg.wait_for_timeout(250)
                sw = pg.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)")
                if sw > w: bad.append(f"{w}/{t}:{sw}")
            side = pg.evaluate("(()=>{const s=document.querySelector('.dsh-side');const st=getComputedStyle(s);return st.display==='none'?0:s.getBoundingClientRect().width})()")
            bottom = pg.evaluate("getComputedStyle(document.querySelector('.dsh-bottom')).display!=='none'")
            want = (side == 0 and bottom) if w < 768 else (abs(side - 76) < 1 and not bottom) if w < 1024 else (side >= 248 and not bottom)
            if not want: form_bad.append(f"{w}: side={side} bottom={bottom}")
            ctx.close()
        check(f"B1 {role}: no sideways scroll at {WIDTHS} on every tab", not bad, ", ".join(bad[:6]))
        check(f"B2 {role}: sidebar / rail / bottom bar by width", not form_bad, "; ".join(form_bad))

    # C: phone More sheet (admin has 14 items) + Esc
    ctx = br.new_context(viewport={"width": 390, "height": 844}); login(ctx, "u-admin"); pg = ctx.new_page()
    pg.goto(f"{BASE}/admin"); wait_shell(pg, "admin")
    check("C1 phone: 4 items + More", pg.locator(".dsh-bottom .dsh-bn").count() == 5)
    pg.get_by_role("button", name="More").click()
    check("C2 More sheet lists all 16 (incl. Care plan)", pg.locator("#dsh-sheet:not([hidden]) .dsh-sheet-item").count() == 16 and pg.locator("#dsh-sheet .dsh-sheet-item", has_text="Care plan").count() == 1)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check("C3 Esc closes the sheet", pg.locator("#dsh-sheet").get_attribute("hidden") is not None)
    pg.get_by_role("button", name="More").click(); pg.locator("#dsh-sheet .dsh-sheet-item", has_text="Reports").click(); pg.wait_for_url("**/admin/reports")
    check("C4 sheet item navigates, sheet closes, More marked active", pg.locator("#dsh-sheet").get_attribute("hidden") is not None and pg.locator(".dsh-bottom button.dsh-bn").get_attribute("aria-current") == "page")
    ctx.close()

    # D: tablet burger expands rail
    ctx = br.new_context(viewport={"width": 768, "height": 1024}); login(ctx, "u-dsa"); pg = ctx.new_page()
    pg.goto(f"{BASE}/dsa"); wait_shell(pg, "dsa"); pg.locator(".dsh-burger").click(); pg.wait_for_timeout(350)
    check("D1 tablet: burger opens 272px menu with labels", abs(pg.evaluate("document.querySelector('.dsh-side').getBoundingClientRect().width") - 272) < 1 and pg.locator(".dsh-side .dsh-lbl").first.is_visible())
    pg.locator(".dsh-scrim").click(); pg.wait_for_timeout(300)
    check("D2 tablet: scrim click closes", pg.locator(".dsh-side[data-open]").count() == 0)
    ctx.close()

    # E: account menu + logo hover
    ctx = br.new_context(viewport={"width": 1440, "height": 900}); login(ctx, "u-cust"); pg = ctx.new_page()
    pg.goto(f"{BASE}/my"); wait_shell(pg, "customer")
    pg.locator(".dsh-acct-btn").click()
    check("E1 account menu opens", pg.locator(".dsh-menu").is_visible())
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check("E2 Esc closes account menu", not pg.locator(".dsh-menu").is_visible())
    logo = pg.locator(".dsh-logo"); logo.hover(); pg.wait_for_timeout(150)
    a = pg.locator(".dsh-logo img").get_attribute("src") or ""
    pg.mouse.move(900, 600); pg.wait_for_timeout(150)
    b = pg.locator(".dsh-logo img").get_attribute("src") or ""
    check("E3 logo animates on hover, static after", (a.startswith("blob:") or "logo-reveal" in a) and "logo-full" in b, f"{a} | {b}")
    logo.hover(); pg.wait_for_timeout(150); a2 = pg.locator(".dsh-logo img").get_attribute("src") or ""; pg.mouse.move(900, 600); pg.wait_for_timeout(150)
    check("E6 replay gets a fresh URL (restarts at frame 1)", a2.startswith("blob:") and a2 != a, f"{a} | {a2}")
    pg.locator(".dsh-logo").focus(); pg.wait_for_timeout(150)
    f = pg.locator(".dsh-logo img").get_attribute("src") or ""
    check("E4 logo animates on keyboard focus", f.startswith("blob:") or "logo-reveal" in f)
    ctx.close()
    ctx = br.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce"); login(ctx, "u-cust"); pg = ctx.new_page()
    pg.goto(f"{BASE}/my"); wait_shell(pg, "customer"); pg.locator(".dsh-logo").hover(); pg.wait_for_timeout(150)
    check("E5 reduced motion: logo stays static", "logo-full" in (pg.locator(".dsh-logo img").get_attribute("src") or ""))
    ctx.close()

    # F: no shell when logged out / wrong role
    ctx = br.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page()
    pg.goto(f"{BASE}/my"); pg.wait_for_function("!document.documentElement.hasAttribute('data-shell-pending') && document.querySelector('#app .locked')", timeout=15000)
    check("F1 logged out on /my: site header, login prompt, no shell", pg.locator(".dsh-top").count() == 0 and pg.locator("header.top").is_visible())
    ctx.close()
    ctx = br.new_context(viewport={"width": 1440, "height": 900}); login(ctx, "u-cust"); pg = ctx.new_page()
    pg.goto(f"{BASE}/admin"); pg.wait_for_function("document.querySelector('#app .locked')", timeout=15000); pg.wait_for_timeout(300)
    check("F2 customer on /admin: no shell, header back", pg.locator(".dsh-top").count() == 0 and pg.locator("header.top").is_visible() and not pg.evaluate("document.documentElement.hasAttribute('data-shell-pending')"))
    ctx.close()

    # G: first paint on a dashboard URL (fresh load, reload, logout)
    for label, how in (("G1 fresh load", "goto"), ("G2 reload", "reload")):
        flashes = []
        for i in range(8):
            ctx = br.new_context(viewport={"width": 1440, "height": 900}); login(ctx, "u-dsa"); ctx.add_init_script(PROBE); pg = ctx.new_page()
            pg.goto(f"{BASE}/dsa/leads")
            if how == "reload": wait_shell(pg, "dsa"); pg.reload()
            wait_shell(pg, "dsa"); pg.wait_for_timeout(200)
            fr = pg.evaluate("window.__frames")
            vis = [k for k, f in enumerate(fr) if f["hdr"] not in ("none", "none-yet")]
            if vis: flashes.append(f"run{i}:frames{vis[:3]}")
            ctx.close()
        check(f"{label}: site header never painted (8 runs)", not flashes, ", ".join(flashes))
    ctx = br.new_context(viewport={"width": 1440, "height": 900}); login(ctx, "u-dsa"); pg = ctx.new_page()
    pg.goto(f"{BASE}/dsa"); wait_shell(pg, "dsa"); pg.locator(".dsh-acct-btn").click(); pg.get_by_role("menuitem", name="Log out").click()
    pg.wait_for_url(f"{BASE}/"); pg.wait_for_timeout(400)
    check("G3 log out: shell gone, site header back on home", pg.locator(".dsh-top").count() == 0 and pg.locator("header.top").is_visible())
    ctx.close()

    # H: sidebar labels never cut, badges stay inside, wave sits at the bottom (short + tall screens)
    cut, wave_bad = [], []
    for role, (uid, base, n) in USERS.items():
        for w, h in ((1024, 768), (1280, 720), (1440, 900), (1920, 1080)):
            ctx = br.new_context(viewport={"width": w, "height": h}); login(ctx, uid); pg = ctx.new_page()
            pg.goto(f"{BASE}/{base}"); wait_shell(pg, role); pg.wait_for_timeout(200)
            cut += [f"{role}@{w}:{x}" for x in pg.evaluate("""[...document.querySelectorAll('.dsh-item')].map(a=>{const l=a.querySelector('.dsh-lbl'),bd=a.querySelector('.dsh-badge'),ar=a.getBoundingClientRect(),lh=parseFloat(getComputedStyle(l).lineHeight);
              return (l.scrollHeight>2*lh+3||l.scrollWidth>l.clientWidth+1||(bd&&(bd.getBoundingClientRect().right>ar.right-4||l.getBoundingClientRect().right>bd.getBoundingClientRect().left)))?l.textContent:null}).filter(Boolean)""")]
            if abs(pg.evaluate("document.querySelector('.dsh-wave').getBoundingClientRect().bottom") - h) > 1: wave_bad.append(f"{role}@{w}x{h}")
            ctx.close()
    ctx = br.new_context(viewport={"width": 768, "height": 1024}); login(ctx, "u-cust"); pg = ctx.new_page(); pg.goto(f"{BASE}/my"); wait_shell(pg, "customer")
    if abs(pg.evaluate("document.querySelector('.dsh-wave').getBoundingClientRect().bottom") - 1024) > 1: wave_bad.append("rail@768")
    ctx.close()
    check("H1 sidebar labels never cut, badges inside the item", not cut, ", ".join(cut[:6]))
    check("H2 wave at the sidebar bottom (also short screens + tablet rail)", not wave_bad, ", ".join(wave_bad))
    br.close()

ok = sum(r[1] for r in results); print(f"\n{ok}/{len(results)} passed")
json.dump(results, open("/tmp/shell_results.json", "w"))
