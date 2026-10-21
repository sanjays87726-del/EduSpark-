# EduSpark Runbook — incidents, alerts, on-call

## 1. Alerts: kaun batata hai
| Source | Kya dekhta hai | Kitni der me | Kaise pahunchta hai |
|---|---|---|---|
| UptimeRobot | site + AI Worker URL | ~5 min | email / app |
| `watchdog.yml` | site, sw.js, Worker bindings, DNS, **TLS expiry**, **dead-letter broadcasts**, atke "sending", **backup freshness** | 3 ghante | run laal ⇒ GitHub email; optional Telegram / Discord / Slack |
| `notifications.yml` | broadcast 3 kosish ke baad `dead` | 20 min | run laal ⇒ GitHub email |
| `backup.yml` / `migrate.yml` | fail | — | GitHub email |
| Sentry | JS crashes (sirf jinhone crash-consent diya) | turant | Sentry alert rule: "new issue" |
| Firebase / Google Cloud | usage | — | Billing → Budgets & alerts (50% / 90%) set karo |

Setup (ek baar): Telegram me bot banao (@BotFather) → repo Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Discord/Slack ke liye `ALERT_WEBHOOK_URL` (+ `ALERT_WEBHOOK_STYLE=discord|slack`).
Alert fatigue se bacho: **error** = abhi dekho, **warning** = hafte me ek baar.

## 2. Severity
| Level | Matlab | Misal | Target (akela developer, realistic) |
|---|---|---|---|
| SEV1 | sab ke liye band / data loss / security | site down, sign-in toota, secret leak | 1 ghante me ack, 4 ghante me mitigate |
| SEV2 | bada feature band | AI, notifications, quiz load | 4 ghante me ack, 1 din me fix |
| SEV3 | chhota / workaround hai | ek PYQ link toota | agle release me |

## 3. Pehle 5 minute
1. **Ack** — incident issue kholo (`.github/ISSUE_TEMPLATE/incident.yml`), severity likho.
2. **Scope** — kitno ko, kab se? `ES.debug()` (student ke phone par), Worker `GET /`, GitHub Actions, Firebase status.
3. **Recent change?** — `git log -5`, aakhri deploy. Shak ho to **pehle rollback, baad me diagnose** (`docs/DEPLOY.md`).
4. **Mitigate** — feature flag: `_config/flags` → `{ai:false}` / `{doubts:false}`; Worker rollback; `restore.js`.
5. **Communicate** — app me broadcast (Admin → Notify) ya WhatsApp/Telegram group.

## 4. Symptom → jaanch → ilaaj
| Symptom | Jaanch | Ilaaj |
|---|---|---|
| "AI अभी जवाब नहीं दे रहा" (breaker) | Worker URL kholo: `RATE` & `GEMINI_KEY` true? Gemini key/quota? `ES.debug().logs` me `rid` → Worker logs | key/binding theek karo; zaroorat ho to `{ai:false}`; Worker rollback |
| "आज का AI quota पूरा" (503) | KV writes 1,000/din limit (dashboard → KV) | `DAILY_LIMIT` ghatao ya plan upgrade; jawab 1 write lagta hai |
| "आज के N AI जवाब पूरे" (429) | normal — student ki daily limit | kuch nahi |
| Notifications nahi pahunch rahe | watchdog "dead-letter"; Actions run log; admin Notify history ka status | FCM/service-account error theek karo → Firestore console me doc `status:'pending'`, `attempts:0` (dobara try) |
| `resource-exhausted` / reads khatam | `ES.debug().firestoreReads`; Firestore → Usage | `ENABLED_SLOTS` kam karo; Blaze + budget alert |
| Sign-in nahi ho raha | Firebase → Auth → Settings → **Authorized domains** me `eduspark.de5.net`; popup block | domain jodo; redirect fallback chalta hai |
| Galat/delete hua content | `backups/*.json` (Actions artifact) | `node scripts/restore.js file.json` (dry-run) → `ONLY=content APPLY=1 …` |
| Naya deploy toota | CI laal? students ko toast mila? | `git revert` + `CACHE_NAME` +1 ; Worker: `deploy-worker.yml` → rollback |
| Site khula nahi | GitHub Status, watchdog DNS/TLS line | DNS/certificate; fallback `*.github.io` URL |
| Secret leak (GEMINI_KEY, service account) | — | **turant rotate**: nayi key banao → Worker secret + GitHub secret update → purani delete; Firebase service account key delete/naya |

## 5. Abuse, WAF aur DDoS
Layers (andar se bahar):
1. 🟡 **Host/CDN** (GitHub Pages / Cloudflare) volumetric DDoS khud absorb karta hai.
2. ✅ **Worker (application-level "WAF")**: origin allow-list, body ≤ 16 KB, Firebase ID token zaroori (bina login koi quota nahi), per-student ek request, 5 jawab/din, fixed outbound URLs (SSRF nahi).
3. ✅ **Firestore rules**: har write par auth + field/size limits; admin-only collections.
4. 🟡 **Cloudflare WAF** (sirf tab jab domain ka zone Cloudflare par ho — `workers.dev` URL par zone-WAF nahi lagta): Bot Fight Mode ON; rate-limit rule — `(http.request.method eq "POST" and http.host eq "<worker-custom-domain>")` → 20 req/min/IP, action Block 10 min; emergency: **"Under Attack"**.
5. ➖→**Recommended: Firebase App Check** (reCAPTCHA v3). Firestore ka `apiKey` public hai (design se), isliye script se seedha Firestore hit ho sakta hai. App Check pehle *monitor mode*, phir enforce. (Keys chahiye — abhi enable nahi.)

Hamla chal raha ho to: `{ai:false}` → Cloudflare "Under Attack" → Firebase Console me kharab uid ko disable → baad me post-mortem.

## 6. On-call (akela developer)
- **Hours**: roz ek fixed slot me alerts dekho (jaise subah + shaam); raat ko sirf SEV1 (Telegram sound ON).
- **Backup person**: ek bharose ka dost — GitHub *Read* + Firebase *Viewer* + ye runbook. Kisi ko admin password/secret mat do.
- **Chhutti/exam**: pehle `watchdog` Telegram test (`Run workflow`), phir `ENABLED_SLOTS` aur AI limit sochi-samajhi rakho.
- **Handoff checklist**: open incidents, pending dead broadcasts, aakhri backup tareekh, expiring cert/domain.

## 7. Post-mortem
SEV1/SEV2 ke baad 48 ghante me, **blameless**: `docs/postmortems/TEMPLATE.md` copy karo → `docs/postmortems/YYYY-MM-DD-short-name.md`. Action items GitHub issues (label `action-item`) — har ek ka owner + tareekh. Mahine me ek baar purane action items dekho; `NOTES-mistakes.md` update karo.
