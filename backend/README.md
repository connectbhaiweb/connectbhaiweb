# ConnectBhai API

NestJS 11 + Prisma 6 + MySQL 8. Prefix `/api/v1`. Health: `GET /health`, `GET /health/ready`.

## Run (local)
```bash
cp .env.example .env          # edit if needed
npm install
npm run db:setup              # creates DB, runs migrations, loads sample data (plans, PINs, TIPs, DSAs, demo leads)
npm run start:dev             # http://localhost:4000/api/v1   (Swagger: /docs when SWAGGER_ENABLED=true)
```
From the repo root, `npm run dev` starts API (4000) and web (3000) together.

## Login (dev)
| Who | How |
|---|---|
| Admin | `POST /auth/login` `{phone: 9999999999, password: Admin@12345, role: admin}` |
| DSA / TIP / customer | `POST /auth/otp/request` then `/auth/otp/verify`. With `OTP_DEV_CODE=123456` every OTP is `123456` (refused in production). |
Seeded: DSAs `9000000001…`, TIPs `9100000001…` (DREAM, DOULAT…), internal Connect Bhai TIP `9000000000`.

## Config (best practice)
All config is in env, validated at boot (`src/config/env.validation.ts`) — the app refuses to start with a bad config. Production additionally refuses placeholder JWT secrets, an all-zero `DATA_ENCRYPTION_KEY` and `OTP_DEV_CODE`. Fees, payout and GST seed into the `app_settings` table; admin can change them live (`PUT /settings/:key`) — **DB value wins over env**.

## Deploy
```bash
npm ci && npm run build
npx prisma migrate deploy     # applies committed migrations only; never `migrate dev` in prod
npm run start:prod
```
Set `APP_ENV=production`, real secrets, `FRONTEND_URL`, `RAZORPAY_*`, `WHATSAPP_*`, `GENIEACS_*`. Put it behind HTTPS / a reverse proxy (`trust proxy` is on). Point Razorpay's webhook at `POST /api/v1/payments/razorpay/webhook`.

## Tests
```bash
npm test            # unit (money/GST, crypto, guards, env validation, Razorpay, GenieACS mock)
npm run test:e2e    # recreates connectbhai_test, migrates + seeds it, runs every endpoint over HTTP
npm run test:all
```
e2e refuses to run against any database not ending in `_test`.

## Business rules enforced in code
- DSA only brings leads. Sees only own leads (read-only status), earns a flat `dsa_payout_per_lead` **only when installed**, one per lead.
- TIP pays onboarding (at registration) + install fee (per install) + Care Plan (per lead) — all with GST (CGST+SGST for state 23, else IGST). Connect Bhai's internal TIP is exempt from the install fee.
- Installation completes in one DB transaction (lead, booking, DSA payout, TIP charge, Care Plan device).
- Care Plan: one Razorpay payment covers many leads; the webhook flips `leads.care_plan` for all of them; GenieACS polls only active devices.
- Payments: HMAC-verified checkout + webhook (raw body), idempotent settlement, unique invoice numbers.

## Differences from `ConnectBhai MySQL Schema.md`
- `charges.install_fee_key` is a plain nullable column set by the app (= `lead_id` for a live install fee) with a UNIQUE index, instead of a MySQL generated column. Same guarantee, and Prisma-native.
- Plan `price` stores the GST-inclusive monthly price; the ex-GST price is in `benefits.price_ex_gst`.

## Frontend integration

The Next.js app talks to this API when `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`
(copy it from `frontend/.env.example`). Without it the app falls back to its old in-browser demo data.

- Data layer: `frontend/src/lib/connectbhai/rest.js` (same method names as the old demo layer, so every screen works unchanged).
- Login: the web screen is phone-only, so `role` is optional on `/auth/otp/*` and `/auth/login`. The most privileged account on that number wins (admin, tip, dsa, customer).
- Dev payments: with no Razorpay keys the browser cannot sign a payment, so it calls `POST /charges/:id/mock-pay` (blocked in production and whenever keys are set).
- Extra endpoints added for the app: `GET /settings/public`, `GET /chat/threads`, `POST /charges` (admin), `POST /charges/customer`.
- **Is MySQL running?** Check `http://localhost:4000/health/ready`.
  To browse tables run `npm run db:studio` (Prisma Studio on http://localhost:5555).
- Not carried over (the new schema intentionally has no zones, providers per area, price-sheet uploads, per-TIP ACS): those admin sections show empty lists or a clear message.

## Uploads (Cloudinary) and PIN codes

**All uploads go to Cloudinary** (KYC documents, ticket and chat attachments, logos, price sheets). Set these in `.env` (from Cloudinary dashboard, Settings, API Keys):

```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...      # server only, never sent to the browser
UPLOAD_MAX_MB=5
```

- The browser asks `POST /uploads/sign {purpose}` for a signed request, then uploads the file straight to Cloudinary. Purposes: `kyc` (public form, private file), `ticket`, `chat` (login), `logo`, `sheet` (admin / TIP).
- Personal documents are stored with Cloudinary `type=authenticated` (not publicly reachable). We keep only the `public_id`/version in `users.docs`.
- Partner registration re-verifies Cloudinary's signature for each KYC file, so a made-up file reference is rejected. With keys set, Aadhaar, PAN and bank proof are required.
- Admin opens them with `GET /users/:id/documents` (links expire in 10 minutes). The DSA & TIP details dialog shows them.
- Production refuses to start without the three Cloudinary values. In development without keys, uploads say "not configured" and registration works without files.

**PIN codes** are checked against the India Post directory (`PINCODE_API_URL`, cached 24 h, falls back to our own areas if India Post is down):
`GET /locations/pincode/:pin`, `GET /locations/pincodes?codes=452010,452016` (up to 10), and admin `POST /admin/pincodes/import {city_id, pincodes[]}` adds their post offices as areas.

**Image URLs come from env.** The database stores only the Cloudinary path (e.g. `v1793905280/connectbhai/logos/bsnl.svg` in `plan_categories.logo_url`). The API turns every `logo_url` into a full URL using `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_DELIVERY_URL` (default `https://res.cloudinary.com`; set it to your own domain/CDN if you add one). `CLOUDINARY_API_URL` is the upload/download API host. Changing account or host needs no data migration. Re-upload the provider logos with `npm run logos:upload`.

See `TESTING.md` for the test guide (616 tests).

## Deploying

See `DEPLOYMENT.md` (portable Docker image; works on any host). `backend/.production.env` is a generated, git-ignored block of production variables with fresh secrets.
