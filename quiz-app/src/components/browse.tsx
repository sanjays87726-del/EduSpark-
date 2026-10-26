import { Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RequireUser } from "@/components/gate";
import { Banner, Btn, Empty, ErrorNote, PageSkeleton, explainError, inputClass } from "@/components/kit";
import { usePrefs } from "@/components/prefs";
import { getQuizDetail, getTaxonomy, listQuizzes, startCustom, startQuiz } from "@/lib/eduspark/api";
import type { QuizCard } from "@/lib/eduspark/types";

function tx(lang: "hi" | "en", hi: string, en: string) {
  return lang === "en" ? en : hi;
}

export type ExploreSearch = { catalog?: string; subject?: string; kind?: string };

const KINDS = [
  { id: "", hi: "सभी", en: "All" },
  { id: "practice", hi: "अभ्यास", en: "Practice" },
  { id: "quiz", hi: "प्रश्नोत्तरी", en: "Quiz" },
  { id: "mock", hi: "मॉक", en: "Mock" },
  { id: "daily", hi: "दैनिक", en: "Daily" },
] as const;

const LEVELS = [
  { id: "", hi: "कोई भी", en: "Any" },
  { id: "easy", hi: "आसान", en: "Easy" },
  { id: "medium", hi: "मध्यम", en: "Medium" },
  { id: "hard", hi: "कठिन", en: "Hard" },
] as const;

function kindLabel(id: string, bi: (hi: string, en: string) => string) {
  const row = KINDS.find((item) => item.id === id);
  return row ? bi(row.hi, row.en) : id;
}

export function ExplorePage({ search }: { search: ExploreSearch }) {
  const { bi, lang } = usePrefs();
  const taxonomy = useQuery({ queryKey: ["taxonomy"], queryFn: () => getTaxonomy() });
  const [catalog, setCatalog] = useState(search.catalog ?? "");
  const [subject, setSubject] = useState(search.subject ?? "");
  const [kind, setKind] = useState(search.kind ?? "");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    setCatalog(search.catalog ?? "");
    setSubject(search.subject ?? "");
    setKind(search.kind ?? "");
    setChapter("");
    setTopic("");
  }, [search.catalog, search.subject, search.kind]);

  const quizzes = useQuery({
    queryKey: ["quizzes", catalog, subject, kind, chapter, topic, difficulty],
    queryFn: () =>
      listQuizzes({
        data: {
          catalogId: catalog || undefined,
          subjectId: subject || undefined,
          kind: kind || undefined,
          chapterId: chapter || undefined,
          topicId: topic || undefined,
          difficulty: difficulty === "easy" || difficulty === "medium" || difficulty === "hard" ? difficulty : undefined,
        },
      }),
    placeholderData: keepPreviousData,
    enabled: taxonomy.isSuccess,
  });

  if (taxonomy.isPending) return <PageSkeleton />;
  if (taxonomy.isError || !taxonomy.data) {
    return <ErrorNote text={explainError(taxonomy.error, bi)} onRetry={() => void taxonomy.refetch()} />;
  }
  if (quizzes.isError) {
    return <ErrorNote text={explainError(quizzes.error, bi)} onRetry={() => void quizzes.refetch()} />;
  }
  const data = taxonomy.data;
  const classes = data.catalogs.filter((item) => item.kind === "class");
  const exams = data.catalogs.filter((item) => item.kind === "exam");
  const subjects = data.subjects.filter((item) => !catalog || data.links.some((link) => link.catalogId === catalog && link.subjectId === item.id));
  const chapters = data.chapters.filter(
    (item) => (!subject || item.subjectId === subject) && (!catalog || !item.catalogId || item.catalogId === catalog),
  );
  const topics = data.topics.filter(
    (item) => (!subject || item.subjectId === subject) && (!chapter || item.chapterId === chapter),
  );
  const filtered = (quizzes.data ?? []).filter((quiz) => {
    const blob = `${quiz.titleHi} ${quiz.titleEn}`.toLowerCase();
    return !q || blob.includes(q.toLowerCase());
  });

  function pickCatalog(id: string) {
    setCatalog(id);
    setSubject("");
    setChapter("");
    setTopic("");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">{bi("प्रश्नोत्तरी खोजें", "Explore quizzes")}</h1>
        <p className="mt-1 text-sm text-muted">{bi("कक्षा या परीक्षा, फिर विषय, अध्याय और विषय-वस्तु।", "Class or exam, then subject, chapter, and topic.")}</p>
      </div>
      <Banner>{bi("नमूना सामग्री आधिकारिक सिलेबस नहीं है। भाषा ऊपर वाले बटन से बदलें — हर प्रश्न हिंदी और अंग्रेज़ी दोनों में है।", "Demo content is not an official syllabus. Switch language with the button above — every question is in Hindi and English.")}</Banner>
      <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder={bi("नाम खोजें", "Search by name")} aria-label={bi("खोज", "Search")} />
      <ChipRow label={bi("कक्षा", "Class")}>
        <Chip on={!catalog} onClick={() => pickCatalog("")}>{bi("सभी", "All")}</Chip>
        {classes.map((item) => (
          <Chip key={item.id} on={catalog === item.id} onClick={() => pickCatalog(item.id)}>{tx(lang, item.nameHi, item.nameEn)}</Chip>
        ))}
      </ChipRow>
      <ChipRow label={bi("परीक्षा", "Exam")}>
        {exams.map((item) => (
          <Chip key={item.id} on={catalog === item.id} onClick={() => pickCatalog(catalog === item.id ? "" : item.id)}>{tx(lang, item.nameHi, item.nameEn)}</Chip>
        ))}
      </ChipRow>
      <ChipRow label={bi("विषय", "Subject")}>
        <Chip on={!subject} onClick={() => { setSubject(""); setChapter(""); setTopic(""); }}>{bi("सभी", "All")}</Chip>
        {subjects.map((item) => (
          <Chip key={item.id} on={subject === item.id} onClick={() => { setSubject(item.id); setChapter(""); setTopic(""); }}>{tx(lang, item.nameHi, item.nameEn)}</Chip>
        ))}
      </ChipRow>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-medium">
          <span>{bi("अध्याय", "Chapter")}</span>
          <select
            className={inputClass}
            value={chapter}
            onChange={(e) => {
              setChapter(e.target.value);
              setTopic("");
            }}
          >
            <option value="">{bi("सभी अध्याय", "All chapters")}</option>
            {chapters.map((item) => (
              <option key={item.id} value={item.id}>{tx(lang, item.nameHi, item.nameEn)}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm font-medium">
          <span>{bi("विषय-वस्तु", "Topic")}</span>
          <select className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">{bi("सभी विषय-वस्तु", "All topics")}</option>
            {topics.map((item) => (
              <option key={item.id} value={item.id}>{tx(lang, item.nameHi, item.nameEn)}</option>
            ))}
          </select>
        </label>
      </div>
      <ChipRow label={bi("कठिनाई", "Difficulty")}>
        {LEVELS.map((item) => (
          <Chip key={item.id || "any"} on={difficulty === item.id} onClick={() => setDifficulty(item.id)}>{bi(item.hi, item.en)}</Chip>
        ))}
      </ChipRow>
      <ChipRow label={bi("प्रकार", "Type")}>
        {KINDS.map((item) => (
          <Chip key={item.id || "all"} on={kind === item.id} onClick={() => setKind(item.id)}>{bi(item.hi, item.en)}</Chip>
        ))}
      </ChipRow>
      {quizzes.isPending && !quizzes.data ? (
        <p className="text-sm text-muted">{bi("लोड हो रहा है…", "Loading…")}</p>
      ) : filtered.length === 0 ? (
        <Empty title={bi("कोई प्रश्नोत्तरी नहीं", "No quizzes")} body={bi("फ़िल्टर हटाएँ या बाद में देखें।", "Clear a filter or check back later.")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((quiz) => <QuizLink key={quiz.id} quiz={quiz} lang={lang} bi={bi} />)}
        </div>
      )}
    </div>
  );
}

export function QuizDetail({ quizId }: { quizId: string }) {
  const { bi, lang } = usePrefs();
  const navigate = useNavigate();
  const quiz = useQuery({ queryKey: ["quiz", quizId], queryFn: () => getQuizDetail({ data: { quizId } }) });
  const [busy, setBusy] = useState(false);
  if (quiz.isPending) return <PageSkeleton />;
  if (quiz.isError || !quiz.data) return <ErrorNote text={explainError(quiz.error, bi)} onRetry={() => void quiz.refetch()} />;
  const data = quiz.data;
  return (
    <article className="space-y-4">
      <p className="text-xs font-semibold text-accent">{data.isDemo ? bi("नमूना", "Demo") : kindLabel(data.kind, bi)}</p>
      <h1 className="text-3xl font-semibold">{tx(lang, data.titleHi, data.titleEn)}</h1>
      <p className="text-muted">{tx(lang, data.descriptionHi, data.descriptionEn)}</p>
      <ul className="space-y-1 text-sm">
        <li>{bi("प्रश्न", "Questions")}: {data.questionCount}</li>
        <li>{bi("समय", "Time")}: {data.durationSeconds ? `${Math.round(data.durationSeconds / 60)} ${bi("मिनट", "min")}` : bi("कोई सीमा नहीं", "No limit")}</li>
        <li>{bi("ऋणात्मक अंक", "Negative marks")}: {data.negativeMarks || bi("नहीं", "None")}</li>
        <li>{data.feedbackMode === "immediate" ? bi("हर उत्तर के बाद व्याख्या।", "Explanation after each answer.") : bi("व्याख्या जमा करने के बाद।", "Explanations after you submit.")}</li>
      </ul>
      <Btn
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void startQuiz({ data: { quizId } })
            .then(async (started) => {
              if (started.state === "submitted") await navigate({ to: "/results/$attemptId", params: { attemptId: started.attemptId } });
              else await navigate({ to: "/play/$attemptId", params: { attemptId: started.attemptId } });
            })
            .catch((err) => {
              toast.error(explainError(err, bi));
              setBusy(false);
            });
        }}
      >
        {bi("शुरू करें", "Start")}
      </Btn>
    </article>
  );
}

export function PracticePage() {
  return (
    <RequireUser>
      <PracticeBody />
    </RequireUser>
  );
}

function PracticeBody() {
  const { bi, lang } = usePrefs();
  const navigate = useNavigate();
  const taxonomy = useQuery({ queryKey: ["taxonomy"], queryFn: () => getTaxonomy() });
  const [catalog, setCatalog] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [busy, setBusy] = useState(false);
  const chapters = useMemo(
    () => (taxonomy.data?.chapters ?? []).filter((item) => (!subject || item.subjectId === subject) && (!catalog || !item.catalogId || item.catalogId === catalog)),
    [taxonomy.data, subject, catalog],
  );
  const topics = useMemo(
    () => (taxonomy.data?.topics ?? []).filter((item) => (!subject || item.subjectId === subject) && (!chapter || item.chapterId === chapter)),
    [taxonomy.data, subject, chapter],
  );

  async function go(mode: "practice" | "revision") {
    setBusy(true);
    try {
      const started = await startCustom({
        data: {
          mode,
          catalogId: catalog || undefined,
          subjectId: subject || undefined,
          chapterId: chapter || undefined,
          topicId: topic || undefined,
          difficulty: difficulty === "easy" || difficulty === "medium" || difficulty === "hard" ? difficulty : undefined,
          limit: 8,
        },
      });
      await navigate({ to: "/play/$attemptId", params: { attemptId: started.attemptId } });
    } catch (err) {
      toast.error(explainError(err, bi));
      setBusy(false);
    }
  }

  if (taxonomy.isPending) return <PageSkeleton />;
  if (taxonomy.isError || !taxonomy.data) return <ErrorNote text={explainError(taxonomy.error, bi)} onRetry={() => void taxonomy.refetch()} />;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{bi("अभ्यास", "Practice")}</h1>
      <p className="text-sm text-muted">{bi("तुरंत जाँच और व्याख्या। गलत या सहेजे प्रश्न उसी फ़िल्टर से दोहराव में आते हैं।", "Immediate checking and explanations. Revision uses wrong and saved questions that match the same filters.")}</p>
      <select className={inputClass} value={catalog} onChange={(e) => { setCatalog(e.target.value); setChapter(""); setTopic(""); }} aria-label={bi("श्रेणी", "Category")}>
        <option value="">{bi("सभी श्रेणियाँ", "All categories")}</option>
        {taxonomy.data.catalogs.map((item) => <option key={item.id} value={item.id}>{tx(lang, item.nameHi, item.nameEn)}</option>)}
      </select>
      <select className={inputClass} value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(""); setTopic(""); }} aria-label={bi("विषय", "Subject")}>
        <option value="">{bi("सभी विषय", "All subjects")}</option>
        {taxonomy.data.subjects.map((item) => <option key={item.id} value={item.id}>{tx(lang, item.nameHi, item.nameEn)}</option>)}
      </select>
      <select className={inputClass} value={chapter} onChange={(e) => { setChapter(e.target.value); setTopic(""); }} aria-label={bi("अध्याय", "Chapter")}>
        <option value="">{bi("सभी अध्याय", "All chapters")}</option>
        {chapters.map((item) => <option key={item.id} value={item.id}>{tx(lang, item.nameHi, item.nameEn)}</option>)}
      </select>
      <select className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} aria-label={bi("विषय-वस्तु", "Topic")}>
        <option value="">{bi("सभी विषय-वस्तु", "All topics")}</option>
        {topics.map((item) => <option key={item.id} value={item.id}>{tx(lang, item.nameHi, item.nameEn)}</option>)}
      </select>
      <ChipRow label={bi("कठिनाई", "Difficulty")}>
        {LEVELS.map((item) => (
          <Chip key={item.id || "any"} on={difficulty === item.id} onClick={() => setDifficulty(item.id)}>{bi(item.hi, item.en)}</Chip>
        ))}
      </ChipRow>
      <div className="flex flex-wrap gap-2">
        <Btn type="button" disabled={busy} onClick={() => void go("practice")}>{bi("अभ्यास शुरू", "Start practice")}</Btn>
        <Btn type="button" variant="outline" disabled={busy} onClick={() => void go("revision")}>{bi("गलत और बुकमार्क", "Wrong and bookmarks")}</Btn>
      </div>
    </div>
  );
}

export function MocksPage() {
  const { bi, lang } = usePrefs();
  const quizzes = useQuery({ queryKey: ["quizzes", "mock"], queryFn: () => listQuizzes({ data: { kind: "mock" } }) });
  if (quizzes.isPending) return <PageSkeleton />;
  if (quizzes.isError) return <ErrorNote text={explainError(quizzes.error, bi)} onRetry={() => void quizzes.refetch()} />;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{bi("मॉक टेस्ट", "Mock tests")}</h1>
      <p className="text-sm text-muted">{bi("घड़ी सर्वर के समय से चलती है। समय खत्म होते ही उत्तर जमा होते हैं।", "The clock uses the server deadline. Answers submit when time runs out.")}</p>
      {(quizzes.data ?? []).length === 0 ? (
        <Empty title={bi("कोई मॉक नहीं", "No mocks")} body={bi("प्रकाशित मॉक यहाँ आएगा।", "Published mocks will appear here.")} />
      ) : (
        <div className="grid gap-3">{(quizzes.data ?? []).map((quiz) => <QuizLink key={quiz.id} quiz={quiz} lang={lang} bi={bi} />)}</div>
      )}
    </div>
  );
}

function QuizLink({ quiz, lang, bi }: { quiz: QuizCard; lang: "hi" | "en"; bi: (hi: string, en: string) => string }) {
  const minutes = quiz.durationSeconds ? Math.round(quiz.durationSeconds / 60) : null;
  return (
    <Link to="/explore/$quizId" params={{ quizId: quiz.id }} className="block rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{quiz.isDemo ? `${bi("नमूना", "Demo")} · ${kindLabel(quiz.kind, bi)}` : kindLabel(quiz.kind, bi)}</span>
        <span>{quiz.questionCount} {bi("प्रश्न", "questions")}</span>
      </div>
      <h2 className="mt-1 font-semibold">{tx(lang, quiz.titleHi, quiz.titleEn)}</h2>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{tx(lang, quiz.descriptionHi, quiz.descriptionEn)}</p>
      <p className="mt-3 text-xs text-muted">
        {minutes ? `${minutes} ${bi("मि", "min")}` : bi("बिना घड़ी", "Untimed")}
        {quiz.negativeMarks ? ` · ${bi("ऋण", "Neg")} ${quiz.negativeMarks}` : ""}
      </p>
    </Link>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted">{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${on ? "bg-primary text-on-primary" : "bg-surface-2"}`}>
      {children}
    </button>
  );
}
