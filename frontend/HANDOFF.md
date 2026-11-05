# Connect Bhai: handoff (paste this into the new Claude chat / Project)

**Project:** Connect Bhai, broadband marketplace (Indore, MP). Next.js 16 App Router, plain JavaScript, Tailwind v4 (no preflight) + shadcn/ui + Magic UI.
**Roles:** Customer (/my), DSA (/dsa), TIP partner (/tip), Admin (/admin). Demo logins: 9876500001 customer, 9876500101 DSA, 9876500201 TIP, 9876500999 admin; password `Demo@1234`, OTP `123456`.
**Run:** `npm ci && npm run dev` (or `npm run build && npm start`). Lint: `npm run lint`.

## Done
- Migrated single HTML to Next.js; data layer + legacy view renderers in `src/lib/connectbhai/{api,ui}.js` (views still string templates writing into `<main id="app">`).
- New home hero (search + animation side by side), App-download section, FAQ, self-hosted fonts, dark header/footer with new logo.
- Speed test = React page (`components/speed/*`) from the dark design images; Magic UI + shadcn components in `components/{ui,magicui}`.
- Mobile menu, overflow fixes (320-1280px, all dashboards), skeleton/loading/retry states, hardened phone/OTP login.
- **Dashboard shell (Step 1 of the design-image rebuild):** `components/dashboard/*` + `app/dashboard.css`: top bar, sidebar (desktop), icon rail (tablet), bottom nav + More sheet (phone), mascot + wave, role nav config in `nav.js`. Logo plays the GIF-derived animation on hover/focus/tap (`components/Logo.jsx`, assets in `public/brand/`).

## Rebuild order (user wants "continue" after each step)
1. Layout shell + sidebar + logo hover  <- DONE, matched to the design images at 1672x941, 43/43 checks pass (`python3 tests/shell_check.py http://localhost:3000`, needs Playwright + Chromium)
2. Customer dashboard  <- DONE: /my and /my/bookings are a React page (`components/customer/*`, `app/customer.css`), 23/23 checks (`python3 tests/customer_check.py http://localhost:3000`)
3-5. DSA, TIP, Admin  <- DONE: React pages in `components/portal/*` (`app/portal.css`), Recharts charts. DSA: Home, My customers, Tickets. TIP: Home, Leads. Admin: Overview. Other sidebar tabs = the app's working views. 29/29 checks (`python3 tests/roles_check.py http://localhost:3000`)

All checks: `tests/shell_check.py` (43), `tests/customer_check.py` (23), `tests/roles_check.py` (29) against a running build.

## How React dashboard pages plug in (Step 2+)
- `ui.js` → `REACT_VIEWS` lists the view/tab combos owned by React; for those the app leaves `#app` empty and fires `cb:render` after every action, and the React page re-loads (`components/dashboard/useDashData.js`). Add a role there in steps 3-5.
- React pages render inside `<div class="dsh-page">` (same margins as `#app` in the shell) and expose sidebar counts through a hidden `[data-cb-counts]` strip.
- Buttons reuse the app's own handlers via `data-act` / `data-go` (pay, modem-reboot, modem-wifi, chat…), so no business logic is duplicated.
- Top-bar search: `components/dashboard/search.js` (customer: bookings, complaints, payments + pages; other roles: pages only until their step).

## Known open items
- Customer: names/numbers come from the demo data in api.js (Ramesh, "Sample Fiber A", ₹1,769), not the image (Rohit, Airtel, ₹1,000); api.js is off-limits. Prices show "/month + GST" as in the image; demo plans carry no GST info.
- Customer: Complaints, Care plan, Payments and Chat tabs are still the old views (working, old styling).
- Customer: installation time ("tomorrow, 11 am") shows the date only; bookings store no time.
- Shell first-paint (old G3) verified: frame-by-frame probe from the first rAF, 8 fresh loads + 8 reloads, header never painted. The old failure was the test reading too late, not the app.
- Shell fixes (dashboard.css only): wave stayed mid-sidebar when the mascot is hidden (height <780px, tablet rail); long labels were cut ("Complaints & requests", "Cities & waiting list", "Partners" next to "2 pending"): now wrap to max 2 lines, slightly tighter item padding/pill at 1024-1599px.
- Shell matched to the images: per-role sidebar width (customer 305 / DSA+TIP 296 / admin 276 at 1672px), item sizes, navy gradient, wave, redrawn mascot, top bar sizes, TIP/admin avatar icons, no role chip for customer, design icons (`components/dashboard/icons.jsx`), phone bottom nav without dots.
- Logo: `public/brand/logo-full.png` (first GIF frame) + `logo-reveal.webp` (all 46 GIF frames, same timing), both transparent. Each hover/tap replays from frame 1 (fresh object URL).
- Design images live in the chat, not in Project files; re-attach them in a new chat.
- DSA "Fees to Connect Bhai" and TIP "Payments to Connect Bhai": in the account menu (top-right); the sidebar marks Commission / Customers while open.
- DSA Tickets = conversations with customers, installer and Connect Bhai (the API gives DSA no ticket list; complaints belong to the TIP).
- TIP "Recent uploads" lists submitted plans (name, date, price, status); the app keeps no uploaded file names.
- Admin: Approve uses the app's KYC check, so the demo applicant without KYC shows the KYC message (as in the old Partners page).
- Top-bar search: all 4 roles search their own records + pages (`components/dashboard/search.js`). Hidden on phones (not in the mobile image).
- Customer/DSA avatars are initials (design images use photos; add real photo URLs per user later).
- Supabase (live) login, 30 s timeout and offline paths are untested (no credentials).
- App store links/QR need env vars (`.env.example`).

## Packages
- Added: recharts@^3.10.1 (+ its peer react-is@^19.3.1) for the dashboard charts.

## Rules from the user
Do not redesign; match the images exactly; no horizontal scroll at 360/390/768/1024/1440; token-efficient output (code + file paths); Hinglish replies.

## Round 2 (care plan, font/contrast pass, admin lists)  <- DONE
- Fonts ~10% smaller on React pages (titles 31px / 800, grey #53617F subtitles); contrast fixed to WCAG AA (chips, badges, links, bottom nav, WhatsApp circle now #048A3C instead of #07C253).
- Home plan cards: content no longer pushes past the card edge (`globals.css` `.plan` grid + price nowrap).
- Care plan (GenieACS mock): `src/lib/connectbhai/careplan.js` (only file to swap for the real NBI), UI `components/careplan/CarePlan.jsx`. Routes /dsa/careplan, /tip/careplan, /admin/careplan, customer /my/devices. Summary card on DSA/TIP/Admin home.
- DSA: chart removed, pipeline full width. TIP: "Leads given N of 100", "Amount paid to Connect Bhai". Admin: "Customers" item (Customers / TIP partners / DSA agents), Billing GST/TDS breakdowns using `src/lib/connectbhai/rates.js` (GST 18%, TDS 10% placeholders).
- Phones: search icon in the header. Old views restyled by `src/app/legacy-dash.css` (CSS only, markup unchanged).
- Checks: shell 43/43, customer 23/23, roles 41/41, `tests/audit_layout.py` (all pages, 5 widths, light+dark): 0 issues.
- Open: rates are placeholders; care plan data is mock; customer/DSA avatars are initials.

## Round 2b (dark-OS + top bar size)  <- DONE
- Dashboards now force the light token set (`:root[data-shell]` in dashboard.css), so old views stay readable when the OS/site is dark (was: dark cards with dark text).
- Top bar ~15% smaller (66px high, 42px search, 44px avatar, 38px logo); page titles 28px.
- AA contrast fixes: dashboard --blue #1043C8, --ok #0E6E3F, avatar initials, red sidebar badge #D92D35, signal text colours.
- `tests/audit_layout.py` now also checks text contrast (WCAG AA) on every page; dashboards: 0 issues in OS dark and light.
- Open (home page, not changed by request): in OS dark the story player labels ("Buffering…", controls) and the partner fee note measure below AA.
