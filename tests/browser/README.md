# Browser smoke tests (optional — `npm test` me nahi chalte)

Asli browser (Chromium) me `ops-portal-7c91e4.html` aur `index.html` kholkar check karte hain — Firebase ki jagah `fakefb.js` (in-memory nakli Firebase) lagta hai, isliye internet/Firebase ki zaroorat nahi.

```bash
npm i --no-save playwright && npx playwright install chromium     # ek baar
node tests/browser/admin.smoke.mjs     # gate -> role -> menu -> section lock -> students/block -> settings -> logs -> reports -> mobile drawer
node tests/browser/index.smoke.mjs     # Home button/login wall, notification back, dark-mode icon, remote config, block screen, drafts
```
Playwright kisi aur jagah installed ho to: `PW_MODULE=/path/to/playwright/index.mjs CHROME_PATH=/path/to/chrome node tests/browser/admin.smoke.mjs`.
Screenshots `tests/browser/out-*.png` me banti hain (git me nahi jaati).
