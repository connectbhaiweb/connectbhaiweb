"""Layout audit: every page of every role + home, at 360/390/768/1024/1440, OS light + dark.
Flags: sideways page scroll, content sticking out of its card, console errors / hydration warnings.
python3 tests/audit_layout.py [base_url] [widths] [schemes]"""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
W = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else "360,390,768,1024,1440").split(",")]
SCH = (sys.argv[3] if len(sys.argv) > 3 else "light,dark").split(",")
EXE = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
USERS = {"customer": ("u-cust", "my"), "dsa": ("u-dsa", "dsa"), "tip": ("u-tip", "tip"), "admin": ("u-admin", "admin")}
CONTRAST = """(() => { const out = [];
  const rgb = c => { const m = c.match(/[\\d.]+/g); return m ? m.map(Number) : [0,0,0,0]; };
  const lum = ([r,g,b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126*f(r) + .7152*f(g) + .0722*f(b); };
  const bgOf = el => { const me = el.getBoundingClientRect(); for (let e = el; e; e = e.parentElement) { const st = getComputedStyle(e); const er = e.getBoundingClientRect(); if (e !== el && (me.top < er.top - 1 || me.bottom > er.bottom + 1)) continue; if (st.backgroundImage !== "none" && !e.matches("body,html")) return null; const c = rgb(st.backgroundColor); if ((c[3] ?? 1) > .9) return c; } return [255,255,255,1]; };
  for (const el of document.querySelectorAll("main *, .dsh-page *, .dsh-top *, .dsh-side *, .dsh-bottom *, #modal *")) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0) continue;
    const st = getComputedStyle(el); if (st.visibility === "hidden" || el.closest("[disabled],:disabled,[aria-disabled=true],.sk,.recharts-wrapper")) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity; if (op < .95) continue;
    const bg = bgOf(el); if (!bg) continue; const fg = rgb(st.color); if ((fg[3] ?? 1) < .9) continue;
    const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const px = parseFloat(st.fontSize), large = px >= 24 || (px >= 18.66 && +st.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} «${el.textContent.trim().slice(0, 24)}»`);
  }
  return [...new Set(out)].slice(0, 5); })()"""
PROBE = """(() => { const out = [];
  const boxes = '.card,.pt-card,.cu-card,.plan,.item,.kpi,.pt-kpi,.tbl-wrap,.dsh-side,.dsh-top,.dsh-bottom';
  for (const el of document.querySelectorAll('main *, .dsh-page *, .dsh-top *, .dsh-side *, .dsh-bottom *')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.position === 'fixed' && !el.closest('.dsh-top,.dsh-bottom')) continue;
    const box = el.parentElement && el.parentElement.closest(boxes); if (!box) continue;
    let sc = el.parentElement; let scroller = false; while (sc && sc !== box) { const o = getComputedStyle(sc); if (/(auto|scroll|hidden)/.test(o.overflowX)) { scroller = true; break; } sc = sc.parentElement; }
    if (scroller || /(auto|scroll|hidden|clip)/.test(getComputedStyle(box).overflowX)) continue;
    const b = box.getBoundingClientRect();
    if (r.right > b.right + 1.5 || r.left < b.left - 1.5) out.push((el.className && el.className.baseVal === undefined ? el.className : el.tagName) + ' «' + (el.textContent || '').trim().slice(0, 30) + '»');
  }
  return [...new Set(out)].slice(0, 6); })()"""
def pages(pg, role):
    if role == "home": return ["/"]
    base = USERS[role][1]; pg.goto(f"{BASE}/{base}")
    pg.wait_for_function(f"document.documentElement.dataset.shell === '{('customer' if role=='customer' else role)}'", timeout=15000)
    return [f"/{base}/" + h.split("/")[-1] for h in pg.eval_on_selector_all(".dsh-side .dsh-item", "els=>els.map(e=>e.getAttribute('href'))")]
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    for scheme in SCH:
        for role in ["home", *USERS]:
            for w in W:
                c = b.new_context(viewport={"width": w, "height": 860}, color_scheme=scheme)
                if role != "home": c.add_init_script(f"localStorage.setItem('cb-session','{USERS[role][0]}')")
                pg = c.new_page(); errs = []
                pg.on("console", lambda m: errs.append(m.text[:140]) if m.type in ("error",) or "hydrat" in m.text.lower() else None)
                pg.on("pageerror", lambda e: errs.append(str(e)[:140]))
                if role != "home": pages(pg, role)
                for path in (["/"] if role == "home" else pages(pg, role)):
                    pg.goto(BASE + path); pg.wait_for_timeout(900)
                    sw = pg.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)")
                    out = pg.evaluate(PROBE) + pg.evaluate(CONTRAST)
                    if sw > w or out:
                        bad += 1; print(f"{scheme} {role} {path} @{w}: scroll={sw}" + (f" overflow={out}" if out else ""))
                if errs: bad += 1; print(f"{scheme} {role} @{w}: console {errs[:2]}")
                c.close()
    b.close()
print("ISSUES", bad)
