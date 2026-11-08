# ConnectBhai Mobile App: Build Plan and Store Approval

Date: 2026-11-06

## 1. Goal and approach
One React Native app, published on the Google Play Store and the Apple App Store, approved on the first submission.
- One codebase builds the Android and iOS apps.
- Native-UI client of the existing ConnectBhai platform, not a web wrapper.
- Store rules that commonly cause rejection are build requirements from day one.

## 2. Scope: UI only
Only the mobile UI is built. The backend (NestJS + Prisma + MySQL) is not changed.
- Same REST APIs, endpoints, request bodies, auth tokens and error responses as the website.
- No new endpoints, no schema changes, no business logic copied into the app. Prices, commissions, GST/TDS, eligibility and role permissions stay on the server.
- If the app needs something the API lacks, it is raised as an open decision, not worked around.
- No push notifications in the first release (optional on both stores; can be added later).

## 3. Technical approach
React Native on Expo, TypeScript, shipped with EAS Build and EAS Submit.
- One codebase, about 90-95% shared. Platform-specific code is limited to permission prompts and store configuration.
- Build outputs: `.aab` for Google Play, `.ipa` for the App Store.
- Reused from the website: the API layer (`frontend/src/lib/connectbhai/rest.js`) and plain-JS helpers (`rates.js`, `careplan.js`), copied and typed.
- Rewritten: every screen (no HTML/CSS/Tailwind in React Native). Recharts is replaced by a native chart library.
- Uploads: camera/gallery photos (JPG, PNG, HEIC converted to JPEG) and documents (PDF, XLSX, CSV) through the existing upload endpoint.
- Login token in secure device storage. API base URL from build-time environment variables, separate staging and production builds.

## 4. One app, four roles
Phone + OTP login. The app reads the role from the API response and shows only that role's screens. The server decides the role and keeps enforcing permissions.

| Role | Screens (mirroring the website) |
| --- | --- |
| Customer | Home and plans, bookings, complaints, care plan and devices, payments, chat |
| DSA | Home, my customers, tickets, commission and fees, care plan |
| TIP partner | Home, leads, plan uploads, payments to ConnectBhai, care plan |
| Admin | Overview, customers, partners, billing, care plan (see open decisions) |

## 5. Google Play approval checklist
- [ ] Upload a signed `.aab` (Play App Signing). APKs are not accepted for new apps.
- [ ] Target the Android API level Google requires at submission time (check before the final build).
- [ ] Privacy policy at a public URL, linked in the listing and in the app.
- [ ] Data safety form: phone, name, address, KYC documents, photos, payment data, and how each is used.
- [ ] In-app account deletion, plus a web URL for deletion requests.
- [ ] Reviewer login under App access: test phone number with a fixed OTP.
- [ ] Only needed permissions (camera, photos, files), explained when used.
- [ ] Content rating questionnaire and target audience declaration.
- [ ] Listing assets: 512x512 icon, 1024x500 feature graphic, phone screenshots, honest descriptions.
- [ ] Base download under 200 MB.
- [ ] Recent personal developer accounts: complete the closed testing period Google requires (organization accounts exempt). Confirm the current rule.
- [ ] Production backend live and stable during review.

## 6. Apple App Store approval checklist
- [ ] Build with the Xcode / iOS SDK version Apple requires at submission; upload `.ipa` via EAS Submit or Transporter.
- [ ] Guideline 4.2: native screens and native features (camera, file upload), not a website in a shell.
- [ ] In-app account deletion (guideline 5.1.1), not just a web link.
- [ ] Demo account in App Review notes: test phone number with a fixed OTP, one per role if needed.
- [ ] App Privacy details (nutrition labels) matching what the app and backend collect.
- [ ] Privacy policy URL and support URL, both loading.
- [ ] Purpose string for every permission (camera, photo library, files).
- [ ] Privacy manifest and required-reason API declarations where SDKs need them.
- [ ] Payments: broadband is a real-world service, so an external gateway is allowed; no in-app purchase needed. Do not sell digital content in the app.
- [ ] Sign in with Apple not needed with phone + OTP only; required if Google/Facebook login is added.
- [ ] Export compliance (encryption) answer: standard HTTPS only.
- [ ] Age rating, required iPhone screenshot sizes, 1024x1024 icon without transparency.
- [ ] No placeholder text, broken screens or "coming soon" tabs; everything works against the live backend.

## 7. Build phases
1. Foundation: Expo project, TypeScript, navigation, theme, API client, secure token storage, staging/production environments.
2. Auth and role routing: phone OTP login, role detection, role-based navigation, logout, in-app account deletion.
3. Customer screens.
4. DSA and TIP screens (including uploads with camera and file picker).
5. Quality pass: real Android and iOS devices, small and large screens, loading/empty/error/offline states, accessibility.
6. Store preparation: privacy policy, deletion page, listing text, screenshots, data safety and privacy label answers, reviewer accounts.
7. Internal testing: Play internal testing and Apple TestFlight.
8. Store submission: later, after the app is built, tested and approved by the owner. Not part of the current build; the checklists in sections 5 and 6 are followed during the build so submission is ready when wanted.

## 8. Out of scope and open decisions
Out of scope: backend/API changes, push notifications, website redesign.

- [ ] Admin role in the app, or web-only?
- [ ] Does an account deletion API exist today? If not, that is the one backend gap to raise.
- [ ] Personal or organization developer account? (Organization needs a D-U-N-S number for Apple and avoids Google's closed testing wait.)
- [ ] Who hosts the privacy policy and the deletion request page, and at which URL?
- [ ] Expo acceptable, or bare React Native?

## 9. Setup guide for a new team member

Follow this on a Mac to build and run both apps. Apple's tools only run on a Mac, so iOS builds need one. Keep at least 60 GB of free disk space.

### 9.1 Accounts

| Account | Cost | Needed for | Link |
| --- | --- | --- | --- |
| Expo | Free | Cloud builds with EAS | https://expo.dev/signup |
| Apple Developer | $99 per year | Running on a real iPhone, `.ipa` builds, App Store | https://developer.apple.com/programs/ |
| Google Play Console | $25 once | Play Store (later) | https://play.google.com/console/signup |

The Apple and Google accounts can wait until real-device testing or store submission.

### 9.2 Software to install

| Software | Used for | Download |
| --- | --- | --- |
| Node.js 20 or newer | Running the project | https://nodejs.org/ |
| Git | Code | `git --version` (macOS offers to install it) |
| Xcode | iOS simulator and iOS builds | https://apps.apple.com/app/xcode/id497799835 |
| Android Studio (Apple Silicon build) | Android SDK and emulator | https://developer.android.com/studio |
| Homebrew | Installing CocoaPods | https://brew.sh/ |
| Expo Go (optional, on phones) | Live preview without a build | iPhone: https://apps.apple.com/app/expo-go/id982107779, Android: https://play.google.com/store/apps/details?id=host.exp.exponent |

### 9.3 Setup steps

1. Install Xcode from the App Store. Open it once, then in Xcode > Settings > Components download the iOS simulator.
2. Accept the Xcode license and point the tools at Xcode (asks for your Mac password):

```bash
sudo xcodebuild -license accept
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

3. Install Android Studio, open it, choose Standard setup so it downloads the Android SDK, then create an emulator in Device Manager (for example Pixel 8, latest Android).
4. Add the Android and Java settings to `~/.zshrc`, then open a new terminal:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

5. Install the command-line tools:

```bash
npm install -g eas-cli
brew install cocoapods
```

6. Log in to Expo (you enter your own password):

```bash
eas login
```

### 9.4 Check that everything works

```bash
node -v
eas --version
pod --version
xcodebuild -version
adb --version
xcrun simctl list devices available
```

Every command should print a version or a device list. An error names the missing piece.

### 9.5 Build commands

```bash
eas build -p android --profile production
eas build -p ios --profile production
```

The first produces the `.aab`, the second the `.ipa`. For quick testing, use the development profile and install on an emulator, the iOS simulator, or a phone. The app project lives in `connectbhai/mobile` (see section 10 for how to run it).

### 9.6 Common problems

- "You have not agreed to the Xcode license": run `sudo xcodebuild -license accept`.
- `pod` or `xcodebuild` not found: Xcode is not fully installed or `xcode-select` points at the command line tools. Repeat step 2.
- `adb` not found: the `~/.zshrc` lines in step 4 are missing, or the terminal was not reopened.
- Disk full during installs: clear `~/.npm`, `~/Library/Caches` and old `node_modules` folders; they rebuild themselves.
- No iPhone build without an Apple account: the simulator works free; a real device or `.ipa` needs the $99 Apple Developer account.

## 10. The app project and how to run it

The Expo project was created on 2026-11-06 in `connectbhai/mobile`, next to `frontend/` and `backend/` in the same repository. It uses the default Expo template with TypeScript and Expo Router. Versions at creation: Expo 58, React Native 0.88, React 19.3.

### 10.1 Run on the Android emulator

1. Start the emulator (name created by Android Studio: `Medium_Phone_API_37.0`):

```bash
emulator -avd Medium_Phone_API_37.0
```

2. In a second terminal, start the app (first run also downloads Expo Go onto the emulator, which takes a few minutes):

```bash
cd connectbhai/mobile
npm install
npx expo start --android
```

### 10.2 Run on the iOS simulator

```bash
cd connectbhai/mobile
npx expo start --ios
```

This needs Xcode and an installed iOS simulator runtime (section 10.4).

### 10.3 Run on a real phone

Install Expo Go from the links in 9.2, make sure the phone and the Mac are on the same Wi-Fi, run `npx expo start`, and scan the QR code. Native features that Expo Go does not include later need a development build with `eas build --profile development`.

### 10.4 Setup status on the main development Mac (2026-11-06)

| Item | Status |
| --- | --- |
| Node 24, npm 11, git | Installed |
| `eas-cli` 27.5 | Installed; `eas login` still to be done by the account owner |
| Android Studio, Android SDK 37, emulator, `Medium_Phone_API_37.0` | Installed and running |
| `ANDROID_HOME`, `JAVA_HOME`, PATH lines in `~/.zshrc` | Added |
| Xcode 27.2 | Installed, license and first launch accepted |
| iOS 27.2 simulator runtime | Downloading; started with `xcodebuild -downloadPlatform iOS` |
| CocoaPods | Not yet installed; needs Xcode to be complete (`brew install cocoapods`) |
| Expo project in `connectbhai/mobile` | Created, dependencies installed |
| App opening in Expo Go on the emulator | Working: the Expo welcome screen runs on the Android emulator (verified 2026-11-06) |

If you set up another machine, work down this table.

### 10.5 Extra setup notes learned on the way

- Installing the Android SDK without the Android Studio wizard: download Google's command-line tools from `dl.google.com/android/repository`, unpack them to `~/Library/Android/sdk/cmdline-tools/latest`, run `sdkmanager --licenses` (you must accept Google's license yourself), then install `platform-tools`, `emulator`, a platform, build-tools and an arm64 system image. On an Apple Silicon Mac use the `arm64-v8a` image.
- iOS simulator download stuck on "Preparing": do not start two downloads at once. Cancel extra entries in Xcode's Downloads window, then run `xcodebuild -downloadPlatform iOS` once and let it finish. Check with `xcrun simctl list runtimes`.
- Free disk space: the full toolchain needs about 35 GB. If space runs low, safely clear `~/.npm`, `~/Library/Caches`, `~/.cache` and old `node_modules` folders; they rebuild on demand.
- Metro in CI mode: running `CI=1 npx expo start` disables reloads. For daily work run it without `CI=1`.

### 10.6 Decisions and rules for this app

- One app for all four roles; the role comes from the API after phone and OTP login.
- UI only: no backend changes, same REST APIs as the website, no business logic copied into the app.
- No push notifications in the first release.
- Test builds first; store submission is a later, separate step.
- Open decisions are listed in section 8 (Admin in the app or web-only, account deletion API, developer account type, privacy policy hosting, Expo vs bare React Native).
