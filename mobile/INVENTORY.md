# Connect Bhai app: screen and feature inventory

**Stage 0 (technical test), 2026-11-28, Android emulator (360 x 640 dp, Android 17), debug build, local API.**
At that time the screens were temporary test screens.

| Check | Result |
|---|---|
| Debug build installs and opens | Works |
| WhatsApp OTP login (local test code) | Works |
| Password login | Works (temporary local account, deleted afterwards); a wrong password shows the server's message |
| Login and language kept after restart; log out | Works |
| Hindi switch (website dictionaries) | Works on the test screens; some app-only texts have no Hindi yet |
| Payment, mock gateway (plan payment) | Works: invoice created and marked paid |
| Razorpay, test keys | Works: TIP install fee and customer plan paid and verified by the server; closing the window shows "Payment was cancelled." (netbanking only; cards, UPI and wallets not tried) |
| Speed test (hidden WebView, website's module and plan) | Works |
| Large phone (skipped on request), release build, iOS | Not verified |

To do in Stage 1: remove Android permissions the app does not need (the build lists microphone, storage and "draw over apps", among others); add Hindi for app-only texts; 1024 px app icon.


## Stage 1 status (2026-11-28, Android emulator 360 x 640 dp, debug build, local API, English)

Testing was stopped early at the owner's request. `Covered` = seen running. iOS: not verified for every row.

| Area | Covered | Not verified | Not done / not shown |
|---|---|---|---|
| Global | G1, G3, G4, G6, G7, G8 (dialog), G9, G14, G15, G20 | G5 (tap), G10, G11, G13, G16, G17, G18, G8 bar position after the last change | G21 (dashboards, later stage); G2, G12, G19 not applicable |
| Home | H1, H2, H3, H5 (no SIM plans locally), H7, H10, H11, H12, H14, H15, H16, H17, H21, H22 | H4 (permission prompt only), H6, H8 (pause / replay), H9 (changing filters / sort), H13, H18, H19 | H20 hidden (store rules) |
| Speed test | S1, S2 | S3 (saving a result), S4 | |
| Care plan | C1 (logged out, DSA), C3 (TIP) | C2 (only an unlinked connection seen), C3 (admin), C4, C5, C6 | |
| Text pages | L1 to L6 | | |
| Login and account | A1 (OTP login, password errors), A4, A5 (log in / out), A6 (customer) | A1 successful password login, A3, A5 after restart, A6 (DSA / TIP) | A2 hidden (live API refuses it) |

**Not verified at all in Stage 1:** Hindi on screen (dictionary tests pass), partner application submit, document upload and registration payment, offline screen, release build, large phone.

**Not shown on purpose:** "Get the app" section and links, "Admin" autofill chip, "Forgot password", demo / sample-data wording, Set ACS button.
**Added in the app:** My account (menu), Delete account, Take photo for documents, offline screen.

**Differences seen against the website (not fixed):** headings on text pages and the locked screen are smaller; footer links are lighter; dates show as "29 Nov 2026" in the native date picker field; the compare dialog names both plans; PIN suggestions are inline; dashboards are placeholders; the paging fallbacks for demo data are not ported.
**Fixed in the app during testing:** dialog under the status bar, logo touching the language switch, logo not returning to the top of Home.

**Android permissions kept:** location (fine, coarse), internet, network state, camera, plus NFC and basic phone state added by the Razorpay SDK.
**Web overflow at 360 px (website unchanged):** see section 13.

Source: `staging` at `f5aadfc`, read 2026-11-27. Reference = the approved mobile web view.
Row statuses are in "Stage 1 status" above; the iOS and Android columns below are filled in at later stages. Dashboard rows (D, U, P, T, M) are not built yet.

"Seen" column: `360` = opened at 360 px on the local dev site with the local API and checked for overflow (EN, and Hindi where noted). `code` = known from code only, not seen running.

Code locations: `ui` = `frontend/src/lib/connectbhai/ui.js` · `rest` = `.../connectbhai/rest.js` · `cmp` = `frontend/src/components`.

## 0. App plan: React Native (Expo, TypeScript)

Planned app-only differences from the web (for store approval; all payments stay in):
- Added: Delete account (customer, DSA, TIP).
- Not shown: H20 and the footer "Get the app" link; A1 "Admin" autofill chip; demo / sample-data / "coming soon" wording (G2, G6 footer note, H9 demo notice, H19); the refused actions in section 12, including TIP Plans (T7) and the plan sheet card in T1.
- Not applicable natively: G12 (cards are built directly), G19 old web links, search-engine files.
Sections 10 and 13 describe the web code; in the native app each device feature needs its own native handling.

## 1. Global (every screen)

| ID | Item | Source | Seen | iOS | Android |
|---|---|---|---|---|---|
| G1 | Trust strip: 4 promises (scrolls sideways), tap-to-call | cmp/TrustBar | 360 | | |
| G2 | Demo strip (hidden when the live API is set) | cmp/DemoBar | code | | |
| G3 | Header: animated logo (tap plays), EN/हिं, Log in, or name chip + role + Log out | cmp/Header, Logo | 360 | | |
| G4 | Hamburger menu: Plans, Care plan, Speed test, + own dashboard | cmp/Header | 360 | | |
| G5 | Floating Back button (all pages except home) | cmp/BackButton | 360 | | |
| G6 | Footer: customer links (scroll to section), My dashboard, contact, Facebook, Instagram, 5 legal links, © | cmp/Footer | 360 | | |
| G7 | Floating WhatsApp button + "Top" pill | cmp/FloatingActions | 360 | | |
| G8 | Floating Compare bar (1–3 plans) | cmp/CompareBar | 360 | | |
| G9 | Modal host (close ×, backdrop, Esc), toast messages | cmp/Overlays, ui | 360 | | |
| G10 | Loading skeletons, top progress bar, "Could not load… Try again" | ui, portal/parts | code | | |
| G11 | English / Hindi switch (saved), translates text, placeholders, labels, page title | lib/i18n | 360 | | |
| G12 | Tables become cards on phones | cmp/ResponsiveTables + CSS | 360 | | |
| G13 | Search + rows-per-page + pager: client side and server side | tableTools, serverTable, portal/paged | 360 | | |
| G14 | PIN field suggestions (from 3rd digit), multi-PIN chips, India Post hint, area autofill | pinSuggest, ui | code | | |
| G15 | Form rules: inline errors, phone clean-up (+91/0), "Please wait…", 30 s timeout | ui | code | | |
| G16 | Live refresh every 30 s and on return; chat every 10 s; unread badges | ui, useDashData, roleCounts | code | | |
| G17 | Entrance animations; reduced-motion respected | cmp/MotionRuntime, CSS | code | | |
| G18 | Signed-in DSA/TIP/Admin opening "/" goes to dashboard; "Go to website" (`?site=1`) shows home; opening cover | ui | code | | |
| G19 | Old links: `#my-bookings` style hashes, `/router` → `/care` | ConnectBhaiRuntime, next.config | code | | |
| G20 | Locked screen "Log in as <role> to open this page" | ui render | 360 | | |
| G21 | Unknown dashboard tab: "This page does not exist" | ui dashShell | 360 | | |

## 2. Public routes

### Home `/`
| ID | Item | Seen | iOS | Android |
|---|---|---|---|---|
| H1 | Hero, city picker (live / launching soon) | 360 EN+HI | | |
| H2 | Product tabs: Fiber, Air Fiber, SIM, TV, OTT | 360 EN+HI | | |
| H3 | PIN search, popular PIN chips, Reset | 360 | | |
| H4 | "Use my current location" (permission → PIN) | code | | |
| H5 | SIM: Prepaid / Postpaid, Show SIM plans | code | | |
| H6 | City not live: waiting-list form (name, WhatsApp, PIN, consent), done state, WhatsApp share, add another | code | | |
| H7 | Trust points; links to speed test and Care plan | 360 | | |
| H8 | Animated "story" with pause and replay; featured Care card | code | | |
| H9 | Results: filters (min speed, max price, OTT, TV, provider, reset), sort (price, speed, value) | 360 (list) | | |
| H10 | Plan cards by category; BSNL "Recommended"; OTT chips; empty states; Request a callback | 360 | | |
| H11 | Compare up to 3 → Compare dialog | 360 EN+HI | | |
| H12 | Request dialog (fiber / Air Fiber / OTT / callback): name, mobile, PIN, area, email, address, pin location, date, consent | 360 | | |
| H13 | SIM booking dialog: new/port, for whom, port number + operator, number ending, delivery slot, KYC choice, BSNL KYC link, consent | code | | |
| H14 | WhatsApp OTP step (6 boxes, paste, resend in 30 s, change number) → "Request submitted" | code | | |
| H15 | How it works (4 steps) | code | | |
| H16 | Madhya Pradesh cities: chips, Show all districts | code | | |
| H17 | Care plan teaser section | code | | |
| H18 | DSA/TIP application: type, name, firm, mobile, email, city, service PINs, address, PIN, Aadhaar, PAN, GSTIN, bank, account, IFSC, 3 document uploads (image shrink, Cloudinary) | code | | |
| H19 | After applying: DSA "Registration received"; TIP fee dialog → payment → receipt, auto login | code | | |
| H20 | "Get the app" section (store buttons "coming soon", QR) — see question on store rules | code | | |
| H21 | FAQ: 6 topic tabs, accordion, Call / WhatsApp | code | | |
| H22 | About: 4 steps, areas served, links | code | | |

### Speed test `/speed`
| ID | Item | Seen | iOS | Android |
|---|---|---|---|---|
| S1 | Dial / button start; ping, download, upload, jitter (Cloudflare module 1.3.0 from CDN) | 360 (idle only) | | |
| S2 | Quality label; 4 "What can you do" cards | 360 (idle) | | |
| S3 | Logged in: choose connection, auto-save result | code | | |
| S4 | Report slow speed → complaint dialog; log-in prompt | code | | |

### Care plan `/care`
| ID | Item | Seen | iOS | Android |
|---|---|---|---|---|
| C1 | Logged out / DSA: intro, 3 steps, 6 features, Log in | 360 (logged out) | | |
| C2 | Customer: router cards (status, signal, Wi-Fi, restarts, history), Refresh, Restart, Wi-Fi change, line test, Raise complaint | code | | |
| C3 | TIP/Admin: KPIs, areas with outage warning, filter chips, searchable modem list | 360 (admin) | | |
| C4 | Admin: Genie setup card + dialog | 360 | | |
| C5 | Zabbix ONU card: Online/Offline, serial, Refresh, complaint | code | | |
| C6 | Live step-by-step progress for restart / Wi-Fi change / router test | code | | |

### Text pages
| ID | Route | Seen | iOS | Android |
|---|---|---|---|---|
| L1 | `/privacy` | 360 | | |
| L2 | `/terms` (same layout as privacy) | code | | |
| L3 | `/refund` | code | | |
| L4 | `/shipping` | code | | |
| L5 | `/delete-account` (instructions only) | 360 | | |
| L6 | Page not found | 360 | | |

Not app screens: `/ui-kit` (internal preview), robots/sitemap/manifest/llms.txt (search engines).

## 3. Login and account
| ID | Item | Seen | iOS | Android |
|---|---|---|---|---|
| A1 | Login dialog: Mobile + password / WhatsApp OTP; "Admin" autofill chip | 360 EN+HI | | |
| A2 | Forgot password (OTP → new password; live API replies it is not available) | code | | |
| A3 | Set name on first login; set / change password dialog (live API: message only) | code | | |
| A4 | Edit name / email dialog | 360 | | |
| A5 | Stay logged in, token refresh, Log out | code | | |
| A6 | Delete account: API and `rest.deleteMyAccount()` exist; **no web button** (see question) | code | | |

## 4. Dashboard frame (all 4 roles)
| ID | Item | Source | Seen | iOS | Android |
|---|---|---|---|---|---|
| D1 | Top bar: logo (to website), search icon → results per role, WhatsApp, EN/हिं, bell with unread, account menu | dashboard/Topbar, search | 360 | | |
| D2 | Account menu: TIP "Payments to Connect Bhai", Go to website, Log out | Topbar | code | | |
| D3 | Bottom bar: first 4 tabs + More sheet with all tabs; dots and badges | BottomNav | 360 | | |

## 5. Customer `/my`
| ID | Screen / feature | Seen | iOS | Android |
|---|---|---|---|---|
| U1 | `/my`, `/my/bookings`: greeting, New connection / Find plans, booking card with 5-step tracker, telephone and order no. | 360 EN+HI | | |
| U2 | Pay plan on booking card; agent and installer Call / WhatsApp | code | | |
| U3 | Past requests list, View details (`?ref=`) | code | | |
| U4 | Router card: status, speed, signal, Restart, Change Wi-Fi, live progress; Zabbix variant | 360 | | |
| U5 | Payments-due card, Speed test card | 360 | | |
| U6 | Old tabs frame: header buttons (Care plan, Speed test, Pay now, New connection), 4 contact cards, tab strip | 360 | | |
| U7 | `/my/support`: ticket list, raise complaint / service request | 360 EN+HI | | |
| U8 | `/my/devices`: Care plan (router facts, restart, Wi-Fi) | 360 (empty) | | |
| U9 | `/my/payments`: Pay your plan, due/paid totals, charge list, Pay → Razorpay → receipt | 360 (no payment made) | | |
| U10 | `/my/chat`: threads, messages, send; chat dialog | 360 | | |

## 6. DSA `/dsa`
| ID | Screen / feature | Seen | iOS | Android |
|---|---|---|---|---|
| P1 | Home: service PINs, 4 KPI links, lead pipeline (7), leads to call today, commission tiles, payout history, Care card | 360 EN+HI | | |
| P2 | `/dsa/careplan`: devices list, search, filter, actions | 360 (empty) | | |
| P3 | `/dsa/leads`: KPIs, 8 filters, paged table, Add lead dialog (plan list by PIN, consent) | 360 EN+HI | | |
| P4 | Lead dialog: details, map link, contacts, group chat, status update form, history, payment line | 360 | | |
| P5 | Schedule booking; Assign / Change TIP (telephone no. + order no.); Mark SIM/pack activated (live API: message); Make connection (BSNL portal) | 360 (assign) | | |
| P6 | `/dsa/installs` | 360 | | |
| P7 | `/dsa/customers`: paged list with commission chip | 360 EN+HI | | |
| P8 | `/dsa/commission` | 360 | | |
| P9 | `/dsa/tickets` (conversations) | 360 | | |
| P10 | `/dsa/chat`; `/dsa/payments` | 360 | | |
| P11 | Pending / suspended activation card | code | | |

## 7. TIP `/tip`
| ID | Screen / feature | Seen | iOS | Android |
|---|---|---|---|---|
| T1 | Home: 4 KPI links, chart (3/6/12 months), plan sheet upload + template, recent uploads, installs this week, open tickets, leads given, amount paid, Care card | 360 EN+HI | | |
| T2 | `/tip/careplan` | 360 (empty) | | |
| T3 | `/tip/leads`: filters, search, pager; Call/WA, Update/Details, Add Care plan (payment), Schedule booking, Install, Mark paid, Manage modem | 360 EN+HI | | |
| T4 | `/tip/bookings`, `/tip/customers` → Leads with filter set | code | | |
| T5 | Update installation dialog (status, connection ref, ONT serial) | 360 | | |
| T6 | `/tip/payments`: due/paid, paged charges, Pay | 360 | | |
| T7 | `/tip/plans`: submit plan, upload sheet (preview table), download template, submissions, live plans (live API: empty + message) | 360 | | |
| T8 | `/tip/tickets`: list + Update ticket dialog | 360 HI only | | |
| T9 | `/tip/chat` | 360 HI only | | |
| T10 | Activation card: pay registration fee | code | | |

## 8. Admin `/admin`
| ID | Tab: features and dialogs | Seen | iOS | Android |
|---|---|---|---|---|
| M1 | Overview: 6 KPI links, waiting leads (Assign DSA), applications (Approve / Reject), chart, top 4 areas, cities, Care card | 360 EN+HI | | |
| M2 | Care plan: Fetch routers; Genie and Zabbix tabs; Link modem; Buy Care plan; devices table with Refresh, Router test, Restart, Wi-Fi + progress popups | 360 (empty) | | |
| M3 | Leads: auto-assign switch, areas card, area and status filters, table; View/Open, Assign/Reassign DSA, Assign TIP, Edit, Delete, Buy Care plan, Book, Install, Make connection | 360 EN+HI | | |
| M4 | Customers: Customers / TIPs / DSA agents lists; View; Disable/Enable | 360 EN+HI | | |
| M5 | DSA & TIP: pending filter, type chips, Add, Edit (+ KYC documents), Approve, Suspend, Activate, Delete | 360 EN+HI | | |
| M6 | Team & logins: role chips, Create login, Reset password, Disable/Enable (create/reset: live API message) | 360 | | |
| M7 | Providers: list, Add/Edit, Hide/Show | 360 | | |
| M8 | Plans: category chips, Add/Edit, Publish/Hide, Download sheet, Import sheet (live API: message), review queue | 360 | | |
| M9 | Locations: Add PIN/area (+ sheet upload, sample sheet), Add coverage, Rename, Delete, Remove coverage | 360 | | |
| M10 | Cities & waiting list: KPIs, table, Add city, Launch dialog, Hide/Show, waiting list + filter | 360 | | |
| M11 | Billing & fees: KPIs, Create charge (customer search), status chips, Mark paid offline, Waive; GST/TDS breakdown | 360 | | |
| M12 | DSA payouts: Ready to pay, Record payout, Approve/Reject | 360 (little data) | | |
| M13 | Payout history | 360 (empty) | | |
| M14 | Chat | 360 | | |
| M15 | WhatsApp log | 360 | | |
| M16 | Reports: money KPIs, 2 charts, performance table, funnel, bars | 360 EN+HI | | |
| M17 | Settings: fees form (7), auto-assign | 360 | | |
| M18 | Generic row "View" dialog on admin tables; browser confirm boxes (delete lead/partner/area, suspend, reset) | code | | |

## 9. Leaves the app (must open the right native app or browser)
`tel:` · `wa.me` (incl. share) · `mailto:` · Google Maps search · BSNL portal "Make connection" · BSNL self-KYC · Facebook / Instagram · KYC document links · plan source links · Razorpay checkout and UPI apps.

## 10. Device features the web code relies on
Geolocation · file picker (KYC photo/PDF, .xlsx/.csv) · image shrink via canvas · `.xlsx` unzip via `DecompressionStream` · CSV download via blob link (**will not work in a WebView as is**) · clipboard copy · `confirm()` · `localStorage`/`sessionStorage` (tokens, language, city, speed history) · CDN scripts (speed test, Razorpay) · hardware Back (Android) · safe areas.

## 11. API calls (from `rest.js`, prefix `/api/v1`)
- Auth/user: `POST auth/otp/request|verify`, `auth/login`, `auth/refresh`; `GET|PATCH|DELETE users/me`; `GET users`, `users/:id`, `users/:id/documents`; `PATCH users/:id`, `users/:id/partner-status`, `users/:id/active`; `DELETE users/:id`; `POST partners/register`
- Public/catalogue: `GET plans`, `plan-categories`, `pincodes/:pin`, `cities`, `cities/:id/areas`, `locations/pincode/:pin`, `locations/pincodes`, `locations/reverse`, `settings/public`; `POST waitlist`; `POST plans`, `plan-categories`; `PATCH plans/:id`, `plan-categories/:id`
- Leads/bookings: `POST|GET leads`, `GET leads/:id`, `leads/:id/events`, `leads/:id/tip-options`; `PATCH leads/:id`, `leads/:id/status`, `leads/:id/assign`; `DELETE leads/:id`; `POST|GET bookings`, `GET|PATCH bookings/:id`, `POST bookings/:id/start|complete`
- Money: `GET charges`, `charges/:id`; `POST charges`, `charges/customer`, `charges/care-plan`, `charges/:id/pay|mock-pay|verify|offline|waive|cancel`, `leads/:id/payment/offline`; `GET commissions`; `POST commissions/:id/approve|pay|cancel`; `GET|PUT settings`, `settings/partner`
- Support/chat: `POST|GET tickets`, `PATCH tickets/:id`; `GET chat/threads`, `chat/:type/:id/messages`; `POST …/messages`, `…/read`
- Care plan: `GET care-plan/devices`, `devices/:id`, `summary`, `acs-devices`, `link-candidates`; `POST devices/:id/refresh|actions|speed-test`, `care-plan/poll`; `PATCH devices/:id`
- Admin/other: `GET reports/dashboard|badges|partners|money|payables|customers`, `notifications`, `waitlist`, `waitlist/summary`; `POST waitlist/notify/:id`, `cities`, `cities/:id/areas[/bulk]`, `admin/tip-pincodes`, `uploads/sign`; `PATCH cities/:id`, `areas/:id`; `DELETE areas/:id`, `admin/tip-pincodes/:id`; upload goes straight to Cloudinary

## 12. Behaves this way on the web with the live API (app should match, not count as app bugs)
Change/reset password, create team login, admin "Add DSA / TIP" save, bulk plan import, TIP plan upload/submit, plan review, SIM/OTT activation, Genie save: message only. Cities table shows 0 for partners and PIN codes. "3+ restarts" filter is empty.

## 13. Web mobile spots to check later (web NOT changed; fix in app only)
Measured at 360 px, local data (only 2 leads, so long real data could show more).
1. Logged-in header on `/`, `/speed`, `/care`: menu button 2 px past the edge in English, 5 px in Hindi; page scrolls sideways. Seen with admin and customer logins.
2. Admin → Locations → "Add PIN / area" dialog: content 8 px wider than the dialog.
3. Home in Hindi: "एयर फाइबर" tab text 6 px wider than its tab.
4. DSA My customers and TIP Leads: plan name cut with "…" ("BSNL Fibre Budget 30 Mbps").
5. Top trust strip: second item cut mid-word at the edge (it scrolls sideways, may be intended).

Not checked: 320 px, real phones, rows marked `code`, populated Care plan / payouts, long chats.

Other things noticed on the web (not changed):
- Admin Overview "Reject" on an application asks "Suspend this account?" (`AdminDashboard.jsx` sends `rejected`, handled as suspend).
- `/delete-account` tells people to call or WhatsApp, while the API supports self-delete.
- FAQ "Are only trusted providers shown?" has a stray ")" (`faqData.js`).
