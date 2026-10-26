# v1.6.0 — ek baar karne wale setup steps

## 1) Google sign-in app ke andar (One Tap / FedCM)
1. Firebase Console → Authentication → Sign-in method → **Google** → *Web SDK configuration* → **Web client ID** copy karo.
2. `index.html` me `var ES_GOOGLE_CLIENT_ID = '';` ke andar wahi paste karo.
3. Google Cloud Console → APIs & Services → Credentials → wahi *Web client* → **Authorized JavaScript origins** me `https://eduspark.de5.net` add karo (aur `https://www.eduspark.de5.net` agar use hota ho).
4. Firebase Console → Authentication → Settings → **Authorized domains** me `eduspark.de5.net` hona chahiye.
5. Khali chhodo to app purane Firebase popup se sign-in karta hai (chalta hai, par Google ka in-app account chooser nahi dikhta).

## 2) Firestore rules dobara publish karo
`firestore.rules` me `offers` ka public-read rule joda gaya hai — Firebase Console → Firestore → Rules me paste + Publish (ya `firebase deploy --only firestore:rules`). Iske bina students ko offerwall nahi dikhega.

## 3) Deploy
- `sw.js` ka `CACHE_NAME` v20 hai (har deploy par badalna zaroori).
- Notification sender (`scripts/send-notifications.js`) GitHub Actions se chalta hai — repo me push karo, koi naya secret nahi chahiye.

## 4) Quiz JSON — naye optional fields
```json
{ "title": "SSC CGL Mock 1", "passPercent": 40, "marksPerQ": 2, "negative": 0.5,
  "questions": [ { "q": "...", "options": ["A","B","C","D"], "ans": 1, "exp": "व्याख्या", "diff": "hard" } ] }
```
Admin panel me quiz form me `Passing %`, `हर सही प्रश्न के अंक`, `negative` ke input hain; `diff` (`easy`/`medium`/`hard`) question JSON me daalte hain. Kuch na daalo to board quiz 33%, competitive 40% required maana jata hai aur difficulty student ke time se anumaanit hoti hai.
