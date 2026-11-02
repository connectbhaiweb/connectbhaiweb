# Connect Bhai – Next.js (App Router)

Migration of the single-file `final.html` prototype to Next.js 16 / React 19 (JavaScript, same as the original).

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run lint
```

Runs on the built-in **demo back end** by default (demo bar visible, OTP `123456`, password `Demo@1234`;
phones 9876500001 customer · 9876500101 DSA · 9876500201 TIP · 9876500999 admin).
To switch to Supabase, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Routes (old hash URLs → real routes)

| Old | New |
|---|---|
| `#home` | `/` |
| `#speed` / `#router` | `/speed` · `/router` |
| `#my`, `#my-<tab>` | `/my`, `/my/<tab>` |
| `#dsa…` `#tip…` `#admin…` | `/dsa/<tab>` · `/tip/<tab>` · `/admin/<tab>` |

Old hash links still work: `/#my-payments` redirects to `/my/payments`.

## Structure

```
src/app/            layout.js (metadata, fonts, shell) · globals.css (original CSS, byte-for-byte) · one page.js per route
src/components/     Header, Footer, Logo, DemoBar, CompareBar, Overlays (modal/toast host), AppDownload, Faq, StoryTemplate,
                    ConnectBhaiRuntime (boots the app + hash redirect), ViewRoute (tells the app which view the URL means)
src/lib/connectbhai/
  config.js         env-driven config (SSR-safe)
  shared.js         roles, route helpers (SSR-safe)
  runtime.js        tiny store so React components follow session/compare state
  api.js            data layer: DemoAPI (localStorage) + LiveAPI (Supabase) – original code, now an ES module
  ui.js             the view renderers, actions and form handlers – original code, now an ES module   ← STAGE 2 TARGET
  storyTemplate.js  hero animation markup (unchanged)
```

## v2 additions

* **One-screen first view.** Home: heading on one line, search card and the Bhai animation side by side (stacked on phones, still inside the first screen). Speed test: dial, Start button and the 4 result cards (Download / Upload / Ping / Jitter) stay in view, also after a test finishes. Checked in Chromium at 1920×869, 1536×730, 1440×900, 1366×768, 1280×720, 768×1024, 412×915, 390×844 (all fit); 375×667 and 360×740 cut a few pixels.
* **Speed test dial** (needle, ticks, Ping → Download → Upload steps, tap the dial to start). Same Cloudflare test and same save/report logic as before.
* **App download section** (`components/AppDownload.jsx`) and **FAQ** (`components/Faq.jsx`) at the bottom of the home page. Footer links: FAQ, Get the app.
* **New logo.** Header plays the reveal animation once (`public/brand/logo-reveal.webp`, from your GIF) and holds the final frame; reduced-motion users and the footer get the static `logo-full.png`. Favicon: `src/app/icon.png`. Header and footer are now the deep blue, since the logo is white-on-dark.
* **Fonts are self-hosted** (`@fontsource`), no Google Fonts request.

### Set before going live
`.env.local`: `NEXT_PUBLIC_PLAY_STORE_URL`, `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_APP_URL` (QR target). Until set, the store buttons show a "coming soon" message and no QR is rendered. Support number for Call/WhatsApp comes from `src/lib/connectbhai/config.js`.

## v3: shadcn/ui + Magic UI + Tailwind, and the new Speed test

* **Tailwind v4 is installed WITHOUT its global reset**, and it only scans `src/components/ui`, `components/magicui`, `components/speed` and `app/ui-kit`. So the original CSS/design of every other page is untouched (checked with a pixel diff of Home in light and dark). shadcn colour tokens are mapped to the site's own CSS variables (`@theme inline` at the top of `globals.css`).
* **shadcn/ui** (`components.json` is set up): `components/ui/button.jsx`, `card.jsx` (`<Card interactive>` = hover lift + glow). Add more with `npx shadcn@latest add dialog` etc.
* **Magic UI** (needs the `motion` package, which is why it is installed): `components/magicui/number-ticker.jsx`, `shimmer-button.jsx`, `border-beam.jsx`. These three were written to match Magic UI's published API because the build sandbox could not reach magicui.design; you can overwrite them with the official ones: `npx shadcn@latest add @magicui/number-ticker` (registry alias is in `components.json`).
* **Speed test is now a React page**: `components/speed/SpeedTest.jsx` + `Gauge.jsx`, designed from your two images (desktop + mobile, dark). Same Cloudflare measuring and the same save-result / report-slow-speed logic (through `speedBridge` in `ui.js`). Hover cards, animated needle and arc, count-up numbers, shimmer button, border beam while testing; all motion is off for "reduce motion". On phones, tapping Start scrolls the gauge into view so the result and the 4 cards are visible without scrolling.
* "What can you do at X Mbps?" uses simple thresholds (4K 25 Mbps, video calls 10, gaming 15 Mbps and ping under 50 ms, work from home 20). Adjust `USES` in `SpeedTest.jsx` if you want different numbers.
* `/ui-kit` is a private preview of the components (noindex). Delete `src/app/ui-kit` before launch if you do not want it public.

## v4: mobile, header, loading states, login

* **Mobile menu** (hamburger, keyboard + Esc, `aria-expanded`, closes on navigation). Below 900px the desktop nav was simply hidden before, so phones had no way to reach Care plan / Speed test.
* **No sideways scroll** at 320 / 375 / 390 / 430 / 768 / 1024 on every route, light and dark, and in all 4 dashboards (108 views). Root cause: single-column tracks were written `1fr` (= `minmax(auto,1fr)`), so input minimum widths stretched the column; now `minmax(0,1fr)`.
* **Speed test page** uses the same `.wrap` container as the header and footer. **Dark mode:** the App-download phones and store buttons used theme colours on a white surface (invisible text); they now use fixed colours.
* **Loading states:** shimmer skeletons (`.sk`, `components/ui/skeleton.jsx`) instead of blank pages / "Loading…", a placeholder before the app script paints (no layout jump), a top progress bar for navigation, fetches and form submits, and a "Try again" button on every load error.
* **Login hardening** (UI layer only, same auth provider and APIs): `+91`, `91`, `0` prefixes, spaces and dashes are accepted and cleaned (no more truncation when pasting); specific messages for wrong length / non-Indian numbers; OTP accepts "123 456"; OTP-send errors shown under the field; friendly text for rate-limit / expired OTP / network errors; 30 s request timeout and an offline message (Supabase mode); "Change number" link on the OTP step; resend cooldown and duplicate-tap protection verified.
* **Cards:** one hover / keyboard-focus / touch-press style for plan, KPI, step and account cards; everything respects reduced motion. Global `:focus-visible` outline.
* Images: the site has no photos, only the logo (kept at its aspect ratio via `width:auto`) and inline SVG.

## Status: Stage 1 of 2

**Native Next.js/React now:** routing and URLs, layout, metadata/viewport, header (session-aware, active route), footer,
demo bar, compare bar, modal/toast host, config via env vars, module structure, client-only boot, StrictMode-safe
listener cleanup, back/forward navigation.

**Still the original imperative code (`ui.js`, ~1,800 lines):** the page *views* (home/search/results, customer, DSA, TIP,
admin, router/care plan, speed test) are template-string renderers that write into `<main id="app">`, driven by
document-level click/input/change/submit delegation (82 `data-act` actions, 36 `data-form` handlers). Behaviour and
markup are therefore identical to the original, but these views are **not yet React components**, are rendered client-side
only (as in the original), and the page body is not server-rendered.

**Stage 2 plan (one view at a time, each shippable on its own):** (1) Home + search + results + compare → server/client
components (this is the only public, SEO-relevant page); (2) Speed test and Care plan; (3) customer dashboard;
(4) DSA and TIP; (5) admin (14 tabs, largest); (6) replace the delegated actions/forms with React handlers and delete `ui.js`.

## Things to know

* **Fonts:** self-hosted with `@fontsource` (Sora, Manrope, IBM Plex Mono), same family names as the original CSS.
* **Loaded at runtime from CDNs (unchanged from the original):** Cloudflare speed-test module (jsDelivr; speed test),
  Supabase JS (only when configured), Razorpay checkout (only for live payments). The speed-test import is marked
  `webpackIgnore`/`turbopackIgnore` so the bundler leaves the URL import alone.
* **Not part of the site and dropped:** the artifact-hosting wrapper that was injected into `final.html`
  (`frame-runtime` preamble scripts and its reset style). Plan-sheet import (.xlsx/.csv) uses native `DecompressionStream`, no library.
* **Demo-only items kept as in the original:** demo accounts, client-side password hashing, simulated GenieACS, Razorpay test checkout.
  Nothing was added that fakes a backend.
* **Added (not in original):** `lang="en-IN"` on `<html>`; legacy-hash redirect.
