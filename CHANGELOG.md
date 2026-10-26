# Changelog

Format: [Keep a Changelog](https://keepachangelog.com), versions: [Semantic Versioning](https://semver.org).
MAJOR = data/URL tootne wala badlav, MINOR = naya feature, PATCH = bug fix.
Naya version: `package.json` + `index.html` ka `ES.version` + yahan naya `## [x.y.z]` section — CI teeno match karta hai.

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
