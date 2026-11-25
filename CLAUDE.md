# CLAUDE.md – ConnectBhai

Source of truth for working in this repo. Read this before any task. Sub-guides: `frontend/AGENTS.md`, `mobile/AGENTS.md`, `frontend/HANDOFF.md`, `backend/README.md`.

## What it is
Broadband marketplace (Indore, MP). Roles: **Customer** (`/my`), **DSA** (`/dsa`, brings leads), **TIP** partner (`/tip`, installs), **Admin** (`/admin`).

## Repo layout
| Folder | Stack |
|---|---|
| `frontend/` | Next.js 16 App Router, React 19, **plain JavaScript**, Tailwind v4 (no preflight), shadcn/ui, Magic UI |
| `backend/` | NestJS 11, Prisma 6, MySQL 8, TypeScript. API prefix `/api/v1` |
| `mobile/` | Expo SDK 58, React Native, TypeScript, Expo Router |
| root | `package.json` runs backend + frontend together; `docker-compose.yml` |

## Branches
Feature branch → `staging` (testing) → `main` (production). Never commit straight to `main`.

## Commands
```bash
# root
npm run setup        # install backend + frontend, set up DB
npm run dev          # API :4000 + web :3000
npm run build | npm start | npm test

# backend
npm run start:dev | typecheck | test | test:e2e | test:all
npm run db:setup | db:migrate | db:seed | db:reset
npx prisma migrate deploy   # prod only; never `migrate dev` in prod

# frontend
npm run dev | build | lint
python3 tests/shell_check.py http://localhost:3000     # also customer_check.py, roles_check.py (Playwright)

# mobile
npx expo start | npx expo lint | npx tsc --noEmit | npx expo-doctor
npx expo install <pkg>      # ALWAYS, never npm/yarn add
```

## Env
- `backend/.env` from `.env.example`. Validated at boot (`src/config/env.validation.ts`). Prod refuses placeholder secrets and `OTP_DEV_CODE`.
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` → real API via `lib/connectbhai/rest.js`. Without it: in-browser demo data (`api.js`); Supabase vars are legacy/optional.
- `frontend` SEO: `NEXT_PUBLIC_SITE_URL` (canonical, Open Graph, sitemap, `connectbhai.in` redirect target) and `NEXT_PUBLIC_ENV`. Only `production` is indexed; anything else (staging, unset) gets noindex meta + `X-Robots-Tag`, a Disallow-all `robots.txt` and an empty sitemap. Shared metadata helper: `src/lib/site.js` (`pageMeta`); every public page sets its own title, description and canonical. `/my`, `/dsa`, `/tip`, `/admin` are noindex everywhere. Share image: `public/og.png` (1200x630); `public/llms.txt` is static (production URLs).
- `mobile/.env`: `EXPO_PUBLIC_API_URL`.
- Customer names: a number that logs in without a name gets the account name "Customer". Any connection request replaces it with the name given (`leads.service.create`): a logged-in customer can rename themself on a request; a request that is not logged in only replaces the "Customer" placeholder, so nobody is renamed by someone typing their number.
- Dev logins: OTP `123456`. Backend admin `9999999999` / `Admin@12345`. Frontend demo: `9876500001` customer · `…101` DSA · `…201` TIP · `…999` admin, password `Demo@1234`.

## Frontend architecture
- `src/app/` one `page.js` per route; CSS: `globals.css` (original, keep as is), `dashboard.css`, `customer.css`, `portal.css`.
- `src/lib/connectbhai/`: `api.js` (demo data layer, **off-limits**), `rest.js` (REST layer, same method names), `ui.js` (legacy string-template views writing into `<main id="app">`), `config.js`, `shared.js`, `runtime.js`.
- React dashboards: `components/dashboard/*` (shell, nav in `nav.js`), `components/customer/*`, `components/portal/*` (DSA/TIP/Admin, Recharts), `components/speed/*`.
- Plugging a React page in: add the view/tab to `REACT_VIEWS` in `ui.js`; the page reloads on the `cb:render` event (`useDashData.js`). Buttons reuse existing handlers via `data-act` / `data-go` — don't duplicate business logic.
- English/Hindi: `lib/i18n/engine.js` swaps text by exact English match from `lib/i18n/hi*.js` (toggle `components/LangToggle.jsx`, saved in localStorage `cb-lang`). A new visible English text needs a Hindi entry in `hi-extra.js` (`{x}` = any text, `{n}` = number). Debug: localStorage `cb-i18n-debug`=1, then read `cb-missing`. Do not read the big `hi-*.js` lists.
- Entrance animation: `components/MotionRuntime.jsx` (Motion). Phone tables turn into cards via `components/ResponsiveTables.jsx` plus the max-width:700px rules in `portal.css` and `legacy-dash.css`.
- Tailwind only scans `components/ui`, `components/magicui`, `components/speed`, `app/ui-kit`.

## Lead flow: DSA first, TIP only installs (do not break)
1. **New leads go to a DSA.** Auto-assign (setting `auto_assign`) picks the approved, active DSA serving the lead's PIN code (`dsa_pincode_mapping`) with the fewest open leads; if none serves it, the lead waits for admin. Admin assigns / reassigns a DSA with `PATCH /leads/:id/assign {dsa_user_id}` (admin only, until the lead is booked). A DSA's own leads stay theirs. The DSA is `leads.brought_by_user_id` (drives the DSA dashboard, reports and the install payout). A DSA's PIN codes are set at registration or by admin (partner Edit, `PATCH /users/:id {service_pincodes}`).
2. **The DSA works the lead:** contacts, follows up, marks lost (`PATCH /leads/:id/status`) and **books** it (`POST /bookings`). A booking may exist with **no TIP** (`bookings.tip_user_id` is nullable).
3. **Then admin or the lead's DSA assigns a TIP to the booked lead** (`PATCH /leads/:id/assign {tip_user_id}`, only while the lead is `scheduled`; `GET /leads/:id/tip-options` lists TIPs, those covering the PIN first). It sets `leads.tip_user_id` and the open booking's TIP, can change until installed, and tells the TIP (and the customer, once). The call must also carry **`telephone_no`** (digits only, max 11) and **`order_no`** (letters, digits or dash, max 11), both required; they are stored on `leads` and shown to the customer, DSA, TIP and admin (lead tables, lead details, customer booking card). The Assign / Change TIP dialog asks for them and pre-fills the saved values.
4. **The TIP only installs:** `POST /bookings/:id/start|complete` is for the assigned TIP or admin, never the DSA, and needs a TIP on the booking. Install pays the DSA payout to the lead's DSA and charges the TIP.
- Leads that were already with a TIP before this flow (status new / contacted / followup) are left as they are: that TIP can still contact, follow up and book them.
- "Assigned" is a **UI-only** status: `rest.js` shows a server `new` lead that has a DSA (or, on an old lead, a TIP) as `assigned`. Filters: `status=new&unassigned=1` (no DSA, no TIP) / `status=new&assigned=1`. The API has no `assigned` status.
- The lead carries its latest booking (`bookings[0]`); a Booked lead shows **Install** to its TIP, and **Assign TIP** to its DSA / admin.

## Plan payment (customer pays Connect Bhai directly)
A customer can pay the **plan price** of their lead any day (`POST /charges/customer {lead_id}`; Razorpay via the normal charge flow). The server always prices it from `plan.price` (GST-inclusive); no amount or description is accepted from the client, a ₹0 plan cannot be paid, and an open payment for the same lead is reused. Admin, or the TIP assigned to the lead, can instead mark it received outside the app: `POST /leads/:id/payment/offline {reference?}` (creates the charge if none is open, then settles it as `offline`). Leads carry their latest paid `customer_payment` as `charges[0]` (`payment` in `rest.js`), shown as Paid on the customer booking card, the lead dialog and the TIP table.

## Care plan: GenieACS and Zabbix ONUs
- GenieACS (TR-069) modems give full status and take commands. ONUs without it are read from **Zabbix** (`care-plan/zabbix.provider.ts`, env `ZABBIX_API_URL` + `ZABBIX_API_TOKEN`, read-only `item.get`; empty = off). Customers are linked the same way, by serial number (booking `router_serial`).
- Zabbix data: items on the OLT host, `onu.serial[..]` and `onu.status[..]` (SNMP ifOperStatus 1 up, 2 down) paired by tags `pon` + `onu_id`. The status is shown as Zabbix holds it, however old (the user's choice): if the OLT stops answering Zabbix, screens keep showing the last reading. `online: null` only when Zabbix has no up/down value.
- A serial GenieACS knows is a GenieACS modem. Otherwise `care_plan_devices.last_status = {source:'zabbix', serial}` marks it (`isZabbixOnu`; no migration) and the API returns `source: 'zabbix'`.
- A Zabbix ONU is **status only**: commands and speed test are refused by the API, and every website screen shows only Online/Offline + serial (a customer can still raise a complaint). The mobile app does not hide its buttons yet (the API refuses them).
- `backend/.env.test` keeps both Zabbix settings empty so tests never call the real server.

## Admin edit / delete (any status)
Admin can edit and delete leads and DSA/TIP partners in **any** status: `PATCH|DELETE /leads/:id`, `PATCH|DELETE /users/:id` (`leads.service.adminUpdate/adminDelete`, `users.service.updatePartner/deletePartner`). Deletes are one transaction: a lead takes its bookings, payout, modem and chat with it (invoices stay, unlinked); a partner's leads stay (DSA/TIP cleared) while their bookings, payouts, charges, tickets and messages go. Connect Bhai's internal TIP cannot be deleted. The status machine and the assign locks above are **not** relaxed. The partner Edit dialog saves name, firm, mobile, email, address, PIN only (per-install amount and lead target are global settings).

## Delete my account
`DELETE /users/me {phone}` (customer, DSA or TIP; the phone must match the account; admin and the internal TIP are refused). Nothing blocks it: dues and open work do not stop it. DSA/TIP: same as admin delete. Customer: details wiped, row kept disabled as "Deleted customer" (phone `d<id>`) so paid receipts stay; their requests stay for the DSA/TIP without the customer's details. `rest.js` `deleteMyAccount()` (`users.service.deleteAccount`).

## Backend
Modules in `src/<feature>/` (auth, leads, bookings, payments, care-plan, commissions, plans, settings, tickets, chat, …). Business rules (DSA payout, TIP fees + GST, Care Plan, Razorpay HMAC/idempotency) live in code and are covered by tests — see `backend/README.md`. `app_settings` DB values override env.

## Mobile
Routes in `src/app/` (`_layout.tsx` = navigators); non-route code in `src/components`, `src/lib`. Never hand-edit `ios/`/`android/`. Check versioned Expo docs before using any API.
- Rebuilt from scratch (Expo SDK 58, TypeScript, bundle ID `com.connectbhai.app`, iOS + Android, one project for both). Same backend, no new APIs. `src/lib/api.ts` = fetch client (tokens in `expo-secure-store`, auto refresh on 401); `src/lib/session.tsx` = login state. Browsing (Home, PIN search, `plans`, compare, request) is public; no route guards.
- Navigation mirrors the website (checked against staging.connectbhai.com in phone view). Logged out / public: bottom bar Plans, Care plan, Speed test, More (`(tabs)/_layout.tsx`; the website has these as its hamburger menu). Logged in: the user's own portal, `src/app/portal/` (website's phone dashboard bar): customer Bookings, Support, Care plan, Payments, Chat; DSA Home, Leads, Installs, More; TIP Home, Leads, Payments, More; admin Overview, Leads, More. After login the app opens the portal once (module-level `landedFor`). Header (`AppHeader`): trust bar, logo, EN|हिं pill (the only language control; the More page has none), Log in, or (logged in) search, WhatsApp, avatar (opens `/profile`, the account page). Floating WhatsApp button on every screen. A hidden tab (`href: null`) CANNOT be opened by a link, so pages reached from More/avatar are Stack routes (`commission`, `partners`, `apply`, `profile`, `chat/[thread]`).
- Home (`(tabs)/index.tsx`) like the website: compact hero, city dropdown (+ waiting list for non-live cities), Fiber/Air Fiber/SIM/TV/OTT tabs, PIN search + Reset, results inline (`components/Results.tsx`: sort, min speed, max price before GST, benefits, providers), story carousel, Care plan card, How it works, cities, DSA/TIP CTA, FAQ (`lib/faq.json`), footer. The API calls Air Fiber `airfiber` (`lib/catalog.ts` maps it). Other public screens: Care plan explainer (`care.tsx`), dark Speed test with dial (`speed.tsx`, `lib/speedtest.ts` via fetch to Cloudflare), request form (`request.tsx`: website fields, consent, WhatsApp OTP for guests), login card (OTP or mobile + password), DSA/TIP application (`apply.tsx`, no document upload yet). Legal pages open on the website (`lib/site.ts`).
- The website's animated artwork (hero story, Care plan card, How-it-works pictures, Care page art) is copied from the website's own files by `mobile/scripts/build-web-art.mjs` into `lib/web-art.generated.ts` (re-run `node scripts/build-web-art.mjs` when the website art changes) and played by `components/WebArt.tsx` in `react-native-webview`, so it looks and moves like the website.
- Customer Support (`portal/support.tsx`: contacts, tickets, raise form) and Chat (`portal/chat.tsx`, `chat/[thread].tsx`, polls every 10 s) use `lib/support.ts` (same calls as the website).
- Install form (`lead/[id]`) = website's "Update installation": status (Installed / In progress / Cancelled), connection reference, ONT serial, plus MAC and notes.
- Data layers: `lib/catalog.ts` (public plans), `lib/customer.ts` (customer + shared lead mapper), `lib/partner.ts` (DSA/TIP/admin lead actions, dashboard, commissions), `lib/pay.ts` (plan payment: mock gateway in dev, `react-native-razorpay` live), `lib/router.ts` (Care plan router restart, Wi-Fi, speed test).
- Language: `lib/i18n.tsx` (`tr(text, lang)`, `useLang`), Hindi in `lib/hi.json` (copied from the website lists) and `lib/hi-extra.ts` (app-only text). React Compiler is on: always pass `lang` into `tr` so text re-renders. New visible text needs a Hindi entry in `hi-extra.ts`.
- Not built (website has them): current-location PIN and exact-location pin (needs expo-location), document upload on the DSA/TIP application, notification bell, "Top" button, password reset (the website's set-password step is not supported by the API), Tickets/Chat for DSA/TIP/admin, Care plan for DSA/TIP/admin, My customers, TIP plan-update sheet, admin Customers/Team/Providers/Plans/Locations/Cities/Billing/Payouts/Reports/Settings, SIM plans (the real API has none), the rest of admin (plans, providers, billing, payouts, settings, reports, tickets, chat), TIP Care plan purchase, current-location PIN, max-price filter.
- First iOS build: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` (CocoaPods crashes without it), then `npx expo run:ios`; later `npx expo start --dev-client`. `ios/` and `android/` are generated and git-ignored.

## Rules for Claude
1. Next 16 and Expo 58 differ from training data — read the versioned docs first.
2. No code, file, structure or flow change without the user's explicit "yes / go ahead". Plan (3–5 lines) + questions first.
3. No new dependency without asking.
4. Read only files relevant to the task; show diffs, not whole files.
5. Keep existing naming, flow and architecture.
6. Before done: frontend `npm run lint`; backend `typecheck` + `test`; mobile lint + `tsc --noEmit`.
7. Update this file when a change makes it outdated.
8. **Keep the lead flow DSA-first** (see "Lead flow"): leads go to a DSA; the DSA contacts, follows up and books; admin or the DSA then assigns a TIP to the *booked* lead; the TIP only installs and a DSA never installs. Don't assign a TIP before booking, and don't weaken the "DSA-first flow" tests in `backend/test/leads.e2e-spec.ts` and `backend/test/dsa-flow.e2e-spec.ts`.
