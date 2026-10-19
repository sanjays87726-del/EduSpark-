# Networking, consistency & real-time — EduSpark par kaise lagoo

Legend: ✅ app me hai · 🟡 platform sambhalta hai · ➖ is app me zaroorat nahi

## Consistency & distribution
| Concept | EduSpark me |
|---|---|
| **CAP theorem** | Network partition me Consistency ya Availability me se ek. **Content / PYQ / quiz padhna = Availability** (offline cache se, thoda purana chalega). **Username claim, doubt reply, notification claim = Consistency** (transaction, online chahiye; offline me fail ho jaata hai — galat jawab dene se behtar). Worker KV eventually-consistent (AP) hai, isliye daily-limit par per-student lock + (strict ke liye) Durable Object |
| **Network partitions** | Phone offline/flaky: AI turant "Internet बंद है" (bina request), breaker; Firestore writes queue hoti hain aur net aate hi jaati hain (`enablePersistence`); offline card + "वापस Online" toast |
| **Eventual consistency** | `onSnapshot` listeners UI ko server ke saath converge karte hain; KV counters thodi der me sab edges par dikhte hain |
| **Replication** | ✅🟡 Firestore multi-zone synchronous replication (database ka location console me dekho; baad me badla nahi ja sakta). KV globally replicated (eventual). Backup = alag jagah ki copy (`backup.yml` artifact). Read replicas ➖ (managed) |
| **Sharding / partitioning** | 🟡 Firestore khud key-range par shard karta hai. Hamari zimmedari: **hotspot na banana** — auto-ID docs (content, doubts, queue) ✅, sequential/timestamp-jaise IDs ❌ nahi, kisi ek doc par lagatar bahut writes ❌ nahi (`_config/flags` read-heavy, write kabhi-kabhi). **Logical partition = `board`**: har query `where board==X`, isliye student sirf apna hissa padhta hai aur notifications `audience` se. Badhne par: board-wise sub-collections |
| **Leader election** | Lambe samay ka leader nahi chahiye. **Lease-based**: `claimSlot` (din ka slot jeetne wali run), `claimQueueDoc` (10 min lease — crash par koi aur utha leti hai), GitHub `concurrency` group (ek waqt me ek run), Worker per-student lock |
| **Clock skew** | Server timestamps `serverTimestamp()`. Phone ka clock galat ho to streak/`dayKey()`/reminders bigadte hain → `ES.checkClockSkew()` server ke `Date` header se naapta hai, 10 min se zyada farak par ek toast. Server scripts GitHub runners par (NTP-synced) |

## Protocols
| Concept | EduSpark me |
|---|---|
| **DNS** | `eduspark.de5.net` — subdomain of a free domain provider. `watchdog` har 3 ghante resolve check karta hai. Cutover/rollback se pehle TTL 300 s karo. Installed PWA **origin se bandha** hai — domain badla to students ko dobara install karna padega, isliye domain stable rakho |
| **TCP vs UDP** | App ka sara traffic TCP (HTTPS). QUIC (UDP) tab jab browser + CDN HTTP/3 de. DNS UDP. Real-time voice/video nahi hai (live class YouTube par) ➖ |
| **HTTP/1.1 → 2 → 3** | 🟡 GitHub Pages/Cloudflare H2/H3 khud dete hain (DevTools → Network → Protocol me `h2`/`h3`). Single-file app = kam requests. Docker nginx plain HTTP/1.1 hai (TLS proxy ke peeche) — gzip ✅, keep-alive ✅ |
| **gRPC** | 🟡 Firestore SDK browser me gRPC-Web-jaisa WebChannel use karta hai; proxy/Wi-Fi par streaming tootne par `experimentalAutoDetectLongPolling: true` (index.html me ✅) long-polling par girta hai. Hamara Worker REST/JSON hai — browser native gRPC bol hi nahi sakta ➖ |
| **Webhooks** | ✅ `scripts/lib/webhook.js`: outbound (HMAC sign, retry + backoff, 4xx par ruk jao), inbound verify (timestamp tolerance = replay protection, constant-time compare, event-ID dedupe). Watchdog alerts yahi use karta hai |
| **Pub/Sub** | ✅ in-app `ES.bus` (module aapas me decoupled: `breaker:open`, `flags`, `clock:skew`); FCM push (server→device); `notificationQueue` (durable queue) |

## Real-time: WebSocket vs SSE vs long polling
| | Direction | Plus | Minus | EduSpark |
|---|---|---|---|---|
| WebSocket | 2-way | low latency | Workers par fan-out ke liye Durable Object chahiye, reconnect khud likho | ➖ abhi zaroorat nahi |
| SSE | server→client | auto-reconnect, simple, H2 par theek | 1-way | ➖ |
| Long polling | request→hold→reply | har jagah chalta hai | zyada requests | ✅ fallback (Firestore auto-detect) |
| **Firestore `onSnapshot`** | server→client (+offline cache) | real-time + cache + reconnect built-in | reads bill hote hain (`ES.debug().firestoreReads`) | ✅ **live-class banner, doubt jawab, content** |

Future live chat: Firestore collection + `onSnapshot` se shuru karo; hazaron concurrent users par Durable Object + WebSocket.

## CDN / edge caching
| Layer | Kya | Kaise |
|---|---|---|
| Static site | 🟡 GitHub Pages CDN ke peeche | HTML ko chhota cache; service worker stale-while-revalidate |
| Browser | ✅ `sw.js` (`CACHE_NAME` = invalidation), Firestore offline cache | naya version → toast |
| Quiz images | ✅ ImageKit CDN | admin Image tab |
| Worker JWKS | ✅ edge cache 1 ghanta (`cf.cacheTtl`), unknown key par throttled refresh | worker.js |
| Worker answers | ❌ cache nahi (`Cache-Control: no-store`) — har jawab user-specific + quota |
| Docker/nginx | ✅ shell `no-cache`, images 7 din | `deploy/nginx/default.conf` |
