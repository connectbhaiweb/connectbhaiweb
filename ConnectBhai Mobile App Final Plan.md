# ConnectBhai Mobile App: iOS and Android Plan

## Goal and scope

Build one fully working, production-ready ConnectBhai app for iOS and Android from a single React Native codebase, with a download under 25 MB, that passes App Store and Google Play review on the first submission.

- **Roles:** Customer, DSA, TIP partner and Admin, all in one app. The server decides the role at login and enforces permissions.
- **Backend:** unchanged. The app uses the same REST API (`/api/v1`), tokens and error responses as the website. The only addition is `DELETE /users/me` (delete my account), already built, tested and pushed to `staging`.
- **Out of scope for version 1:** push notifications (WhatsApp messages already cover this) and any website redesign.
- **Start:** from scratch. The old `mobile/` folder has been deleted.

## Technical approach

**Final decision:** React Native with Expo (SDK 58) and TypeScript. The iOS developer and the Android developer work in the same project on the same SDK, so about 90 to 95 percent of the code is shared. Only the store setup and a few permission prompts differ.

**Rules that keep the Android developer's work small**

1. One Expo project in `mobile/`, same SDK, same pinned package versions, packages added only with `npx expo install`.
2. Screens, navigation and the API client live in shared folders. No iOS-only or Android-only screens.
3. Anything that differs by platform (permissions, Razorpay, file picking) goes into small wrapper files, not scattered `if` checks.
4. No iOS-only libraries (no SwiftUI or glass-effect packages).
5. The project README explains how to build and run each platform.
6. The typed API client keeps the same method names as the website's `rest.js`, so web and app stay easy to compare.

## App size: under 25 MB

The previous app measured 111 MB, but its source and images were only about 2 MB. The rest was the build: a debug or simulator build carries unminified JavaScript, debug symbols and development tooling. A release build of an app like this is normally 15 to 30 MB installed, and smaller as an App Store download.

**How the size stays low**

- **Measure the right thing.** Check the size of a release archive (the App Store thinning report), never a debug build. The size is reported at the end of every phase.
- **Hermes with minified JavaScript** (the release default). No `react-native-web` or other web packages.
- **Few dependencies.** Each package needs a stated reason. No charts, UI kits or icon packs unless a screen needs them.
- **One font family**, only the weights used (two or three files). The old app loaded three full families.
- **Images:** compressed, logos as SVG, provider logos loaded from the API or CDN rather than bundled.
- **No heavy native modules** for convenience.
- **Android:** R8 shrinking and an `.aab`, which splits downloads per device automatically.

## Razorpay payments

The backend already does the work. The app replaces the website's browser `checkout.js` with Razorpay's native SDK (`react-native-razorpay`), so no backend change is needed. The server always prices the charge; the app never sends an amount.

1. **Create the order.** The app calls `POST /charges/:id/pay`. The server returns `key_id`, `order_id`, `amount` and `currency`. When the server uses mock keys (staging) it returns `mock: true`, and the app calls `POST /charges/:id/mock-pay` instead, with no payment screen.
2. **Open the payment screen.** The app calls the SDK with the key, order id, amount, currency, the name "Connect Bhai" and the payer's name, phone and email pre-filled. The customer pays with a UPI app, card or netbanking.
3. **Verify.** On success the SDK returns `razorpay_payment_id` and `razorpay_signature`. The app sends them to `POST /charges/:id/verify`. The server checks the signature and marks the charge paid.
4. **Safety net.** If the app is closed or the network drops after paying, Razorpay's webhook (`/payments/razorpay/webhook`) still marks the charge paid. The app refreshes the charge when it reopens.
5. **Cancel or failure.** The SDK returns an error, the app shows a clear message, and nothing changes on the server.

The same flow covers the customer's plan payment, the TIP's install fee, the TIP's Care Plan fee and the registration payment.

**Setup notes**

- Needs an EAS development build, not Expo Go.
- Razorpay's current React Native documentation, including iOS UPI-app setup, is checked before it is wired in.
- Apple allows an external gateway because broadband is a real-world service, so no in-app purchase is involved.

## Build phases

Eight phases (0 to 7). Each phase ends with lint and typecheck passing, a release build, and a reported app size. Work is approved phase by phase.

| Phase | What is built | Done when |
| --- | --- | --- |
| 0. Agreement | One Expo project, same SDK 58 and pinned versions, branch and shared-code rules, bundle ID `com.connectbhai.app` | iOS and Android developers both run the empty app |
| 1. Foundation | Navigation, typed API client, phone OTP login, tokens in secure storage with refresh, role routing, staging and production environments, theme, loading, empty and error components, English and Hindi | A user can sign in and land on their role's home; size baseline recorded |
| 2. Customer | Home and plans, request a connection, bookings, plan payment with Razorpay, complaints and chat, Care Plan, profile, delete account | A customer completes a full journey on a real backend |
| 3. DSA | Leads (contact, follow up, lost, book), assign a TIP with the required telephone and order numbers, commission and payouts, tickets and chat | The DSA-first lead flow works end to end |
| 4. TIP | Assigned and booked leads, install start and complete (router serial, photos), mark plan payment received, Care Plan purchase, fees paid to Connect Bhai | An install completes and the fee is paid |
| 5. Admin | Overview and reports, leads and partners (assign, edit, delete), settings, billing and charges (waive, cancel, offline), Care Plan and modems | Admin runs the daily work from the phone |
| 6. Hardening | Real-device testing, accessibility, performance, offline states, size trimming | The quality checklist below is fully ticked |
| 7. Store | TestFlight, App Store listing, privacy answers, reviewer login, submission | Build accepted for review |

## Production quality checklist

- [ ] TypeScript strict mode; lint and typecheck pass before any phase is closed.
- [ ] Every screen has loading, empty, error and offline states. No dead buttons and no "coming soon" tabs.
- [ ] Expired tokens refresh quietly; a slow or lost network shows a retry, never a blank screen.
- [ ] Business rules stay on the server (prices, payouts, GST, permissions). Nothing is copied into the app.
- [ ] Tested on a real iPhone and the simulator, small and large screens, light and dark mode.
- [ ] Accessibility: Dynamic Type, VoiceOver labels, tap targets of at least 44 points.
- [ ] Release build size measured and under the 25 MB target.
- [ ] Staging and production builds use separate API addresses from environment variables; no secrets in the app.

## Store review checklist

**Apple App Store**

- [ ] Native screens, not a website in a shell (guideline 4.2).
- [ ] In-app account deletion using `DELETE /users/me` (guideline 5.1.1).
- [ ] Demo account in the review notes: the review number 6265007710 with its fixed OTP.
- [ ] A purpose string for every permission, and only the permissions the app really uses (camera, photos, location).
- [ ] Privacy manifest and App Privacy answers that match what the backend collects.
- [ ] Privacy policy URL and support URL that both load.
- [ ] Razorpay only for the real-world broadband service; no digital goods sold, so no in-app purchase.
- [ ] No Sign in with Apple needed: login is phone OTP only.
- [ ] Export compliance answered as standard HTTPS only.
- [ ] 1024 by 1024 icon without transparency, correct screenshot sizes, age rating, no placeholder text.
- [ ] Production backend live and stable during review.

**Google Play (Android developer)**

- [ ] Signed `.aab` with Play App Signing, targeting the API level Google requires at submission.
- [ ] Data safety form, content rating, privacy policy and a web URL for account deletion requests.
- [ ] Reviewer login under App access: the same review number 6265007710 with its fixed OTP.
- [ ] New personal developer accounts: complete Google's closed testing period (organization accounts are exempt; confirm the current rule).

## Apple account and Android coordination

The Apple Developer account is not needed to build the app, only to ship it. Start enrolment now in parallel, because an organization account can take days (it needs a D-U-N-S number).

| Stage | Needs the paid account ($99 a year)? |
| --- | --- |
| Writing code and running in the iOS Simulator (Xcode 27.2 is installed) | No |
| Razorpay in test mode, login, uploads, all screens in the simulator | No |
| Running on a real iPhone | Not strictly: a free Apple ID works, but installs expire every 7 days. UPI-app payments are best checked on a real phone |
| TestFlight, App Store submission, signed `.ipa` | Yes |

The bundle ID `com.connectbhai.app` is fixed now, because it cannot change after the first upload.

**Android developer's share of the work: roughly 5 to 10 percent**

- Run and test every screen on Android and fix layout, keyboard, status bar and hardware back-button differences, mostly small styling changes.
- Android settings: package name, adaptive icon, permissions, signed `.aab`.
- Test Razorpay and UPI intents on Android.
- Play Store work: data safety form, listing, closed testing.

The Android developer should test after each phase, not only at the end, so fixes arrive in small batches. Windows or Linux is fine for them; only the iOS build needs a Mac.

## Decisions, reviewer login and risks

| Item | Decision |
| --- | --- |
| Technology | React Native, Expo SDK 58, TypeScript. One project for iOS and Android |
| Payments | Razorpay native SDK (`react-native-razorpay`) with EAS development builds. A WebView checkout is the fallback only if the SDK fails on a device |
| Delete my account | Done: `DELETE /users/me`, tested and pushed to `staging` |
| Reviewer login (Apple and Google) | Dedicated review number **6265007710** with a fixed OTP. Before submission (Phase 7) the backend accepts the fixed OTP in production for this one number only; every other number still refuses it |
| Push notifications | Not in version 1. WhatsApp messages cover notifications |
| Apple Developer account | Enrolled in parallel while the app is built. Needed for TestFlight and the App Store |
| Privacy policy and account-deletion web page | Published at a public URL before submission |

**Risks**

- Package version drift between two developers causes messy merges; pin versions and agree one owner for dependency changes.
- Razorpay and UPI behaviour on real devices can only be confirmed on real phones.
- Expo SDK 58 differs from older documentation, so the versioned Expo docs are read before using any API.
