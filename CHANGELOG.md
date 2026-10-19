# Changelog

Format: [Keep a Changelog](https://keepachangelog.com), versions: [Semantic Versioning](https://semver.org).
MAJOR = data/URL tootne wala badlav, MINOR = naya feature, PATCH = bug fix.
Naya version: `package.json` + `index.html` ka `ES.version` + yahan naya `## [x.y.z]` section — CI teeno match karta hai.

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
