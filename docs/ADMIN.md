# EduSpark Admin Panel v2 — kaise chalta hai, kaise set karein

Mantra: **"badi companies jaisa" = app ka behaviour data/config se chale, har baar code push na karna pade.**
Isliye: (1) student app ab `_config/app` live padhta hai, (2) admin panel se content publish/unpublish, block, maintenance, announcement, force-update, (3) har kaam ka log, (4) role + password ke taale.

## 1. Menu (tumhare notes ke A–M) — kya chalu hai, kya "Soon"

| | Section | Chalu hai (✅) | Soon (🚧, wajah menu me likhi hai) |
|---|---|---|---|
| A | Main | Dashboard, analytics, daily/weekly/monthly, quick actions | — |
| B | User Management | All students (search/detail/edit), **Block/Unblock**, Blocked list, Staff & Roles | Student Groups (R1) |
| C | Academic | Classes & Subjects (dekhna), Notes/PDF jodna | Chapters/Topics/Syllabus/Calendar (R1) |
| D | Course | All Courses, **Publish/Unpublish**, Edit, Delete, Add | Categories/Pricing/Enrollments/Reviews (R3) |
| E | Question Bank | Add Questions / Bulk Import (JSON) | Types & Categories (R2) |
| F | Exam | All Exams, Create Exam/Mock, PYQ | Schedule & Instructions (R2) |
| G | Result | — | Results, Merit/Topper, Certificates (R2) |
| H | Finance | — | Payments, Coupons, Invoices (R3) |
| I | Communication | Push Notifications, **Notification Health**, Announcement bar, Live class, Community | Email/SMS (R4) |
| J | Content & Media | Banners & Offers, Image Library | Home sections, Ads, File manager (R1) |
| K | Support | Student Doubts | Tickets/Feedback/FAQ (R5) |
| L | System & Security | **Settings (Remote Config + Maintenance)**, Activity Logs & Login history, Security & Sessions, Backup info, Staff | — |
| M | Reports | Student/Content/Quiz/PYQ/Doubts/Notification/Log reports -> CSV, Print -> PDF | Payment/Attendance reports (jab data ho) |

## 2. Suraksha ke 4 taale (aur unki sachchi seema)

1. **Google email** — Super Admin = `ADMIN_EMAIL` (code me wahi, rules me wahi). Staff = `staff/{email}` doc me `active:true` + role. *Asli data-lock yahi + `firestore.rules` hai.*
2. **Panel password** — Worker secret `ADMIN_PASS` sirf Admin Panel kholta hai; ye kisi section ko unlock nahi karta. `SUPER_ADMIN_PASS` se login karne par Super Admin ko sabhi sections ka access milta hai. Staff ke liye `PASS_STAFF`. 12 ghante ke signed tokens; dono admin secrets apne-apne tokens invalidate karte hain.
3. **Section password** — `PASS_USERS`, `PASS_FINANCE`, ... (12 section). `SUPER_ADMIN_PASS` sabhi sections kholta hai; `PASS_<SECTION>` sirf apna section kholta hai; `ADMIN_PASS` aur `PASS_STAFF` sections unlock nahi karte. Secret set nahi to wo section khula rehta hai. 15 min idle / app 5 min background / 🔒 button -> sab dobara lock.
4. **Activity log** — har create/update/delete (collection + doc id + field ke *naam*, value nahi) + login/logout/unlock/export `adminLogs` me; staff use badal/delete nahi sakta; sirf Super Admin padhta hai.

⚠️ Section password ek **extra taala** hai (khula phone, kandhe ke upar se nazar). Koi tech-savvy aadmi Google login ke saath browser JS badalkar UI-taala langh sakta hai — isliye Google account par **2-Step Verification** zaroori (NOTES #48).

## 3. Roles

| Role | Dikhta hai | Rules se bhi lagu |
|---|---|---|
| Super Admin | sab | `isAdmin()` |
| Editor | Content, Quiz, PYQ, Courses, Academic | `content`/`quizzes`/`pyq` write |
| Teacher | Editor + Student Doubts | + `doubts` read/update |
| Notifier | Push Notifications | `notificationQueue` write |

Staff banana: Admin -> User Management -> **Teachers, Staff & Roles** -> Gmail + role. Staff Google se login kare + `PASS_STAFF` dale. Image upload sirf Super Admin (NOTES #50).

## 4. Deploy ka kram (zaroori)

1. `firestore.rules` publish — GitHub -> Actions -> **deploy-rules**.
2. `worker.js` deploy (v11) — Actions -> **deploy-worker** (`upload`, phir gradual `deploy`).
3. Cloudflare Worker `bold-dust-6f37` me `ADMIN_PASS` (panel-only), naya alag `SUPER_ADMIN_PASS` (master), `PASS_STAFF`, aur zaroori `PASS_<SECTION>` secrets set karein. `ADMIN_PASS` ko delete na karein—ab wahi panel-only password hai. Dashboard -> Settings -> Variables and Secrets -> Secret. Password GitHub/chat me kabhi na bhejein.
4. Site push (GitHub Pages). `sw.js` cache `eduspark-v22.0` apne-aap naya version dega.
5. Admin kholo -> **Security & Sessions** me har section ka status dekho.

Purana ops-portal-7c91e4.html + naye rules bhi chalte hain (rules additive). Safe rollout: (1) Cloudflare me existing `ADMIN_PASS` ki current value ko jaisa hai waisa hi rakhein; (2) ek naya, alag `SUPER_ADMIN_PASS` secret add karein; (3) Worker v13 deploy karein; (4) `ADMIN_PASS` se panel-only login aur `SUPER_ADMIN_PASS` se all-sections access test karein; (5) har section ke liye zaroori `PASS_<SECTION>` set karein; (6) site deploy karein. `ADMIN_PASS` ko rename/delete karne ki zaroorat nahi.

## 4A. Admin URL aur fail-closed security

- Admin page ab `/ops-portal-7c91e4.html` par hai; purana `/admin.html` file hata diya gaya hai (deploy ke baad purana path 404 hona chahiye).
- Ye random URL sirf discovery kam karta hai, authentication nahi. Static hosting par HTML source kisi ko bhi mil sakta hai; sensitive Firestore data ka asli lock verified Google account + `firestore.rules` hai.
- Admin entry token aur section tokens ko har baar Cloudflare Worker ke `/admin-verify` se verify karna zaroori hai. Worker unavailable ya invalid response par panel/section band rahega (fail closed).
- Admin Google account par 2-Step Verification on rakhein; admin URL ko public post/share na karein.


## 5. Remote Config — `_config/app` (Settings page se)

| Field | Student app me asar |
|---|---|
| `maintenance.on / message` | poori screen "Maintenance" — live, reload ke bina |
| `minVersion / updateMessage` | app version isse purana ho to "Update" screen (cache saaf + reload). **live version se bada nahi rakh sakte** |
| `announcement.on / text / link / id` | Home ke upar patti; dismiss karne par wahi `id` dobara nahi; text badalne par naya `id` |
| `appName`, `logoUrl` | top bar ka naam/logo (https only, text me insert — HTML nahi) |
| `website`, `contactEmail`, `whatsapp`, `instagram`, `privacyUrl`, `termsUrl` | **abhi sirf record** (app me jodna Roadmap R1) |

Pichhli config `localStorage (es_rc)` me — app khulte hi turant lagti hai; Firestore offline ho to bhi.

## 6. Blocked students (`blockedUsers/{uid}`)
App me "account roka gaya" screen (+ Logout), naye doubts rules se band, notification sender skip. Content public hai (NOTES #53). Block student ke apne `students` doc se alag collection me hai taaki wo doc delete karke block hata na sake.

## 7. Live par ek baar ye 7 cheezein dekho (15 min) — mai yahan live nahi dekh sakta (NOTES #59)

1. Naye rules publish ke baad ek **doosra Gmail Teacher** banao -> usse staff password + Google login: content add/publish ho jaye, **Students/Settings na dikhein**.
2. Security & Sessions me saare sections 🔒 dikhen; ek section kholkar galat password de -> error, sahi par khule.
3. Settings: Announcement ON -> apne phone ke app me patti aaye (bina reload, ya 1–2 sec me); OFF karo.
4. Maintenance ON -> app band screen; **OFF karna na bhoolo**.
5. Ek test student ko Block -> uske phone me block screen; Unblock.
6. Notification Health kholo — `lastRun`, token %, queue. (cron ka asli karan yahin se dikhega — NOTES #47.)
7. Dashboard ke aankde sahi lag rahe hain? (Agar kisi aankde ke saath "+" dikhe to REST count nahi chala; tab 1000 par ruka hai.)

## 8. Roadmap (menu ke "Soon")

- **R1** Data-driven structure: Boards/Subjects/Chapters, Home sections, contact/privacy links `_config` se.
- **R2** Cloud results + Question Bank + Exam schedule. *Supabase (SQL + Row Level Security) yahan sabse achha rahega* — results/leaderboard/certificate relational hain. Firebase Auth rahega; Supabase me Firebase JWT verify karke RLS (third-party auth) ya Worker ke through likhna. `service_role` key kabhi repo/ops-portal-7c91e4.html me nahi, sirf Worker secret.
- **R3** Payments (Razorpay) + enrollments + coupons.
- **R4** Email/SMS (provider + verified phone).
- **R5** Support tickets / feedback / FAQ.

## 9. Tests
`npm test` (unit + consistency, 18 files) · `node tests/browser/admin.smoke.mjs` / `index.smoke.mjs` (asli Chromium, nakli Firebase) — `tests/browser/README.md`.
