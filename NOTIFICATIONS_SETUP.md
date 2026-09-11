# 🔔 EduSpark Notifications — Setup Guide

Ye guide aapko **automatic app notifications** aur **"3 din se app nahi khola" reminder** feature ko chalu karne mein help karegi. Ye pura setup **bilkul FREE** hai — na Firebase Blaze plan chahiye, na koi paid server. Sirf ek baar, 10-15 minute ka setup hai.

Kaise kaam karta hai (short mein):
- App users ke phone ka ek "notification token" Firestore mein save karta hai (jab wo permission de dein)
- GitHub Actions naam ki free service har 20 minute mein background mein check karti hai:
  - Kya admin panel se koi naya notification bheja gaya hai? → turant bhej do
  - Kya koi student 3 din se app nahi khola? → unko naam lekar reminder bhej do

---

## Step 1 — VAPID Key generate karo (Firebase Console)

1. https://console.firebase.google.com par jaayein → apna project **eduspark-41703** kholein
2. ⚙️ (gear icon) → **Project settings**
3. Upar **Cloud Messaging** tab par click karein
4. Neeche **"Web Push certificates"** section mein, **"Generate key pair"** button dabayein
5. Ek key dikhegi (kuch aisi: `Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`) — ise copy kar lein

6. Ab `index.html` file mein ye line dhoondein (Ctrl+F se search karein):
   ```
   const FCM_VAPID_KEY = "PASTE_YOUR_VAPID_KEY_HERE";
   ```
   Aur `PASTE_YOUR_VAPID_KEY_HERE` ki jagah apni copy ki hui key paste kar dein.

---

## Step 2 — Service Account banao (ye GitHub Action ke liye chahiye)

1. Usi **Project settings** mein, **"Service accounts"** tab par jaayein
2. **"Generate new private key"** button dabayein → confirm karein
3. Ek `.json` file download hogi (jaise `eduspark-41703-firebase-adminsdk-xxxxx.json`) — **ise kisi ko share mat karna, ye bahut sensitive hai**

---

## Step 3 — GitHub Secret add karo

1. Apne GitHub repo (EduSpark-) par jaayein
2. **Settings** tab → left side mein **Secrets and variables** → **Actions**
3. **"New repository secret"** button dabayein
4. Name: `FIREBASE_SERVICE_ACCOUNT`
5. Value: Step 2 mein download hui `.json` file ko kisi text editor (Notepad) mein khol kar, **poora content copy karke yahan paste kar dein**
6. **Add secret** dabayein

---

## Step 4 — Naye files GitHub par upload karo

Is update ke saath ye naye files bhi mile hain, inhe apne repo mein waise hi upload/commit kar dein (GitHub web editor se "Add file → Upload files" use kar sakte hain, folder structure automatically maintain ho jaayega):

```
.github/workflows/notifications.yml
scripts/send-notifications.js
```

Baaki files (`index.html`, `admin.html`, `sw.js`) already updated hain — inhe replace kar dein.

---

## Step 5 — Test karo

1. Apni app khol kar ek naya profile setup karein (ya existing profile se dobara khol kar dekhein) — browser "Allow Notifications?" poochega, **Allow** dabayein
2. Admin panel (`admin.html`) kholein → **🔔 Notify** tab par jaayein → ek test title/message likh kar **Notification भेजें** dabayein
3. GitHub repo → **Actions** tab par jaayein → "EduSpark Notifications" workflow dikhega. Agar turant test karna hai to **"Run workflow"** button se manually bhi chala sakte hain — 20 minute wait nahi karna padega
4. Kuch second mein phone par notification aa jaani chahiye 🎉

3-din wala automatic reminder apne aap chalta rahega — usme kuch bhi manually karne ki zaroorat nahi.

---

## ⚠️ Zaroori baatein

- **GitHub Actions free hai**, lekin agar aapka repo 60 din tak bilkul inactive rahe (koi commit na ho) to GitHub scheduled workflows ko automatically pause kar deta hai. Bas ek chhota sa commit ya "Run workflow" dabane se dobara chalu ho jaata hai.
- **Firestore Rules check kar lein** — `students` aur `notificationQueue` naam ke do naye collections use ho rahe hain. Firebase Console → Firestore Database → Rules mein dekh lein ki inpar read/write allowed hai (jaise aapke `content`/`pyq`/`quizzes` collections ke liye already hoga).
- Service account `.json` file **kabhi bhi index.html/admin.html mein paste mat karna** — wo public files hain aur sabko dikhti hain. Sirf GitHub Secret mein hi rakhein.

Koi bhi step mein atke to bata dena — main help kar dunga.
