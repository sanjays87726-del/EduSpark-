# AI Worker API (v1)

Browser → Cloudflare Worker. Sirf EduSpark ke allowed origins se (CORS + server-side check).

```
POST https://<worker>/v1/ask          ← canonical
POST https://<worker>/                ← legacy alias (hamesha chalega — neeche "Versioning" dekho)
GET  https://<worker>/                ← status: {worker, version, apiVersions, RATE, GEMINI_KEY, DAILY_LIMIT}
Content-Type: application/json         (koi custom header nahi — warna CORS preflight fail hota hai)

{ "idToken": "<Firebase ID token>", "question": "…", "board": "CBSE-10", "subject": "Science", "topic": "Light" }
```

## Response
```
200  { "answer": "…", "left": 3, "apiVersion": 1 }
4xx/5xx  { "error": "<student ko dikhane layak Hindi message>" }     (5xx par extra "rid": "ab12cd34")
```

| Status | Matlab | Client kya kare |
|---|---|---|
| 400 | JSON galat / question 5 char se chhota | user ko message |
| 401 | token missing / invalid / expired | dobara Sign In |
| 403 | origin allowed nahi | — |
| 404 | path `/` ya `/v1/ask` nahi | — |
| 413 | body 16 KB se bada | — |
| 429 | (a) roz ki limit khatam (b) isi student ka pichhla sawal abhi chal raha hai | message dikhao, retry nahi |
| 500 | Worker setup/exception | breaker failure; `rid` log karo |
| 502 | Gemini fail (quota wapas kar di jaati hai) | retry **nahi** (har attempt KV writes lagata hai); breaker failure |
| 503 | KV daily write quota khatam | message dikhao; breaker par asar nahi |

Client (`ES.aiRequest`) ye sab handle karta hai: timeout 30 s, sirf network error par retry, 3 failures par circuit breaker.

## Versioning policy
- **Additive change (naya field, naya optional input)** = v1 me allowed. Clients unknown fields ignore karte hain.
- **Breaking change** (field hataya/naam badla/meaning badli) = naya path `/v2/ask`. `/v1/ask` aur `/` **kam se kam 90 din** chalte rahenge.
- Wajah: PWA ka purana `index.html` service worker me cache rehta hai — students hafton tak purana client chala sakte hain. Worker ko hamesha purane clients ke saath compatible rakho.
- `/` (legacy) ko tab tak mat hatao jab tak Worker logs me uska traffic ~0 na dikhe.
- Contract tests: `tests/worker.test.mjs` ("contract", "API versioning") — response ke keys pinned hain; badlav jaan-boojh kar hi karo.
