import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { RequireUser } from "@/components/gate";
import { Btn, Card, Empty, ErrorNote, PageSkeleton, explainError, inputClass } from "@/components/kit";
import { usePrefs } from "@/components/prefs";
import { authClient, signOut } from "@/lib/auth/client";
import {
  deleteAccount,
  getLeaderboard,
  getProgress,
  getTaxonomy,
  listBookmarks,
  saveProfile,
  toggleBookmark,
} from "@/lib/eduspark/api";
import type { Profile, ThemeChoice } from "@/lib/eduspark/types";

function tx(lang: "hi" | "en", hi: string, en: string) {
  return lang === "en" ? en : hi;
}

export function ProgressPage() {
  return <RequireUser><ProgressBody /></RequireUser>;
}

function ProgressBody() {
  const { bi, lang } = usePrefs();
  const progress = useQuery({ queryKey: ["progress"], queryFn: () => getProgress() });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (progress.isPending) return <PageSkeleton />;
  if (progress.isError || !progress.data) return <ErrorNote text={explainError(progress.error, bi)} onRetry={() => void progress.refetch()} />;
  const data = progress.data;
  const answered = data.correct + data.incorrect;
  const accuracy = answered ? Math.round((data.correct / answered) * 1000) / 10 : 0;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{bi("मेरी प्रगति", "My progress")}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Card><p className="text-xs text-muted">{bi("सटीकता", "Accuracy")}</p><p className="text-2xl font-semibold tabular-nums">{accuracy}%</p></Card>
        <Card><p className="text-xs text-muted">{bi("लगातार दिन", "Streak")}</p><p className="text-2xl font-semibold tabular-nums">{data.streak}</p></Card>
        <Card><p className="text-xs text-muted">{bi("सही / गलत", "Correct / wrong")}</p><p className="text-2xl font-semibold tabular-nums">{data.correct}/{data.incorrect}</p></Card>
        <Card><p className="text-xs text-muted">{bi("मॉक", "Mocks")}</p><p className="text-2xl font-semibold tabular-nums">{data.mocks}</p></Card>
      </div>
      <Card>
        <h2 className="font-semibold">{bi("पिछले 14 दिन", "Last 14 days")}</h2>
        <div className="mt-3 h-56">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.activity.map((day) => ({ ...day, label: day.date.slice(5) }))}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} width={28} />
                <Tooltip />
                <Bar dataKey="questions" fill="var(--primary)" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">{bi("विषय", "Subjects")}</h2>
        {data.subjects.length === 0 ? <p className="mt-2 text-sm text-muted">{bi("अभी डेटा नहीं।", "No data yet.")}</p> : (
          <ul className="mt-2 space-y-2 text-sm">
            {data.subjects.map((subject) => (
              <li key={subject.subjectId} className="flex justify-between">
                <span>{tx(lang, subject.nameHi, subject.nameEn)}</span>
                <span className="tabular-nums">{subject.correct}/{subject.correct + subject.incorrect}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="font-semibold">{bi("बैज", "Badges")}</h2>
        <ul className="mt-2 space-y-2">
          {data.achievements.map((badge) => (
            <li key={badge.id} className={badge.awardedAt ? "" : "text-muted"}>
              <p className="font-medium">{tx(lang, badge.nameHi, badge.nameEn)}</p>
              <p className="text-sm">{tx(lang, badge.descriptionHi, badge.descriptionEn)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function LeaderboardPage() {
  return <RequireUser><BoardBody /></RequireUser>;
}

function BoardBody() {
  const { bi } = usePrefs();
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  const [quizId, setQuizId] = useState("");
  const board = useQuery({
    queryKey: ["board", period, quizId],
    queryFn: () => getLeaderboard({ data: { period, quizId: quizId || undefined, offset: 0 } }),
  });
  if (board.isPending) return <PageSkeleton />;
  if (board.isError || !board.data) return <ErrorNote text={explainError(board.error, bi)} onRetry={() => void board.refetch()} />;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{bi("लीडरबोर्ड", "Leaderboard")}</h1>
      <p className="text-sm text-muted">{bi("हर प्रश्नोत्तरी का सबसे अच्छा अंक। दोहरा प्रयास रैंक नहीं बढ़ाता। नाम दिखता है, ईमेल नहीं।", "Best score on each quiz. Repeats do not add points. Names only, never emails.")}</p>
      <div className="flex gap-2">
        {(["week", "month", "all"] as const).map((item) => (
          <Btn key={item} type="button" variant={period === item ? "primary" : "outline"} onClick={() => setPeriod(item)}>
            {item === "week" ? bi("सप्ताह", "Week") : item === "month" ? bi("महीना", "Month") : bi("कुल", "All")}
          </Btn>
        ))}
      </div>
      <input className={inputClass} value={quizId} onChange={(e) => setQuizId(e.target.value.trim())} placeholder={bi("किसी प्रश्नोत्तरी का आईडी, वैकल्पिक", "Optional quiz id")} aria-label="quiz" />
      {!board.data.enabled ? <Empty title={bi("बंद है", "Turned off")} body={bi("व्यवस्थापक ने लीडरबोर्ड बंद किया है।", "An admin turned the leaderboard off.")} /> : null}
      {board.data.enabled && board.data.rows.length === 0 ? <Empty title={bi("अभी खाली", "No ranks yet")} body={bi("क्विज़, मॉक या दैनिक परीक्षा का अंक यहाँ आएगा।", "Quiz, mock, or daily scores will appear here.")} /> : null}
      <ol className="space-y-2">
        {board.data.rows.map((row) => (
          <li key={row.rank} className={`flex items-center justify-between rounded-2xl border px-3 py-3 ${row.mine ? "border-primary bg-primary-soft" : "border-line bg-surface"}`}>
            <span className="font-semibold tabular-nums">{row.rank}</span>
            <span className="flex-1 px-3">{row.displayName}{row.mine ? ` · ${bi("आप", "You")}` : ""}</span>
            <span className="text-right text-sm tabular-nums">{row.points} · {row.accuracy}%</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function BookmarksPage() {
  return <RequireUser><MarksBody /></RequireUser>;
}

function MarksBody() {
  const { bi, lang } = usePrefs();
  const client = useQueryClient();
  const marks = useQuery({ queryKey: ["bookmarks"], queryFn: () => listBookmarks() });
  if (marks.isPending) return <PageSkeleton />;
  if (marks.isError) return <ErrorNote text={explainError(marks.error, bi)} onRetry={() => void marks.refetch()} />;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{bi("बुकमार्क", "Bookmarks")}</h1>
      {(marks.data ?? []).length === 0 ? (
        <Empty title={bi("कुछ सहेजा नहीं", "Nothing saved")} body={bi("प्रश्न पर बुकमार्क दबाएँ।", "Use bookmark on a question.")} />
      ) : (
        <ul className="space-y-2">
          {(marks.data ?? []).map((item) => (
            <li key={item.questionId} className="rounded-2xl border border-line bg-surface p-3">
              <p className="text-xs text-muted">{item.subjectId} · {item.difficulty}</p>
              <p className="mt-1">{tx(lang, item.promptHi, item.promptEn)}</p>
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-bad"
                onClick={() => void toggleBookmark({ data: { questionId: item.questionId } }).then(() => client.invalidateQueries({ queryKey: ["bookmarks"] }))}
              >
                {bi("हटाएँ", "Remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">{bi("दोहराव अभ्यास इन्हें और पुराने गलत उत्तरों को लेता है।", "Revision practice pulls these plus older wrong answers.")}</p>
    </div>
  );
}

export function ProfilePage() {
  return <RequireUser><ProfileBody /></RequireUser>;
}

function ProfileBody() {
  const { bi, lang, setLang } = usePrefs();
  const client = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => import("@/lib/eduspark/api").then((m) => m.getMe()) });
  const taxonomy = useQuery({ queryKey: ["taxonomy"], queryFn: () => getTaxonomy() });
  const [form, setForm] = useState<Profile | null>(null);
  useEffect(() => {
    if (me.data && !form) setForm(me.data);
  }, [me.data, form]);
  if (me.isPending || !form) return <PageSkeleton />;
  if (me.isError) return <ErrorNote text={explainError(me.error, bi)} onRetry={() => void me.refetch()} />;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void saveProfile({
          data: {
            displayName: form.displayName,
            preferredLanguage: lang,
            selectedClass: form.selectedClass,
            examTargets: form.examTargets,
            selectedSubjects: form.selectedSubjects,
            dailyGoal: form.dailyGoal,
            showOnLeaderboard: form.showOnLeaderboard,
            theme: form.theme,
            photoUrl: form.photoUrl,
            onboardingDone: true,
            guardianAck: true,
          },
        })
          .then(() => {
            toast.success(bi("प्रोफ़ाइल सहेजी गई।", "Profile saved."));
            void client.invalidateQueries({ queryKey: ["me"] });
            void client.invalidateQueries({ queryKey: ["dashboard"] });
          })
          .catch((err) => toast.error(explainError(err, bi)));
      }}
    >
      <h1 className="text-3xl font-semibold">{bi("प्रोफ़ाइल", "Profile")}</h1>
      <p className="text-sm text-muted">{form.email}</p>
      <p className="text-sm text-muted">{bi("शामिल हुए", "Joined")} {form.createdAt.slice(0, 10)} · {form.role}</p>
      <label className="block text-sm font-medium">{bi("दिखने वाला नाम", "Display name")}
        <input className={`${inputClass} mt-1`} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
      </label>
      <label className="block text-sm font-medium">{bi("फोटो यूआरएल (https)", "Photo URL (https)")}
        <input className={`${inputClass} mt-1`} value={form.photoUrl ?? ""} onChange={(e) => setForm({ ...form, photoUrl: e.target.value || null })} />
      </label>
      <div className="flex gap-2">
        <Btn type="button" variant={lang === "hi" ? "primary" : "outline"} onClick={() => setLang("hi")}>हिंदी</Btn>
        <Btn type="button" variant={lang === "en" ? "primary" : "outline"} onClick={() => setLang("en")}>English</Btn>
      </div>
      <select className={inputClass} value={form.selectedClass ?? ""} onChange={(e) => setForm({ ...form, selectedClass: e.target.value || null })}>
        <option value="">{bi("कक्षा / परीक्षा", "Class / exam")}</option>
        {(taxonomy.data?.catalogs ?? []).map((item) => <option key={item.id} value={item.id}>{tx(lang, item.nameHi, item.nameEn)}</option>)}
      </select>
      <div className="flex flex-wrap gap-2">
        {(taxonomy.data?.subjects ?? []).map((subject) => {
          const on = form.selectedSubjects.includes(subject.id);
          return (
            <button key={subject.id} type="button" aria-pressed={on} className={`min-h-11 rounded-full px-3 text-sm ${on ? "bg-primary text-on-primary" : "bg-surface-2"}`} onClick={() => setForm({ ...form, selectedSubjects: on ? form.selectedSubjects.filter((id) => id !== subject.id) : [...form.selectedSubjects, subject.id] })}>
              {tx(lang, subject.nameHi, subject.nameEn)}
            </button>
          );
        })}
      </div>
      <Btn type="submit">{bi("सहेजें", "Save")}</Btn>
    </form>
  );
}

export function SettingsPage() {
  return <RequireUser><SettingsBody /></RequireUser>;
}

function SettingsBody() {
  const { bi, theme, setTheme, lang, setLang } = usePrefs();
  const client = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => import("@/lib/eduspark/api").then((m) => m.getMe()) });
  const [goal, setGoal] = useState(10);
  const [board, setBoard] = useState(true);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (me.data && !ready) {
      setGoal(me.data.dailyGoal);
      setBoard(me.data.showOnLeaderboard);
      setTheme(me.data.theme);
      setLang(me.data.preferredLanguage);
      setReady(true);
    }
  }, [me.data, ready, setTheme, setLang]);

  async function savePrefs() {
    if (!me.data) return;
    await saveProfile({
      data: {
        displayName: me.data.displayName,
        preferredLanguage: lang,
        selectedClass: me.data.selectedClass,
        examTargets: me.data.examTargets,
        selectedSubjects: me.data.selectedSubjects,
        dailyGoal: goal,
        showOnLeaderboard: board,
        theme,
        photoUrl: me.data.photoUrl,
        onboardingDone: me.data.onboardingDone,
        guardianAck: me.data.guardianAck,
      },
    });
    toast.success(bi("सेटिंग सहेजी गई।", "Settings saved."));
    void client.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{bi("सेटिंग", "Settings")}</h1>
      <Card className="space-y-3">
        <p className="font-semibold">{bi("रूप और भाषा", "Look and language")}</p>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "system"] as ThemeChoice[]).map((item) => (
            <Btn key={item} type="button" variant={theme === item ? "primary" : "outline"} onClick={() => setTheme(item)}>
              {item === "light" ? bi("हल्का", "Light") : item === "dark" ? bi("गहरा", "Dark") : bi("सिस्टम", "System")}
            </Btn>
          ))}
        </div>
        <label className="block text-sm">{bi("दैनिक लक्ष्य", "Daily goal")}
          <input className={`${inputClass} mt-1`} type="number" min={1} max={100} value={goal} onChange={(e) => setGoal(Number(e.target.value) || 10)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={board} onChange={(e) => setBoard(e.target.checked)} />
          {bi("लीडरबोर्ड पर मेरा नाम दिखाएँ", "Show my name on the leaderboard")}
        </label>
        <Btn type="button" onClick={() => void savePrefs().catch((err) => toast.error(explainError(err, bi)))}>{bi("सहेजें", "Save")}</Btn>
      </Card>
      <Card className="space-y-2">
        <p className="font-semibold">{bi("पासवर्ड बदलें", "Change password")}</p>
        <input className={inputClass} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={bi("वर्तमान", "Current")} autoComplete="current-password" />
        <input className={inputClass} type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder={bi("नया", "New")} autoComplete="new-password" />
        <Btn
          type="button"
          variant="outline"
          onClick={() =>
            void authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true }).then((res) => {
              if (res.error) toast.error(bi("पासवर्ड नहीं बदला। ईमेल खाते का वर्तमान पासवर्ड जाँचें।", "Could not change the password. Check the current one for an email account."));
              else toast.success(bi("पासवर्ड बदल गया।", "Password changed."));
            })
          }
        >
          {bi("बदलें", "Update")}
        </Btn>
      </Card>
      <Card className="space-y-2">
        <p className="font-semibold">{bi("खाता हटाएँ", "Delete account")}</p>
        <p className="text-sm text-muted">{bi("पुष्टि के लिए DELETE लिखें। प्रयास, बुकमार्क और प्रोफ़ाइल मिट जाएँगे।", "Type DELETE to confirm. Attempts, bookmarks, and the profile are removed.")}</p>
        <input className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="DELETE" />
        <Btn
          type="button"
          variant="danger"
          onClick={() =>
            void deleteAccount({ data: { confirm } })
              .then(() => signOut().catch(() => undefined))
              .catch((err) => toast.error(explainError(err, bi)))
          }
        >
          {bi("स्थायी रूप से हटाएँ", "Delete permanently")}
        </Btn>
      </Card>
    </div>
  );
}
