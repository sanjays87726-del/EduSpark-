import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Banner, Btn, Card, Empty, ErrorNote, PageSkeleton, explainError, inputClass } from "@/components/kit";
import { usePrefs } from "@/components/prefs";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getDashboard, getTaxonomy, listQuizzes, saveProfile, startQuiz } from "@/lib/eduspark/api";
import type { Catalog, QuizCard } from "@/lib/eduspark/types";

function nameOf(lang: "hi" | "en", hi: string, en: string) {
  return lang === "en" ? en : hi;
}

export function HomePage() {
  const { bi, lang, setLang } = usePrefs();
  const { user, isPending } = useCurrentUserState();
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    enabled: Boolean(user) && !isPending,
  });
  const samples = useQuery({
    queryKey: ["quizzes", "home"],
    queryFn: () => listQuizzes({ data: {} }),
    enabled: !user && !isPending,
  });
  const taxonomy = useQuery({
    queryKey: ["taxonomy"],
    queryFn: () => getTaxonomy(),
    enabled: !user && !isPending,
  });

  if (isPending || (user && dash.isPending)) return <PageSkeleton />;
  if (!user) {
    return (
      <Landing
        bi={bi}
        lang={lang}
        quizzes={samples.data ?? []}
        catalogs={taxonomy.data?.catalogs ?? []}
      />
    );
  }
  if (dash.isError || !dash.data) {
    return <ErrorNote text={explainError(dash.error, bi)} onRetry={() => void dash.refetch()} />;
  }
  return <Dashboard bi={bi} lang={lang} setLang={setLang} data={dash.data} />;
}

function Landing({
  bi,
  lang,
  quizzes,
  catalogs,
}: {
  bi: (hi: string, en: string) => string;
  lang: "hi" | "en";
  quizzes: QuizCard[];
  catalogs: Catalog[];
}) {
  const classes = catalogs.filter((item) => item.kind === "class");
  const exams = catalogs.filter((item) => item.kind === "exam");
  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <div className="rounded-3xl border border-line bg-surface p-6">
          <p className="text-sm font-semibold text-primary">EduSpark Quiz</p>
          <h1 className="mt-2 max-w-xl text-4xl font-semibold leading-tight">
            {bi("रोज़ थोड़ा अभ्यास। साफ़ परिणाम।", "A little practice every day. Clear results.")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            {bi(
              "कक्षा 6 से 12 और एसएससी, रेलवे, पुलिस, सीईटी की नमूना प्रश्नोत्तरियाँ। अंक सर्वर पर गिने जाते हैं।",
              "Sample quizzes for Classes 6–12 and SSC, railway, police, and CET prep. Scores are calculated on the server.",
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/login" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">
              {bi("शुरू करें", "Start")}
            </Link>
            <Link to="/explore" className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold">
              {bi("सभी प्रश्नोत्तरी", "All quizzes")}
            </Link>
          </div>
        </div>
        <div className="grid content-start gap-3 rounded-3xl bg-primary-soft p-5 text-ink">
          <p className="text-sm font-semibold text-primary">{bi("क्या मिलेगा", "What you get")}</p>
          <ul className="space-y-2 text-sm leading-6">
            <li>{bi("हिंदी और अंग्रेज़ी, एक टैप में।", "Hindi and English, one tap apart.")}</li>
            <li>{bi("अभ्यास में तुरंत व्याख्या। मॉक में छिपे उत्तर।", "Instant explanations in practice. Hidden answers in a mock.")}</li>
            <li>{bi("स्ट्रीक, बुकमार्क और लीडरबोर्ड आपके असली प्रयासों से।", "Streaks, bookmarks, and the leaderboard use your real attempts.")}</li>
          </ul>
        </div>
      </section>
      <Banner>
        {bi(
          "नमूना पाठ्यक्रम — किसी बोर्ड या आयोग का आधिकारिक सिलेबस नहीं।",
          "Demo syllabus — not an official board or commission curriculum.",
        )}
      </Banner>
      {classes.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">{bi("कक्षा चुनें", "Choose a class")}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {classes.map((item) => (
              <Link
                key={item.id}
                to="/explore"
                search={{ catalog: item.id }}
                className="flex min-h-14 items-center justify-center rounded-2xl border border-line bg-surface px-2 text-center text-sm font-semibold"
              >
                {nameOf(lang, item.nameHi, item.nameEn)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {exams.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">{bi("प्रतियोगी परीक्षा", "Competitive exams")}</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {exams.map((item) => (
              <Link
                key={item.id}
                to="/explore"
                search={{ catalog: item.id }}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-surface-2 px-3 text-sm font-semibold"
              >
                {nameOf(lang, item.nameHi, item.nameEn)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-lg font-semibold">{bi("शुरू करने के लिए", "Start with these")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {quizzes.slice(0, 3).map((quiz) => (
            <Link key={quiz.id} to="/explore/$quizId" params={{ quizId: quiz.id }} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold text-accent">{quiz.isDemo ? bi("नमूना", "Demo") : bi("प्रकाशित", "Published")}</p>
              <h3 className="mt-1 font-semibold">{nameOf(lang, quiz.titleHi, quiz.titleEn)}</h3>
              <p className="mt-2 text-sm text-muted">{quiz.questionCount} {bi("प्रश्न", "questions")}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Dashboard({
  bi,
  lang,
  setLang,
  data,
}: {
  bi: (hi: string, en: string) => string;
  lang: "hi" | "en";
  setLang: (lang: "hi" | "en") => void;
  data: Awaited<ReturnType<typeof getDashboard>>;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const goal = Math.max(1, data.profile.dailyGoal);
  const goalPct = Math.min(100, Math.round((data.stats.todayAnswered / goal) * 100));
  const earned = data.achievements.filter((item) => item.awardedAt);

  async function openDaily() {
    if (!data.daily) return;
    if (data.daily.doneToday && data.daily.attemptId) {
      await navigate({ to: "/results/$attemptId", params: { attemptId: data.daily.attemptId } });
      return;
    }
    try {
      const started = await startQuiz({ data: { quizId: data.daily.quiz.id } });
      if (started.state === "submitted") {
        await navigate({ to: "/results/$attemptId", params: { attemptId: started.attemptId } });
      } else {
        await navigate({ to: "/play/$attemptId", params: { attemptId: started.attemptId } });
      }
    } catch (err) {
      toast.error(explainError(err, bi));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">{bi("नमस्ते", "Hello")}</p>
        <h1 className="text-3xl font-semibold">{data.profile.displayName}</h1>
      </div>
      {!data.profile.onboardingDone ? (
        <Onboarding
          bi={bi}
          lang={lang}
          setLang={setLang}
          initial={data.profile}
          onSaved={() => {
            void client.invalidateQueries({ queryKey: ["dashboard"] });
            void client.invalidateQueries({ queryKey: ["me"] });
          }}
        />
      ) : null}
      <Banner>
        {bi(
          "आँकड़े आपके सहेजे प्रयासों से बनते हैं। नया खाता शून्य से शुरू होता है। प्रश्न नमूना हैं।",
          "Stats come from your saved attempts. A new account starts at zero. Questions are samples.",
        )}
      </Banner>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{bi("आज का लक्ष्य", "Today's goal")}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {data.stats.todayAnswered}/{goal}
            </p>
          </div>
          <p className="text-sm text-muted">{bi("लगातार दिन", "Streak")} · {data.stats.streak}</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${goalPct}%` }} />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={bi("उत्तर दिए", "Answered")} value={data.stats.answered} />
        <Stat label={bi("सही", "Correct")} value={data.stats.correct} />
        <Stat label={bi("गलत", "Incorrect")} value={data.stats.incorrect} />
        <Stat label={bi("सटीकता", "Accuracy")} value={`${data.stats.accuracy}%`} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">{bi("जारी रखें", "Continue")}</h2>
          {data.continueAttempt ? (
            <div className="mt-3">
              <p>{nameOf(lang, data.continueAttempt.titleHi, data.continueAttempt.titleEn)}</p>
              <Link to="/play/$attemptId" params={{ attemptId: data.continueAttempt.id }} className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary">
                {bi("वहीं से शुरू करें", "Resume")}
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">{bi("कोई अधूरी प्रश्नोत्तरी नहीं।", "No quiz in progress.")}</p>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">{bi("आज की प्रश्नोत्तरी", "Daily quiz")}</h2>
          {data.daily ? (
            <div className="mt-3">
              <p>{nameOf(lang, data.daily.quiz.titleHi, data.daily.quiz.titleEn)}</p>
              <p className="text-sm text-muted">{data.daily.doneToday ? bi("आज पूरा हो चुका है।", "Already done today.") : bi("भारत के आज के दिन एक बार।", "Once per India calendar day.")}</p>
              <Btn className="mt-3" type="button" onClick={() => void openDaily()}>
                {data.daily.doneToday ? bi("परिणाम देखें", "View result") : bi("शुरू करें", "Start")}
              </Btn>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">{bi("दैनिक प्रश्नोत्तरी सेट नहीं है।", "No daily quiz is set.")}</p>
          )}
        </Card>
      </div>
      <section>
        <h2 className="mb-2 font-semibold">{bi("सुझाव", "Recommended")}</h2>
        {data.recommended.length === 0 ? (
          <Empty title={bi("अभी खाली", "Nothing yet")} body={bi("प्रकाशित प्रश्नोत्तरी यहाँ दिखेगी।", "Published quizzes will show up here.")} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.recommended.map((quiz) => (
              <Link key={quiz.id} to="/explore/$quizId" params={{ quizId: quiz.id }} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs text-accent">{quiz.isDemo ? bi("नमूना", "Demo") : quiz.kind}</p>
                <h3 className="font-semibold">{nameOf(lang, quiz.titleHi, quiz.titleEn)}</h3>
                <p className="mt-1 text-sm text-muted">{quiz.questionCount} {bi("प्रश्न", "questions")}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">{bi("विषयवार प्रगति", "Subject progress")}</h2>
          {data.subjects.length === 0 ? <p className="mt-2 text-sm text-muted">{bi("पहली प्रश्नोत्तरी के बाद दिखेगा।", "Shows after your first quiz.")}</p> : (
            <ul className="mt-3 space-y-3">
              {data.subjects.map((subject) => {
                const total = subject.correct + subject.incorrect;
                const pct = total ? Math.round((subject.correct / total) * 100) : 0;
                return (
                  <li key={subject.subjectId}>
                    <div className="flex justify-between text-sm">
                      <span>{nameOf(lang, subject.nameHi, subject.nameEn)}</span>
                      <span className="tabular-nums text-muted">{pct}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">{bi("हाल के प्रयास", "Recent attempts")}</h2>
          {data.recent.length === 0 ? <p className="mt-2 text-sm text-muted">{bi("अभी कोई परिणाम नहीं।", "No results yet.")}</p> : (
            <ul className="mt-3 divide-y divide-line">
              {data.recent.map((item) => (
                <li key={item.id}>
                  <Link to="/results/$attemptId" params={{ attemptId: item.id }} className="flex items-center justify-between py-2 text-sm">
                    <span>{nameOf(lang, item.titleHi, item.titleEn)}</span>
                    <span className="tabular-nums font-semibold">{item.score}/{item.maximumScore}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
      <Card>
        <h2 className="font-semibold">{bi("उपलब्धियाँ", "Achievements")}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.achievements.map((badge) => (
            <li key={badge.id} className={`rounded-xl border px-3 py-2 text-sm ${badge.awardedAt ? "border-accent/40 bg-accent-soft" : "border-line text-muted"}`}>
              <p className="font-semibold">{nameOf(lang, badge.nameHi, badge.nameEn)}</p>
              <p>{nameOf(lang, badge.descriptionHi, badge.descriptionEn)}</p>
            </li>
          ))}
        </ul>
        {earned.length === 0 ? <p className="mt-2 text-xs text-muted">{bi("पहली प्रश्नोत्तरी पर पहला बैज मिलेगा।", "Your first badge arrives with your first finished quiz.")}</p> : null}
      </Card>
      <p className="text-sm text-muted">
        {bi("मॉक पूरे", "Mocks done")}: {data.stats.mocks} · {bi("बुकमार्क", "Bookmarks")}: {data.stats.bookmarks}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function Onboarding({
  bi,
  lang,
  setLang,
  initial,
  onSaved,
}: {
  bi: (hi: string, en: string) => string;
  lang: "hi" | "en";
  setLang: (lang: "hi" | "en") => void;
  initial: Awaited<ReturnType<typeof getDashboard>>["profile"];
  onSaved: () => void;
}) {
  const taxonomy = useQuery({ queryKey: ["taxonomy"], queryFn: () => getTaxonomy() });
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [selectedClass, setSelectedClass] = useState(initial.selectedClass ?? "");
  const [subjects, setSubjects] = useState<string[]>(initial.selectedSubjects);
  const [goal, setGoal] = useState(initial.dailyGoal);
  const [ack, setAck] = useState(initial.guardianAck);
  const [pending, setPending] = useState(false);
  const catalogs = (taxonomy.data?.catalogs ?? []).filter((item) => item.kind === "class" || item.kind === "exam");
  const subjectRows = taxonomy.data?.subjects ?? [];

  async function save() {
    if (!ack) {
      toast.error(bi("सहमति ज़रूरी है।", "Please confirm the note."));
      return;
    }
    setPending(true);
    try {
      await saveProfile({
        data: {
          displayName,
          preferredLanguage: lang,
          selectedClass: selectedClass || null,
          examTargets: catalogs.filter((item) => item.kind === "exam" && subjects.includes(item.id)).map((item) => item.id),
          selectedSubjects: subjects,
          dailyGoal: goal,
          showOnLeaderboard: initial.showOnLeaderboard,
          theme: initial.theme,
          photoUrl: initial.photoUrl,
          onboardingDone: true,
          guardianAck: true,
        },
      });
      toast.success(bi("तैयार।", "You are set."));
      onSaved();
    } catch (err) {
      toast.error(explainError(err, bi));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">{bi("अपना अभ्यास सेट करें", "Set up your practice")}</h2>
      <p className="text-sm text-muted">{bi("केवल नाम, कक्षा और विषय। स्कूल का पता नहीं।", "Only a name, class, and subjects. No school address.")}</p>
      <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label={bi("नाम", "Name")} />
      <div className="flex gap-2">
        <Btn type="button" variant={lang === "hi" ? "primary" : "outline"} onClick={() => setLang("hi")}>हिंदी</Btn>
        <Btn type="button" variant={lang === "en" ? "primary" : "outline"} onClick={() => setLang("en")}>English</Btn>
      </div>
      <select className={inputClass} value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} aria-label={bi("कक्षा या परीक्षा", "Class or exam")}>
        <option value="">{bi("कक्षा या परीक्षा चुनें", "Choose a class or exam")}</option>
        {catalogs.map((item) => (
          <option key={item.id} value={item.id}>{nameOf(lang, item.nameHi, item.nameEn)}</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        {subjectRows.slice(0, 10).map((subject) => {
          const on = subjects.includes(subject.id);
          return (
            <button
              key={subject.id}
              type="button"
              aria-pressed={on}
              className={`min-h-11 rounded-full px-3 text-sm ${on ? "bg-primary text-on-primary" : "bg-surface-2"}`}
              onClick={() => setSubjects((curr) => (on ? curr.filter((id) => id !== subject.id) : [...curr, subject.id]))}
            >
              {nameOf(lang, subject.nameHi, subject.nameEn)}
            </button>
          );
        })}
      </div>
      <label className="block text-sm">
        {bi("दैनिक लक्ष्य (प्रश्न)", "Daily goal (questions)")}
        <input className={`${inputClass} mt-1`} type="number" min={1} max={100} value={goal} onChange={(e) => setGoal(Number(e.target.value) || 10)} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>{bi("यदि मैं नाबालिग हूँ तो अभिभावक की सहमति है।", "If I am a minor, a parent or guardian agrees.")}</span>
      </label>
      <Btn type="button" disabled={pending} onClick={() => void save()}>{bi("सेव करें", "Save")}</Btn>
    </Card>
  );
}
