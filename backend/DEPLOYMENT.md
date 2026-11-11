# Deploying the ConnectBhai API

The API ships as a normal Docker image, so it runs the same on Railway, Render, Fly.io, AWS (ECS / App Runner), a VPS, or your own machine. Nothing in the code or config is specific to one host.

## What you need

1. **A MySQL 8+ database** (managed MySQL from your host, or your own). You only need its connection string.
2. **The API container** built from `backend/Dockerfile`.
3. **Environment variables** (below). A ready-made block with fresh secrets is generated at `backend/.production.env` (git-ignored; never commit it).

## Start-up (automatic)

The container runs `npm run start:deploy`, which does three things in order:

1. `prisma migrate deploy`: applies any new database migrations (safe to run on every start).
2. `node scripts/seed-if-empty.js`: loads the reference data (cities, areas, plans, OTT apps, pincode mappings, the admin login) **only if the database has no plans yet**. No demo customers, leads, bookings, payments, tickets or chat are created. It only adds missing data and skips on every later start, so live data is never touched.
3. `node dist/main.js`: starts the API on `$PORT` (default 4000).

Health checks: `GET /health` (is the process up) and `GET /health/ready` (also checks MySQL). Point your host's health check at `/health/ready`.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `APP_ENV` | yes | `production`. Turns on the safety checks below |
| `DATABASE_URL` | yes | `mysql://USER:PASSWORD@HOST:3306/DATABASE` (URL-encode special characters in the password) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | yes | long random values, different from each other |
| `DATA_ENCRYPTION_KEY` | yes | 64 hex characters. **Back it up: losing it makes stored Aadhaar/PAN/bank numbers unreadable** |
| `FRONTEND_URL` | yes | the website's address; the API allows browser calls only from this origin |
| `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD` | first start | admin login. Production refuses a password shorter than 12 characters or the dev default |
| `SEED_SAMPLE_PARTNERS` | no | `true` loads the 21 TIPs / 16 DSAs from the sample sheets (fake phones). Set `false` on a live system: only the admin and the internal Connect Bhai TIP are created |
| `SEED_DEMO_PASSWORD` | no | staging only: 10+ chars. Gives one sample DSA (`9000000001`) and TIP (`9100000001`) a password so they can be tried without a WhatsApp OTP (the sample phones are fake). Applied at each start; remove it on a live system |
| `GST_HOME_STATE_CODE` | no | state code for the CGST+SGST / IGST split (default `23`). Fees, GST % and auto-assign are not env settings: they live in the `app_settings` table and the admin changes them in the app (Admin > Billing) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | yes | all uploads. Production refuses to start without them |
| `CLOUDINARY_DELIVERY_URL`, `CLOUDINARY_API_URL` | no | defaults to Cloudinary's hosts; change for a custom domain / CDN |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | for payments | without them online payments answer "not configured" in production |
| `AISENSY_API_KEY` | for WhatsApp | without it messages are only logged |
| `PAYMENT_REMINDER_MINUTES` | no | minutes after a TIP registers before the unpaid-payment WhatsApp reminder (default 30) |
| `FEEDBACK_DELAY_HOURS` | no | hours after installation before the feedback WhatsApp is sent (default 24) |
| `PORT` | no | most hosts set this for you |

Production safety checks (the app refuses to start): placeholder JWT secrets, an all-zero encryption key, a dev OTP code, or missing Cloudinary keys. `OTP_DEV_CODE` must be empty. API docs (`/docs`) are not served in production.

## Run it

```bash
cd backend
docker build -t connectbhai-api .
docker run --env-file .production.env -p 4000:4000 connectbhai-api
curl http://localhost:4000/health/ready      # {"status":"ready","database":"up"}
```

On a hosting platform: create a service from the repository with root directory `backend` (it detects the Dockerfile), attach or point to a MySQL database, give it the variables above, and set the health check path to `/health/ready`.

## After deploying

- Log in as admin with `SEED_ADMIN_PHONE` / `SEED_ADMIN_PASSWORD`, then change the password policy in your process (admin password changes are done by the system owner).
- Deploy the website (`frontend`) with `NEXT_PUBLIC_API_URL=https://YOUR-API-HOST/api/v1`, then set the API's `FRONTEND_URL` to the website address and redeploy the API.
- Add the Razorpay webhook (`POST /api/v1/payments/razorpay/webhook`) in the Razorpay dashboard and set `RAZORPAY_WEBHOOK_SECRET`.
- Take regular MySQL backups; they hold all business data.

## WhatsApp messages (AiSensy)

All messages go through one map: `src/notifications/whatsapp-campaigns.ts`. It lists, for each message, the AiSensy campaign name and what fills `{{1}} {{2}} ...`. To add a message, create the API campaign in AiSensy, add one line to that file and call `notify.send({ template, phone, payload })`. Campaign names must match AiSensy exactly. A message with no entry is only recorded (status `queued`), never sent.

| When | Message key | AiSensy campaign |
|---|---|---|
| Login code | `otp` | `connectbhai_otp_1` |
| Customer request received | `lead_received` | `Lead Confirm` |
| Lead becomes follow-up (status change, or an installation is cancelled) | `lead_followup` | `Connect Bhai_leadfollowup` |
| Lead is approved and the installation is booked (once per lead; tapping Start later does not repeat it) | `installation_in_progress` | `Connect Bhai_installation WIP` |
| Installation completed | `installed` | `Connect Bhai_activated` (the `welcome` message is defined but not sent) |
| A TIP or customer has an unpaid charge: sent at once when admin raises a bill; otherwise once, 30 minutes after the charge was created (`PAYMENT_REMINDER_MINUTES`), for charges from the last 7 days (TIP registration fee, Care Plan fee, a payment the customer started) | `payment_due` | `Connect Bhai testing_payment` |
| Installation completed (to the TIP) | `install_fee_due` | `Connect Bhai testing_payment` (due date = 7 days) |
| Customer raises a ticket | `complaint_registered` | `BSNL Indore_complaint` (expected: within 24 hours) |
| 24 hours after installation (`FEEDBACK_DELAY_HOURS`), once per customer, only for installs from the last 3 days | `installation_feedback` | `Connect Bhai testing campaign` |

## Background jobs

A form (connection request, DSA / TIP application, ticket, payment) answers as soon as its data is saved. Everything else, such as the WhatsApp messages, runs afterwards in a small in-process job queue (`src/common/jobs/jobs.service.ts`): four at a time, a network error or a 5xx from AiSensy is retried twice, and a failing job can never break the request. On shutdown the queue gets five seconds to finish. Because the queue lives inside the API process, a message that is still waiting at the instant the server is killed can be lost; the message log (status `queued`) shows it.
