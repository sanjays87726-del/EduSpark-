# EduSpark — Mistakes Notes (yaad rakhne ke liye)

| # | Galti | Kahan | Status |
|---|-------|-------|--------|
| 1 | Doubt `text ≤ 2000` rules me hai par input par limit nahi thi → lamba doubt "Error" deta tha | index.html | Fixed (maxlength 200/2000/100) |
| 2 | **Meri galti (Batch 1):** 502/503 retry hota tha aur Worker ka asli message dab jata tha. Worker me har attempt = KV ke 2 writes (free 1000/din), 503 = "aaj ka quota khatam" | es-ops (index.html) | Fixed: sirf network error retry, Worker ka message dikhta hai, 503 se breaker nahi khulta |
| 3 | Content ka title/option/explanation/link bina escape ke innerHTML / onclick me jaata tha (XSS) | index.html | Fixed (allow-list sanitize + safeUrl) |
| 4 | Search box ka text "kuch nahi mila" message me bina escape | index.html | Fixed |
| 5 | Worker: JWKS 1 ghante cache — Google naya key de to students 401 | worker.js | Fixed (fresh fetch, 60s throttle) |
| 6 | Worker: body size limit nahi, `null` body par 500 | worker.js | Fixed (16KB, 400/413) |
| 7 | Daily limit KV get→put se: parallel requests limit cross kar sakte (atomic nahi) | worker.js | Partly fixed (Batch 3: per-student lock, isolate ke andar). Poori guarantee = Durable Object (optional) |
| 8 | `admin.html` Image tab `/imagekit-auth` maangta hai, par upload hui worker.js (v5) me ye route nahi | worker | Open — deployed worker ka code chahiye |
| 9 | In-app `privacyModal` ka Ads section ("abhi koi ad nahi") vs privacy.html (ads dikh sakte hain) — dono ab 23 Oct ko update hue par Ads wala paragraph abhi bhi alag hai | index.html | **Open** — Ads paragraph ek jaisa karo |
| 10 | Rules: `students` delete `dev_*` ke liye har kisi ko open (non-login users ke liye jaan-boojh kar) | firestore.rules | Open — anonymous auth se hi band hoga |
| 11 | Fail hua broadcast hamesha ke liye "failed" rehta tha, retry nahi; do runs ek broadcast do baar bhej sakti thin | send-notifications.js | Fixed (lease lock, retry 20/40 min, 3 kosish ke baad `dead`) |
| 12 | Account delete me doubts N alag delete (N+1), beech me fail par pata nahi kaun sa step | index.html | Fixed (400-400 batch + saga step naam) |
| 13 | Admin doubt-reply bina check ke overwrite karta tha | admin.html | Fixed (transaction) |
| 14 | Admin notification history me `dead`/`sending` galat "Pending" dikhte, text escape nahi | admin.html | Fixed |
| 15 | `sw.js` ka `CACHE_NAME` har deploy par badalna zaroori — warna student ko purana version dikhta rahega | sw.js | Toast laga diya; v19 kiya. **Har deploy par number badlo** |
| 16 | Batch 3 test me fake DB khaali collection bana deta tha, migrate "badal raha" lag raha tha — asli code galat nahi tha (test helper theek kiya) | tests | Closed |
| 17 | K8s `deployment.yaml` me `replicas: 2` + HPA dono — har `kubectl apply` scaling reset karta. Meri apni galti, `tools/check-manifests.py` ne pakdi | deploy/k8s | Fixed (replicas hata, HPA min 2) |
| 18 | `index.html` `/about.html` aur `/contact.html` kholta hai, par ye files uploaded project me nahi thi — repo me na hon to Profile me 404 dikhega | repo | **Open — repo me check karo** (`npm run check` bata dega) |
| 19 | Daily reminder slots har baar token wale SAARE students padhte hain: 20,000 × 3 slots = 60,000 reads/din (free 50,000) | send-notifications.js | Lever diya (`ENABLED_SLOTS`); students badhne par slot kam karo / topics par jao |
| 20 | `notifications.yml` har 20 min = ~2,160 runs/mahina; repo **private** ho to GitHub free 2,000 min/mahina paar ho sakti hai | workflows | Open — repo public hai to chinta nahi |
| 21 | Docker/Helm/Terraform/Kubernetes tools yahan sandbox me nahi the — inke tests sirf CI me chalenge (YAML syntax + manifest logic yahan check hui) | CI | Pehli CI run dhyan se dekho |
| 22 | **Meri galti:** Batch 2 ke list me "API versioning, Cold starts, Serverless limits" gina diye par us waqt na code tha na doc | docs / worker | Fixed in Batch 5 (`/v1/ask`, `docs/API.md`, ARCHITECTURE rows) |
| 23 | Worker ab `/` aur `/v1/ask` ke alawa har path par 404 deta hai — `admin.html` ka `/imagekit-auth` route is worker me tha hi nahi (pehle bhi AI handler me girta tha) | worker.js | **Open** — deployed worker me image-auth route ho to ye file mat chadhao, mujhe code bhejo |
| 24 | App Check enable nahi — Firestore ka public `apiKey` script se hit ho sakta hai (rules limits hain par rate-limit nahi) | Firebase | Open — RUNBOOK §5 |
| 25 | `ES.checkClockSkew` HTTP `Date` header (1 sec resolution) par tikka hai — chhote skew (<10 min) pakadne ke liye nahi bana | index.html | Known limit |
| 26 | Sign-in: popup band karne par (`popup-closed-by-user`) code seedha `signInWithRedirect` par bhej deta tha — student app se bahar nikal jata | index.html | Fixed (ab chupchap rukta hai) |
| 27 | `signInWithRedirect` custom domain (`eduspark.de5.net`) + `firebaseapp.com` authDomain par naye browsers me storage-partition se silently fail hota hai ("sign in kaam nahi karta") | index.html / Firebase | Fixed: Google Identity Services se `signInWithCredential`. **Tumhe karna hai:** Web client ID paste + Google Cloud me origin add (neeche notes) |
| 28 | Sign-in errors par sirf raw message dikhta tha | index.html | Fixed (`authErrMsg`, Hindi) |
| 29 | Back guard boot par bina user-touch ke push hota tha — Chrome aisi history entry back par **skip** kar deta hai → kabhi-kabhi app seedha band | index.html | Fixed (pehle touch par arm) |
| 30 | Back handler me error aaye to `armBackGuard()` chalta hi nahi tha → agla back app band | index.html | Fixed (guard pehle, handler baad me, try/catch) |
| 31 | Legal iframe ka `src` set karna browser history me entry banata tha → back 2 baar dabana padta | index.html | Fixed (`location.replace`) |
| 32 | Offer popup / sign-in sheet back button se band nahi hote the | index.html | Fixed |
| 33 | `firestore.rules` me `offers` ka rule hi nahi tha → students ke liye permission-denied, offerwall khali (admin save karta par students ko na dikhta) | firestore.rules | Fixed — **rules dobara publish karo** (Firebase Console → Firestore → Rules) |
| 34 | Naye student ko purani admin notifications dikhti thin aur bell badge me bhi gini jati thin | index.html | Fixed (profile date se purani nahi) |
| 35 | Daily notification swipe se hatane par agli app-open par wapas aa jati — isliye hatayi hui ids yaad rakhte hain (`es_notif_dismissed`) | index.html | Fixed |
| 36 | `sw.js` ne offer ka bahar ka link hamesha `/` bana diya tha aur push me image ka support nahi tha | sw.js | Fixed (sirf `kind:'offer'` + https) |
| 37 | Notification sender sirf title/body bhejta tha — offer ki image/link nahi | scripts/send-notifications.js | Fixed (`buildFcmMessage`) |
| 38 | Practice quiz me answer ke baad sirf rang badalta tha, vyakhya sirf result page par thi | index.html | Fixed (turant feedback + `exp`) |
| 39 | Umar ka sawaal hatane ke baad `age` unknown hai — isliye usage analytics/Clarity naye students ke liye band (bachchon ki privacy, DPDP Act). Agar analytics chahiye to alag consent + umar ka tareeka chahiye | index.html | **Dhyan:** jaan-boojh kar band; privacy text update kiya |
| 40 | `tests/worker.test.mjs` ke 2 purane tests fail (`GET status v9`, `imagekit-auth`) — admin password-gate/worker v9 ke baad test update nahi hue. Is kaam se pehle bhi fail the | tests | **Open** — worker tests naye gate ke hisaab se update karo |
| 41 | Consent checkbox me crash reports bhi bundled hain (tumhari maang: ek checkbox). Text me saaf likha hai; chahein to crash reports ko alag optional rakh sakte hain | index.html | Note |
