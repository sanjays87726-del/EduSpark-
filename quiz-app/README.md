# EduSpark Quiz

Hindi-first practice for Classes 6–12 and competitive exams: quizzes, immediate practice, a timed mock, bookmarks, streaks, a leaderboard, and a staff console.

The live app runs on this workspace’s stack — **TanStack Start, Postgres, and Better Auth** — not Firebase. Scoring, roles, and answer keys stay on the server. A Firebase project is not connected, and no service-account keys are stored here.

## What you can do

- Create an account with email and password, or continue with Google or X.
- Browse classes, exams, subjects, and published quizzes. Sample items are labeled and are **not** an official syllabus.
- Finish a quiz. The server grades it. The timer deadline is stored when the attempt starts.
- Practice with instant explanations, or revise wrong and bookmarked questions.
- Take the SSC GD mini mock (negative marks, hidden answers, auto-submit).
- Take today’s quiz once per Asia/Kolkata date.
- See real stats, a 14-day chart, badges, and bookmarks. A new account starts at zero.
- Opt in or out of the leaderboard. Ranks use each quiz’s **best** score. Emails are not shown.
- The first account becomes an admin. Teachers and admins get the admin panel. Students cannot change their own role.

## Stack

- React 19, TypeScript, TanStack Start / Router / Query, Tailwind CSS 4
- Better Auth: email/password, Google, and X
- Postgres when deployed; an embedded Postgres in the live preview
- Vitest is not used. Scoring tests run with Node’s test runner.

## Accounts and data

Sign-in and the database are provisioned with the deployed app. Do not add a `.env` file. `DATABASE_URL` and auth credentials are injected on deploy and must stay on the server.

Optional server-only list (never a `VITE_` variable):

- `EDUSPARK_ADMIN_EMAILS` — comma-separated emails that are promoted to admin.

If that list is empty, the first profile becomes admin. Later admins are assigned in the admin panel. A person cannot edit their role from their profile.

Password-reset email is not sent: the auth server has no mail hook. Change the password from Settings after signing in, or use Google / X. Email-verification mail is also not sent.

## Local checks

```bash
npm run dev
npm test
npm run typecheck
npm run build
```

Demo questions load automatically the first time the catalog is read. They are original items in `src/lib/eduspark/demo-data.ts`.

## Authorization

| Action | Who |
| --- | --- |
| Read published quizzes | Anyone |
| Attempts, bookmarks, profile | That signed-in user only |
| Answer keys during an exam | Nobody (stored on the attempt) |
| Explanations | After submit, or after Check in practice |
| Drafts, import, publish | Teacher or admin |
| Roles, audit log, leaderboard switch | Admin |
| Client-submitted score | Ignored. The server grades. |

There is no Firestore rules file because this app does not use Firestore. The rules above are enforced in `src/lib/eduspark/api.ts` with the verified session id.

## Leaderboard tie-break

Higher points, then higher accuracy, then the earlier first submission.

## Known limits

- Demo content only. Not a board or SSC paper.
- Rate limits live in process memory.
- Editing a question does not rewrite an attempt already started; grading uses the key saved at the start.
- Account deletion removes the auth user and learning rows. The last admin cannot be deleted.
- Outbound password-reset and verification email are unavailable.

## Later

Richer bulk editing, official syllabi after a source check, and a shared rate-limit store.
