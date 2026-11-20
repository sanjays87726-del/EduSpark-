# Changelog

## Unreleased
- `ADMIN_PASS` ab sirf Admin Panel kholta hai; naya alag `SUPER_ADMIN_PASS` sabhi sections unlock karta hai. `PASS_<SECTION>` apne section tak limited, `PASS_STAFF` staff ke liye. Worker v13.

Format: [Keep a Changelog](https://keepachangelog.com), versions: [Semantic Versioning](https://semver.org).
MAJOR = data/URL tootne wala badlav, MINOR = naya feature, PATCH = bug fix.
Naya version: `package.json` + `index.html` ka `ES.version` + yahan naya `## [x.y.z]` section — CI teeno match karta hai.

## [Unreleased]

## [1.7.0] - 2026-11-19
### Added
- **Admin panel v2** (`admin.html`): sidebar menu A–M (mobile par drawer), Dashboard (students total/aaj ke naye/active 24h-7d-30d, content, queue, daily-weekly-monthly report, 7 din ka chart), Students (search, detail, edit, **Block/Unblock**), Staff & Roles (editor/teacher/notifier), Courses (**Publish/Unpublish**, edit, delete), App Settings (**Remote Config**: maintenance mode, force update, announcement bar, app naam/logo), Notification Health, Activity Logs + Login history, Security & Sessions, Backup info, Reports (CSV / PDF-print). Jo features ka data abhi nahi hai wo menu me "Soon" + wajah (docs/ADMIN.md Roadmap R1–R5).
- **Har section ka alag password** (Worker secrets `PASS_<SECTION>`, `PASS_STAFF`), Super Admin master `ADMIN_PASS` har section kholta hai; 15 min idle par auto-lock; `/admin-verify` endpoint; token scope-wise (worker v11, tests).
- **Activity log**: har admin/staff action (`adminLogs`) automatically — sirf field ke naam, student ka data nahi. Rules me append-only (staff ke liye).
- **Staff roles** Firestore rules me (`staff/{email}`): editor/teacher -> content/quiz/pyq, teacher -> doubts, notifier -> notificationQueue; baaki sab sirf Super Admin.
- **Student app Remote Config** (`_config/app`): maintenance screen, force-update screen, announcement bar, app naam/logo — bina code deploy kiye; pichhli value `localStorage` me.
- `blockedUsers/{uid}`: blocked student ko app me "account roka gaya" screen, naye doubts rules se band, notification sender use skip karta hai.
- Students me `createdAt` (dashboard ke "naye students" ke liye), content/quiz/PYQ me `published:false` (draft) — students ko nahi dikhta.
- `tests/admin-v2.test.js` (helpers + admin/worker/rules/app consistency), `tests/browser/` (asli Chromium me admin + app smoke tests, nakli Firebase).
### Added (pehle ka, isi release me)
- **Search / AdSense pages:** 8 original study guides (CBSE 10/12, BSER 10/12, SSC CGL, SSC CHSL, REET & BSTC, study tips), `disclaimer.html`, `ads-and-cookies.html`; generator `tools/build-pages.py`; JSON-LD, `<noscript>` content and footer links in `index.html`; `tools/seo-audit.py` (Googlebot/Bingbot-style scan).
- **Notifications:** `cron-trigger/` (alag Cloudflare Worker) GitHub Action ko ThIK samay par chalata hai; tests `slots-release.test.js`, `cron-trigger.test.mjs`; `notificationState/lastRun` debug record.
- `icon-maskable-512.png` (alag maskable icon), manifest shortcut.
### Changed
- `privacy.html`, `terms.html`, `about.html`, `contact.html`, `delete-account.html` fir se English me, strict (AdSense, DPDP/children, AI, copyright, grievance contact).
- Login screen ab browser me pehle touch/scroll par khulti hai (installed app me pehle jaisa) — crawlers ko login wall nahi dikhti; "Skip for now" button.
- `<meta charset>` sabse upar, pinch-zoom allowed, robots.txt (Mediapartners-Google allow, internal folders disallow), sitemap (16 URL).
- Daily reminders ki push TTL 24h → 3h (shaam ka reminder raat ko nahi aata).
### Fixed
- **Home ka "Google se Sign In" button aur login wall sign-in ke baad bhi dikhte the** — auth callback ke neeche ka koi call throw karta to button chhupane wali line chalti hi nahi thi (NOTES #43); ab sabse pehle chalta hai, har helper alag try me.
- **Notification page ka back button kaam nahi karta tha** — bell dobara dabane par "wapas" ka page khud hi ban jaata tha; Profile me bhi wahi (NOTES #44).
- Home top bar se dark-mode icon hataya (Profile me rahega).
- **Admin Offers ke Edit / On-Off / Delete buttons ka id galat tha** (`data-id` me literal text) — Delete kuch delete nahi karta tha (NOTES #42).
- `tests/repo.test.js` fixture me `donate-qr.png` nahi tha + versions hardcoded the (NOTES #46).
- `send-notifications.js`: bhejte waqt error aane par slot din bhar ke liye "claimed" reh jaata tha (reminder miss) — ab slot release hota hai.
- In-app privacy modal ka Ads paragraph `privacy.html` se alag tha (NOTES #9).
- Notification card ab batata hai ki server reminders ke liye Google sign-in zaruri hai; sign-in ke baad token dobara register hota hai.

## [1.6.0] - 2026-10-23
### Added
- **Google sign-in app ke andar:** Google Identity Services (official button + One Tap/FedCM) → `signInWithCredential`, redirect/popup ke bina. `ES_GOOGLE_CLIENT_ID` (index.html) paste karna hai; khali ho to purana Firebase popup chalta hai.
- **Ek consent checkbox** login page par Google button ke neeche (Terms + Privacy + crash reports); Google sign-in aur manual "शुरू करें" dono isi se gate hote hain.
- **Notifications:** swipe se delete (koi button nahi); naye student ko join se pehle ki admin notifications nahi dikhtin; offer notification me image + link (list me bhi aur phone push me bhi).
- **Offerwall push:** admin Offers tab se naya offer save karte hi `notificationQueue` me image + link ke saath notification (scheduled offer start date par); admin ke general notification form me bhi optional image/link.
- **Quiz:** Practice mode me answer karte hi sahi/galat + sahi jawab + व्याख्या (`exp`), `exp` na ho ya galat ho to "AI से समझें".
- **Quiz Analytics:** marks/total, percentage, required (qualifying) marks + Qualified badge, accuracy, time, donut graph, difficulty-wise bars, section-wise bars, question-wise time graph, insights, pichhle attempts ki progress. Optional quiz fields: `passPercent`, `marksPerQ`, `negative`; optional question field `diff`.
- Tests: `quiz-analytics.test.js`, `app-logic.test.js` (consent, back guard, notifications, sw.js, FCM payload).
### Changed
- Profile se consent toggles (crash/analytics) hataye; login page se umar ka sawaal hataya. Umar ab pata nahi, isliye usage analytics / Clarity naye students ke liye band rehte hain. Logout par consent bhi hat jaata hai.
- Privacy text (in-app + `privacy.html`) naye flow ke hisaab se.
- `sw.js` v20: push me `image`, offer ka external https link seedha khulta hai.
### Fixed
- Sign-in: popup band karte hi app Google par redirect ho jata tha; redirect flow custom domain par silently fail hota tha; ab saaf Hindi error messages (unauthorized-domain, network, popup-blocked...).
- Back button: guard boot par bina touch ke lagta tha (Chrome use skip kar deta) aur handler me error aane par guard wapas nahi lagta tha → app bina poochhe band. Ab guard pehle touch par, pehle re-arm phir handler, legal iframe history me entry nahi banata, offer popup / sign-in sheet back se band hote hain.
- `firestore.rules`: `offers` collection ka public-read rule nahi tha (students ko offers dikhte hi nahi the).

## [1.5.0] - 2026-10-18
### Added
- Alerts: `scripts/watchdog.js` + `watchdog.yml` (site, sw.js, AI Worker, DNS, TLS expiry, dead-letter, backup freshness → Telegram/Discord/Slack/email).
- Webhooks: signed outbound with retries, inbound verify (HMAC + replay protection + dedupe) — `scripts/lib/webhook.js`.
- Pub/Sub `ES.bus`; clock-skew warning (`ES.checkClockSkew`).
- Worker v8: API versioning (`/v1/ask`, legacy `/` alias, `apiVersion`, contract tests).
- Docs: `NETWORKING.md` (CAP, partitions, replication, sharding, DNS, TCP/UDP, HTTP/2/3, gRPC, real-time, CDN), `RUNBOOK.md` (incidents, on-call, WAF/DDoS), `API.md`, post-mortem template, incident issue form.
### Changed
- `check-repo` ab Helm `appVersion` aur K8s image tag ko bhi version ke saath match karta hai.

## [1.4.0] - 2026-10-17
### Added
- DevOps: CI (`ci.yml`), release workflow, Docker image (nginx, non-root), docker-compose load balancer, Kubernetes manifests, Helm chart (rolling / canary / blue-green), Terraform (Cloudflare Worker + KV), `wrangler.toml`, Firestore rules deploy workflow, Dependabot.
- Canary flags `ES.rollout()`, chaos fault injection `ES.chaos`, Firestore read counter in `ES.debug()`.
- `ENABLED_SLOTS` (notification slots band karke Firestore reads bachana).
### Changed
- `npm ci || npm install` + npm cache in scheduled workflows; `package.json` me `firebase-admin` range pinned.

## [1.3.0]
### Added
- Notification queue: lease lock, retry with backoff, dead-letter. Backup / restore / migrate scripts. Account-delete saga + batched deletes. Service-worker update toast. Worker per-student lock.

## [1.2.0]
### Security
- XSS sanitizer (`ES.sanitize`, `safeUrl`, `escAttr`), Worker v6 (body limit, JWKS rotation, headers, request id).

## [1.1.0]
### Added
- Reliability toolkit: timeouts, retries + backoff, circuit breaker, client rate limit, idempotency, feature flags, logging, metrics, SLO/error budget, health.

## [1.0.0]
- Baseline: EduSpark PWA (content, quizzes, PYQ, doubts, AI helper, notifications, admin panel).
