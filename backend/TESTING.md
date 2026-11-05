# ConnectBhai testing guide

**616 automated tests, all passing** (58 unit + 558 end-to-end), on a real MySQL database.

## Run them

```bash
cd backend
npm test            # unit tests (no database), about 1 second
npm run test:e2e    # end-to-end: rebuilds the connectbhai_test database, seeds it, then calls the real API over HTTP
npm run test:all    # both
```

- End-to-end tests use the separate `connectbhai_test` database (`.env.test`). Your `connectbhai` dev data is never touched; the runner refuses any database not ending in `_test`.
- Nothing calls the internet: India Post, the geocoder and Cloudinary are mocked, and `AISENSY_API_KEY` is empty in `.env.test` so tests can never send a WhatsApp message.
- Rate limiting is switched off in tests (`THROTTLE_ENABLED=false`) except in the dedicated throttle suite.

## What is covered

### End-to-end (558 tests)

| Suite | Tests | Covers |
|---|---|---|
| `auth` | 12 | OTP + password login, lockouts, refresh tokens, disabled/pending accounts |
| `bookings` | 10 | scheduling, completion (commission + install fee + Care Plan in one transaction), cancellation |
| `care-plan` | 8 | modem devices, actions, speed tests |
| `catalogue` | 9 | plans, categories, OTT apps, filters, admin edits |
| `commissions` | 4 | DSA payout approve/pay/cancel |
| `frontend-integration` | 15 | phone-only login, public settings, mock pay, inbox, charge creation, location reverse-geocode, PIN lookup |
| `health` | 4 | liveness / readiness (MySQL) |
| `leads` | 21 | create, track, status transitions, assignment, notes, scoping |
| `locations` | 7 | cities, areas, PIN checks, admin location management |
| `pagination-search` | 19 | limits, walking all pages, search on all fields, filters, no cross-user leaks |
| `partners` | 12 | DSA/TIP registration, approval, suspension, encrypted KYC fields |
| `payments` | 15 | charges, GST split, Razorpay order/verify/webhook, offline, waive, Care Plan purchase |
| `pincodes` | 7 | India Post: multi-PIN lookup, cache, fallback, admin import |
| `platform` | 9 | waitlist, settings, notifications, reports |
| `rbac-matrix` | 335 | every protected route x every role (401 / 403 / allowed), public routes, bad tokens |
| `search-cases` | 14 | the 12 plan-search cases from your Excel sheet (budget before GST) |
| `security` | 26 | headers, body limits, injection attempts, token abuse, cross-role access |
| `support` | 11 | tickets and chat |
| `throttle` | 2 | rate limits (OTP, public endpoints) |
| `uploads` | 17 | Cloudinary: signing rules, forged-upload rejection, KYC at registration, admin document links |

### Unit (58 tests)

| File | Tests |
|---|---|
| `src/care-plan/genieacs.provider.spec.ts` | 3 |
| `src/common/guards/guards.spec.ts` | 6 |
| `src/common/utils/crypto.spec.ts` | 6 |
| `src/common/utils/money.spec.ts` | 6 |
| `src/common/utils/phone.spec.ts` | 10 |
| `src/config/env.validation.spec.ts` | 4 |
| `src/leads/leads.transitions.spec.ts` | 4 |
| `src/payments/razorpay.service.spec.ts` | 4 |
| `src/common/utils/asset-url.spec.ts` | 5 |
| `src/uploads/uploads.service.spec.ts` | 9 |

## The role matrix

`rbac-matrix.e2e-spec.ts` lists every protected route with the roles allowed to call it, then checks all four roles plus anonymous:
no login gives 401, a role that is not allowed gives 403, an allowed role gets through. It uses ids that do not exist and empty bodies, so it tests the guards without changing data.
When you add a route, add one line to that table.

## Business rules that are pinned by tests

- GST is CGST+SGST for the home state (23) and IGST otherwise; invoices are numbered `CB-INV-######` and a repeated payment webhook changes nothing.
- A DSA is paid once per installed lead, never on lost or cancelled leads; a TIP pays one install fee per lead; the internal Connect Bhai TIP pays none.
- Budgets in plan search are the price **before GST**, exactly as in the plan sheet (all 12 sheet cases pass).
- KYC documents must be genuine Cloudinary uploads from the KYC folder (signature re-checked on our server); they are private and admin links expire after 10 minutes.
- No user can read another user's leads, charges, tickets or chat.

## Not covered (be aware)

- **Real third-party services.** Cloudinary, India Post, Razorpay (live keys), AiSensy and GenieACS are tested against mocks or their mock mode. Try each once with real keys on staging before go-live.
- **The website (frontend).** There is no automated browser test suite yet; the web screens were checked by hand in a browser. The next step would be Playwright tests for login, search, request a connection, install and pay.
- **Load and performance.** No load test has been run.
- **The Cloudinary signing algorithm** is tested against an independent SHA-1 of the documented format, not against Cloudinary's servers.
