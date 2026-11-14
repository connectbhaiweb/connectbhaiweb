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
| root | `package.json` runs backend + frontend together; `docker-compose.yml`; `ConnectBhai Mobile App Plan.md` |

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
- `mobile/.env`: `EXPO_PUBLIC_API_URL`.
- Dev logins: OTP `123456`. Backend admin `9999999999` / `Admin@12345`. Frontend demo: `9876500001` customer · `…101` DSA · `…201` TIP · `…999` admin, password `Demo@1234`.

## Frontend architecture
- `src/app/` one `page.js` per route; CSS: `globals.css` (original, keep as is), `dashboard.css`, `customer.css`, `portal.css`.
- `src/lib/connectbhai/`: `api.js` (demo data layer, **off-limits**), `rest.js` (REST layer, same method names), `ui.js` (legacy string-template views writing into `<main id="app">`), `config.js`, `shared.js`, `runtime.js`.
- React dashboards: `components/dashboard/*` (shell, nav in `nav.js`), `components/customer/*`, `components/portal/*` (DSA/TIP/Admin, Recharts), `components/speed/*`.
- Plugging a React page in: add the view/tab to `REACT_VIEWS` in `ui.js`; the page reloads on the `cb:render` event (`useDashData.js`). Buttons reuse existing handlers via `data-act` / `data-go` — don't duplicate business logic.
- Tailwind only scans `components/ui`, `components/magicui`, `components/speed`, `app/ui-kit`.

## Lead flow: DSA first, TIP only installs (do not break)
1. **New leads go to a DSA.** Auto-assign (setting `auto_assign`) picks the approved, active DSA serving the lead's PIN code (`dsa_pincode_mapping`) with the fewest open leads; if none serves it, the lead waits for admin. Admin assigns / reassigns a DSA with `PATCH /leads/:id/assign {dsa_user_id}` (admin only, until the lead is booked). A DSA's own leads stay theirs. The DSA is `leads.brought_by_user_id` (drives the DSA dashboard, reports and the install payout). A DSA's PIN codes are set at registration or by admin (partner Edit, `PATCH /users/:id {service_pincodes}`).
2. **The DSA works the lead:** contacts, follows up, marks lost (`PATCH /leads/:id/status`) and **books** it (`POST /bookings`). A booking may exist with **no TIP** (`bookings.tip_user_id` is nullable).
3. **Then admin or the lead's DSA assigns a TIP to the booked lead** (`PATCH /leads/:id/assign {tip_user_id}`, only while the lead is `scheduled`; `GET /leads/:id/tip-options` lists TIPs, those covering the PIN first). It sets `leads.tip_user_id` and the open booking's TIP, can change until installed, and tells the TIP (and the customer, once).
4. **The TIP only installs:** `POST /bookings/:id/start|complete` is for the assigned TIP or admin, never the DSA, and needs a TIP on the booking. Install pays the DSA payout to the lead's DSA and charges the TIP.
- Leads that were already with a TIP before this flow (status new / contacted / followup) are left as they are: that TIP can still contact, follow up and book them.
- "Assigned" is a **UI-only** status: `rest.js` shows a server `new` lead that has a DSA (or, on an old lead, a TIP) as `assigned`. Filters: `status=new&unassigned=1` (no DSA, no TIP) / `status=new&assigned=1`. The API has no `assigned` status.
- The lead carries its latest booking (`bookings[0]`); a Booked lead shows **Install** to its TIP, and **Assign TIP** to its DSA / admin.

## Admin edit / delete (any status)
Admin can edit and delete leads and DSA/TIP partners in **any** status: `PATCH|DELETE /leads/:id`, `PATCH|DELETE /users/:id` (`leads.service.adminUpdate/adminDelete`, `users.service.updatePartner/deletePartner`). Deletes are one transaction: a lead takes its bookings, payout, modem and chat with it (invoices stay, unlinked); a partner's leads stay (DSA/TIP cleared) while their bookings, payouts, charges, tickets and messages go. Connect Bhai's internal TIP cannot be deleted. The status machine and the assign locks above are **not** relaxed. The partner Edit dialog saves name, firm, mobile, email, address, PIN only (per-install amount and lead target are global settings).

## Backend
Modules in `src/<feature>/` (auth, leads, bookings, payments, care-plan, commissions, plans, settings, tickets, chat, …). Business rules (DSA payout, TIP fees + GST, Care Plan, Razorpay HMAC/idempotency) live in code and are covered by tests — see `backend/README.md`. `app_settings` DB values override env.

## Mobile
Routes in `src/app/` (`_layout.tsx` = navigators); non-route code in `src/components`, `src/lib`. Never hand-edit `ios/`/`android/`. Check versioned Expo docs before using any API.

## Rules for Claude
1. Next 16 and Expo 58 differ from training data — read the versioned docs first.
2. No code, file, structure or flow change without the user's explicit "yes / go ahead". Plan (3–5 lines) + questions first.
3. No new dependency without asking.
4. Read only files relevant to the task; show diffs, not whole files.
5. Keep existing naming, flow and architecture.
6. Before done: frontend `npm run lint`; backend `typecheck` + `test`; mobile lint + `tsc --noEmit`.
7. Update this file when a change makes it outdated.
8. **Keep the lead flow DSA-first** (see "Lead flow"): leads go to a DSA; the DSA contacts, follows up and books; admin or the DSA then assigns a TIP to the *booked* lead; the TIP only installs and a DSA never installs. Don't assign a TIP before booking, and don't weaken the "DSA-first flow" tests in `backend/test/leads.e2e-spec.ts` and `backend/test/dsa-flow.e2e-spec.ts`.
