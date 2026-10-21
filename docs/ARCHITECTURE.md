# EduSpark — Architecture & System-Design Notes

Stack: static PWA (GitHub Pages / Cloudflare) + Firebase (Auth, Firestore, FCM) + Cloudflare Worker (AI, KV) + GitHub Actions (cron).
Status: ✅ code me hai · 🟡 managed service sambhalta hai · ➖ is stack me lagoo nahi · 📋 aage ke batch me

## Batch 1 — Reliability & Observability (index.html → `ES` toolkit)
| Concept | Kahan |
|---|---|
| Timeouts / Retries / Exponential backoff | ✅ `ES.aiRequest` — 30s timeout, sirf network error par retry (jitter ke saath). Worker ke 502/503 retry nahi hote: har attempt KV ke 2 writes lagata hai |
| Circuit breaker | ✅ 3 failures → 30s open → half-open me ek probe |
| Rate limiting | ✅ client token bucket + Worker ki roz ki limit + per-student lock (Batch 3) |
| Idempotency | ✅ `ES.once` — double-tap par doubt do baar save nahi |
| Back pressure | ✅ `_aiBusy` (ek waqt me ek AI request), bounded buckets |
| Feature flags | ✅ Firestore `_config/flags` → `{ai:false}` / `{doubts:false}` |
| Logging / Monitoring / Metrics / Observability | ✅ `ES.debug()` (console me), Sentry breadcrumbs (consent ke baad), UptimeRobot |
| SLI / SLO / Error budget / p95 / p99 / Tail latency / Throughput | ✅ `ES.report()` — per-session; poora SLO ke liye Sentry/Worker logs |
| Health checks, Liveness & Readiness | ✅ `ES.health()`; Worker `GET /` status |

## Batch 2 — Security
| Concept | Kahan |
|---|---|
| XSS | ✅ `ES.sanitize` (allow-list), `escAttr`, `safeUrl`; inline `onclick` me URL nahi |
| CORS | ✅ Worker allow-list origins, sirf `Content-Type` header, preflight 24h cache |
| CSRF | ➖ cookie/session nahi; token body me + Origin check |
| SQL injection | ➖ Firestore (NoSQL), koi query-string nahi banti |
| SSRF | ✅ Worker sirf fixed URLs (Google JWKS, Gemini) fetch karta hai |
| JWT verify + key rotation | ✅ RS256, aud/iss/exp, unknown kid par throttled fresh JWKS |
| OAuth / IAM | ✅ Google Sign-In; Firestore rules me admin/student roles |
| Secrets | ✅ `GEMINI_KEY` Worker secret, service account GitHub secret |
| TLS / encryption in transit / at rest | 🟡 HTTPS + Google-managed encryption |
| API gateway / Reverse proxy | ✅ Worker = gateway (auth, limit, validation) |
| Tracing | ✅ request ID `rid` (Worker log ↔ client log) |
| API versioning | ✅ Worker `/v1/ask` (+ legacy `/`), `apiVersion` in response, contract tests — `docs/API.md` (Batch 5 me poora kiya) |
| Cold starts | 🟡 Workers isolates (ms me start, container nahi); client ka "cold start" = pehla load → splash + service-worker cache se offline-first |
| Serverless limits | 🟡 yaad rakhne wali limits (free plan — Cloudflare/Firebase docs me abhi verify karo, badalti rehti hain): Workers ~100k requests/din & ~10 ms CPU/request, KV 1,000 writes/din, Firestore 50k reads/20k writes/din. Hamari design inhi ke andar: JWT verify chhota CPU, Gemini call I/O (CPU nahi), AI par retry nahi (KV writes) |

## Batch 3 — Data & Speed
| Concept | Kahan |
|---|---|
| Database indexing / Query optimization | ✅ saari queries single-field (auto index): `where board==`, `uid==`, `status==`. Rule: `where` ke saath doosre field par `orderBy` mat lagao (composite index chahiye hoga) — sorting client par hoti hai |
| N+1 queries | ✅ account delete: N alag delete → 400-400 ke batch |
| Connection pooling / Read replicas | ➖🟡 Firestore HTTP/gRPC multiplexing, managed replication |
| Caching / Cache invalidation | ✅ Firestore offline persistence + service worker. Naya `sw.js` (CACHE_NAME) → student ko "नया version" toast. **Har deploy par `CACHE_NAME` badlo** |
| Optimistic locking / Race conditions | ✅ admin doubt-reply transaction (already-answered check); username claim transaction; Worker per-student lock |
| Distributed lock | ✅ `claimQueueDoc` (lease), `claimSlot` (daily slot) |
| Dead locks | ➖ lock ordering ki zaroorat nahi: transactions ek hi doc par, lease timeout se lock kabhi atakta nahi |
| Eventual consistency | ✅ `onSnapshot` real-time + offline cache; UI snapshot ke hisaab se re-render |
| Message queue / DLQ / Event-driven | ✅ `notificationQueue`: pending → sending → sent, fail par retry 20/40 min backoff, 3 kosish ke baad `dead` |
| Cron jobs | ✅ GitHub Actions (`notifications.yml` 20 min, `backup.yml` weekly) |
| Saga / Distributed transactions | ✅ account delete = orchestrated saga (5 steps, fail par step ka naam, dobara dabane par ho chuke steps skip). Compensation nahi — forward recovery |
| Migrations / Schema versioning | ✅ docs par `schema: 1`; `scripts/migrate.js` (dry-run default, idempotent, `notificationState/migrations` me record) |
| Backups / Disaster recovery / Failover | ✅ `scripts/backup.js` (weekly artifact, 30 din), `scripts/restore.js` (dry-run default). Personal data backup me nahi. Failover: static hosting + Firebase multi-zone managed |
| Memory leaks / GC | ✅ audit: listeners/timers cleanup theek; `_aiExCache` 60 par capped |
| Strict daily-limit race | 🟡 per-student lock isolate ke andar; poori guarantee ke liye Durable Object chahiye |

## Batch 4 — DevOps
| Concept | Kahan |
|---|---|
| CI/CD | ✅ `.github/workflows/ci.yml` (repo checks + tests + Docker smoke + Helm/Terraform validate), `release.yml` (tag → image + Release), `deploy-worker.yml`, `deploy-rules.yml` |
| Docker | ✅ `Dockerfile` (nginx non-root, healthcheck), `.dockerignore` (secrets/server code image me nahi), `docker-compose.yml` |
| Build caching | ✅ Docker layers GitHub Actions cache me; `~/.npm` cache (`actions/cache`) |
| Dependency hell | ✅ `package.json` me `firebase-admin` range pinned; Dependabot (actions, npm, docker, terraform); Dockerfile base image version pinned |
| Semantic versioning | ✅ `package.json` = `ES.version` = `CHANGELOG.md` (CI match karta hai), tag `vX.Y.Z` |
| Load balancing / Service discovery | ✅ `deploy/nginx/lb.conf` (Docker DNS, failover); Kubernetes `Service` + DNS |
| Kubernetes / Helm | ✅ `deploy/k8s/*`, `deploy/helm/eduspark` — probes, PDB, HPA, zone spread, non-root |
| Terraform / IaC | ✅ `infra/terraform` (Worker + KV), `wrangler.toml`, `firebase.json` + `firestore.rules`. Terraform abhi sirf validate hota hai |
| Rolling / Canary / Blue-green / Rollback | ✅ `docs/DEPLOY.md` — K8s (Helm), Worker gradual versions, `ES.rollout` canary flags |
| Auto / Horizontal / Vertical scaling | ✅ HPA (horizontal); requests/limits (vertical sizing); Cloudflare Workers + Firebase khud scale hote hain |
| Multi-region | 🟡 Workers/Firebase/CDN managed; K8s me zone spread constraint |
| Chaos engineering | ✅ `ES.chaos` + `docs/CHAOS.md` game-day table |
| Cost optimization | ✅ `ES.debug().firestoreReads`, `ENABLED_SLOTS`, preflight cache, no retry on Worker quota errors — neeche numbers |

### Free-tier math (kahan paisa/limit khatam hoti hai)
| Resource | Free limit | EduSpark ka use |
|---|---|---|
| Firestore reads | 50,000/din | har student app kholne par ~board ke docs; **daily reminder slots: har enabled slot = token wale saare students ke reads**. 20,000 students × 3 slots = 60,000/din ⇒ `ENABLED_SLOTS='morning,evening'` (40,000) ya zyada students par slots aur kam |
| Worker KV writes | 1,000/din | har AI jawab = 1 write (+1 refund fail par) ⇒ poore app me ~1,000 AI jawab/din. Isiliye 502/503 par retry nahi |
| Workers requests | 100,000/din | AI + admin image auth |
| GitHub Actions | public repo: free · private: 2,000 min/mahina | `notifications.yml` har 20 min = ~2,160 runs/mahina (≥1 min each) + `watchdog` ~240 runs. **Repo private ho to ye limit paar kar sakta hai** |

## Batch 5 — Networking, alerts & runbooks
| Concept | Kahan |
|---|---|
| CAP, Network partitions, Replication, Eventual consistency, Sharding/partitioning, Leader election, Clock skew, DNS, TCP vs UDP, HTTP/1.1-2-3, gRPC, WebSockets / SSE / Long polling, CDN / Edge caching | 📖 `docs/NETWORKING.md` — har ek ke saath EduSpark me kya hota hai |
| Clock skew | ✅ code: `ES.checkClockSkew()` + toast (Pub/Sub se) |
| Pub/Sub | ✅ `ES.bus` |
| Webhooks | ✅ `scripts/lib/webhook.js` (sign / verify / retry / dedupe) |
| Alerts | ✅ `scripts/watchdog.js` + `watchdog.yml` → GitHub email / Telegram / Discord / Slack |
| DNS, TLS expiry | ✅ watchdog |
| WAF, DDoS | 📖🟡 `docs/RUNBOOK.md` §5 — layers + Cloudflare rules + **App Check (recommended, enable nahi hai)** |
| Production incidents, On-call, Post-mortem | ✅ `docs/RUNBOOK.md`, `docs/postmortems/TEMPLATE.md`, `.github/ISSUE_TEMPLATE/incident.yml` |
| API versioning | ✅ `docs/API.md` |

## Ab bacha kya (optional, tab karo jab zaroorat ho)
- Firebase **App Check** (bot se Firestore bachav) — reCAPTCHA keys chahiye.
- Worker daily-limit ke liye **Durable Object** (strict atomic counter).
- Firestore **rules tests** (emulator) — Java + firebase-tools chahiye.
- **CSP** header — pehle inline `onclick`/scripts ko nonce/event-listeners me badalna padega.
- Notification reads ghatane ke liye **FCM topics** (board-wise) — personalised naam chhodna padega.
