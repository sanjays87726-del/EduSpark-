import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RequireUser } from "@/components/gate";
import { Btn, Card, ErrorNote, PageSkeleton, explainError, inputClass } from "@/components/kit";
import { usePrefs } from "@/components/prefs";
import {
  adminAudit,
  adminDeleteQuestion,
  adminImport,
  adminListQuizzes,
  adminOverview,
  adminQuestions,
  adminReports,
  adminSaveQuestion,
  adminSaveQuiz,
  adminSaveSetting,
  adminSaveTaxonomy,
  adminSetQuizStatus,
  adminSetReport,
  adminSetRole,
  adminUsers,
  getMe,
} from "@/lib/eduspark/api";

const tabs = ["overview", "questions", "quizzes", "content", "users", "reports", "audit"] as const;

export function AdminPage() {
  return (
    <RequireUser>
      <AdminBody />
    </RequireUser>
  );
}

function AdminBody() {
  const { bi } = usePrefs();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [tab, setTab] = useState<(typeof tabs)[number]>("overview");
  if (me.isPending) return <PageSkeleton />;
  if (!me.data || (me.data.role !== "admin" && me.data.role !== "teacher")) {
    return <ErrorNote text={bi("यह पैनल केवल शिक्षक और व्यवस्थापक के लिए है।", "This panel is only for teachers and admins.")} />;
  }
  const admin = me.data.role === "admin";
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{bi("प्रशासन", "Admin")}</h1>
      <div className="flex gap-2 overflow-x-auto">
        {tabs.filter((item) => admin || !["users", "audit"].includes(item)).map((item) => (
          <Btn key={item} type="button" variant={tab === item ? "primary" : "outline"} onClick={() => setTab(item)}>{item}</Btn>
        ))}
      </div>
      {tab === "overview" ? <Overview bi={bi} admin={admin} /> : null}
      {tab === "questions" ? <Questions bi={bi} /> : null}
      {tab === "quizzes" ? <Quizzes bi={bi} /> : null}
      {tab === "content" ? <Content bi={bi} /> : null}
      {tab === "users" && admin ? <Users bi={bi} /> : null}
      {tab === "reports" ? <Reports bi={bi} /> : null}
      {tab === "audit" && admin ? <Audit bi={bi} /> : null}
    </div>
  );
}

function Overview({ bi, admin }: { bi: (hi: string, en: string) => string; admin: boolean }) {
  const data = useQuery({ queryKey: ["admin-overview"], queryFn: () => adminOverview() });
  const [on, setOn] = useState(true);
  if (data.isPending) return <PageSkeleton />;
  if (data.isError || !data.data) return <ErrorNote text={explainError(data.error, bi)} onRetry={() => void data.refetch()} />;
  const row = data.data;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card><p className="text-xs text-muted">{bi("उपयोगकर्ता", "Users")}</p><p className="text-2xl font-semibold">{row.users}</p></Card>
        <Card><p className="text-xs text-muted">{bi("7 दिन में सक्रिय", "Active in 7 days")}</p><p className="text-2xl font-semibold">{row.active}</p></Card>
        <Card><p className="text-xs text-muted">{bi("प्रयास", "Attempts")}</p><p className="text-2xl font-semibold">{row.attempts}</p></Card>
        <Card><p className="text-xs text-muted">{bi("पूर्णता", "Completion")}</p><p className="text-2xl font-semibold">{row.completion}%</p></Card>
        <Card><p className="text-xs text-muted">{bi("प्रश्न", "Questions")}</p><p className="text-2xl font-semibold">{row.questions}</p></Card>
        <Card><p className="text-xs text-muted">{bi("खुली रिपोर्ट", "Open reports")}</p><p className="text-2xl font-semibold">{row.openReports}</p></Card>
      </div>
      {admin ? (
        <Card className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
            {bi("लीडरबोर्ड चालू", "Leaderboard on")}
          </label>
          <Btn type="button" onClick={() => void adminSaveSetting({ data: { leaderboardEnabled: on } }).then(() => toast.success(bi("सहेजा", "Saved"))).catch((err) => toast.error(explainError(err, bi)))}>
            {bi("सेटिंग सहेजें", "Save setting")}
          </Btn>
        </Card>
      ) : null}
    </div>
  );
}

function Questions({ bi }: { bi: (hi: string, en: string) => string }) {
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["admin-questions", q], queryFn: () => adminQuestions({ data: { q } }) });
  const [promptHi, setPromptHi] = useState("");
  const [promptEn, setPromptEn] = useState("");
  const [correct, setCorrect] = useState("a");
  const [subjectId, setSubjectId] = useState("gk");
  const [raw, setRaw] = useState("");

  async function createOne() {
    await adminSaveQuestion({
      data: {
        subjectId,
        chapterId: null,
        topicId: null,
        catalogId: null,
        type: "mcq",
        difficulty: "easy",
        promptHi,
        promptEn,
        passageHi: null,
        passageEn: null,
        options: [
          { id: "a", hi: "विकल्प अ", en: "Option A" },
          { id: "b", hi: "विकल्प ब", en: "Option B" },
          { id: "c", hi: "विकल्प स", en: "Option C" },
          { id: "d", hi: "विकल्प द", en: "Option D" },
        ],
        correct: [correct],
        explanationHi: "व्याख्या जोड़ें।",
        explanationEn: "Add an explanation.",
        hintHi: null,
        hintEn: null,
        marks: 1,
        negative: 0,
        status: "draft",
      },
    });
    toast.success(bi("ड्राफ्ट बना। विकल्प बाद में प्रश्न खोलकर ठीक करें।", "Draft created. Edit options before publishing."));
    setPromptHi("");
    setPromptEn("");
    void client.invalidateQueries({ queryKey: ["admin-questions"] });
  }

  return (
    <div className="space-y-3">
      <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder={bi("प्रश्न खोजें", "Search questions")} />
      <Card className="space-y-2">
        <p className="font-semibold">{bi("नया एमसीक्यू ड्राफ्ट", "New MCQ draft")}</p>
        <input className={inputClass} value={promptHi} onChange={(e) => setPromptHi(e.target.value)} placeholder="हिंदी प्रश्न" />
        <input className={inputClass} value={promptEn} onChange={(e) => setPromptEn(e.target.value)} placeholder="English prompt" />
        <input className={inputClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} placeholder="subject id" />
        <input className={inputClass} value={correct} onChange={(e) => setCorrect(e.target.value)} placeholder="correct option id" />
        <Btn type="button" onClick={() => void createOne().catch((err) => toast.error(explainError(err, bi)))}>{bi("ड्राफ्ट सहेजें", "Save draft")}</Btn>
      </Card>
      <Card className="space-y-2">
        <p className="font-semibold">{bi("JSON आयात", "JSON import")}</p>
        <textarea className={inputClass} rows={5} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder='[{"subjectId":"gk","type":"mcq","difficulty":"easy","promptHi":"...","promptEn":"...","options":[{"id":"a","hi":"अ","en":"A"},{"id":"b","hi":"ब","en":"B"}],"correct":["a"],"explanationHi":"...","explanationEn":"...","chapterId":null,"topicId":null,"catalogId":null,"passageHi":null,"passageEn":null,"hintHi":null,"hintEn":null,"marks":1,"negative":0,"status":"draft"}]' />
        <Btn
          type="button"
          variant="outline"
          onClick={() => {
            try {
              const items = JSON.parse(raw) as unknown;
              if (!Array.isArray(items)) throw new Error("VALIDATION");
              void adminImport({ data: { items: items as never } })
                .then((res) => {
                  toast.success(`${res.created} ok, ${res.errors.length} skipped`);
                  void client.invalidateQueries({ queryKey: ["admin-questions"] });
                })
                .catch((err) => toast.error(explainError(err, bi)));
            } catch {
              toast.error(bi("JSON सही नहीं है।", "That JSON could not be read."));
            }
          }}
        >
          {bi("आयात करें", "Import")}
        </Btn>
      </Card>
      {list.isPending ? <PageSkeleton /> : null}
      <ul className="space-y-2">
        {(list.data?.questions ?? []).map((question) => (
          <li key={question.id} className="rounded-2xl border border-line bg-surface p-3 text-sm">
            <p className="text-xs text-muted">{question.id} · {question.status} · {question.subjectId}</p>
            <p className="font-medium">{question.promptEn}</p>
            <p className="text-muted">{bi("सही", "Correct")}: {question.correct.join(", ")}</p>
            <p>{question.explanationEn}</p>
            <div className="mt-2 flex gap-2">
              <Btn type="button" variant="outline" onClick={() => void adminSaveQuestion({
                data: {
                  id: question.id,
                  subjectId: question.subjectId,
                  chapterId: question.chapterId,
                  topicId: question.topicId,
                  catalogId: question.catalogId,
                  type: question.type as "mcq",
                  difficulty: question.difficulty as "easy",
                  promptHi: question.promptHi,
                  promptEn: question.promptEn,
                  passageHi: question.passageHi,
                  passageEn: question.passageEn,
                  options: question.options,
                  correct: question.correct,
                  explanationHi: question.explanationHi,
                  explanationEn: question.explanationEn,
                  hintHi: question.hintHi,
                  hintEn: question.hintEn,
                  marks: question.marks,
                  negative: question.negative,
                  status: question.status === "published" ? "draft" : "published",
                },
              }).then(() => client.invalidateQueries({ queryKey: ["admin-questions"] })).catch((err) => toast.error(explainError(err, bi)))}>
                {question.status === "published" ? bi("ड्राफ्ट", "Unpublish") : bi("प्रकाशित", "Publish")}
              </Btn>
              <Btn type="button" variant="danger" onClick={() => {
                if (!window.confirm("DELETE this question?")) return;
                void adminDeleteQuestion({ data: { id: question.id, confirm: "DELETE" } })
                  .then(() => client.invalidateQueries({ queryKey: ["admin-questions"] }))
                  .catch((err) => toast.error(explainError(err, bi)));
              }}>{bi("हटाएँ", "Delete")}</Btn>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Quizzes({ bi }: { bi: (hi: string, en: string) => string }) {
  const client = useQueryClient();
  const list = useQuery({ queryKey: ["admin-quizzes"], queryFn: () => adminListQuizzes() });
  const [titleHi, setTitleHi] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [ids, setIds] = useState("");
  if (list.isPending) return <PageSkeleton />;
  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <p className="font-semibold">{bi("नई प्रश्नोत्तरी", "New quiz")}</p>
        <input className={inputClass} value={titleHi} onChange={(e) => setTitleHi(e.target.value)} placeholder="शीर्षक" />
        <input className={inputClass} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Title" />
        <input className={inputClass} value={ids} onChange={(e) => setIds(e.target.value)} placeholder="q-g1, q-g2" />
        <Btn type="button" onClick={() => void adminSaveQuiz({
          data: {
            titleHi, titleEn, descriptionHi: titleHi, descriptionEn: titleEn,
            catalogId: null, subjectId: null, kind: "quiz", durationMinutes: 10, negativeMarks: 0,
            shuffleQuestions: false, shuffleOptions: false, feedbackMode: "after_submit", status: "draft",
            questionIds: ids.split(",").map((id) => id.trim()).filter(Boolean),
          },
        }).then(() => { toast.success(bi("ड्राफ्ट सहेजा", "Draft saved")); void client.invalidateQueries({ queryKey: ["admin-quizzes"] }); }).catch((err) => toast.error(explainError(err, bi)))}>
          {bi("ड्राफ्ट", "Save draft")}
        </Btn>
      </Card>
      <ul className="space-y-2">
        {(list.data ?? []).map((quiz) => (
          <li key={quiz.id} className="rounded-2xl border border-line p-3 text-sm">
            <p className="font-semibold">{quiz.titleEn}</p>
            <p className="text-muted">{quiz.id} · {quiz.status} · {quiz.questionCount}</p>
            <Btn type="button" className="mt-2" variant="outline" onClick={() => void adminSetQuizStatus({ data: { id: quiz.id, status: quiz.status === "published" ? "draft" : "published" } }).then(() => client.invalidateQueries({ queryKey: ["admin-quizzes"] }))}>
              {quiz.status === "published" ? bi("अप्रकाशित", "Unpublish") : bi("प्रकाशित करें", "Publish")}
            </Btn>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Content({ bi }: { bi: (hi: string, en: string) => string }) {
  const [id, setId] = useState("");
  const [nameHi, setNameHi] = useState("");
  const [nameEn, setNameEn] = useState("");
  return (
    <Card className="space-y-2">
      <p className="font-semibold">{bi("नई कक्षा या परीक्षा", "New class or exam")}</p>
      <input className={inputClass} value={id} onChange={(e) => setId(e.target.value)} placeholder="class-13" />
      <input className={inputClass} value={nameHi} onChange={(e) => setNameHi(e.target.value)} placeholder="कक्षा 13" />
      <input className={inputClass} value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Class 13" />
      <Btn type="button" onClick={() => void adminSaveTaxonomy({
        data: { entity: "catalog", id, kind: id.startsWith("exam") ? "exam" : "class", nameHi, nameEn, sort: 40 },
      }).then(() => toast.success(bi("जोड़ दिया", "Added"))).catch((err) => toast.error(explainError(err, bi)))}>
        {bi("जोड़ें", "Add")}
      </Btn>
    </Card>
  );
}

function Users({ bi }: { bi: (hi: string, en: string) => string }) {
  const client = useQueryClient();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => adminUsers() });
  if (users.isPending) return <PageSkeleton />;
  if (users.isError) return <ErrorNote text={explainError(users.error, bi)} onRetry={() => void users.refetch()} />;
  return (
    <ul className="space-y-2">
      {(users.data ?? []).map((user) => (
        <li key={user.userId} className="rounded-2xl border border-line p-3 text-sm">
          <p className="font-semibold">{user.displayName} {user.mine ? "(you)" : ""}</p>
          <p className="text-muted">{user.email}</p>
          <select
            className={`${inputClass} mt-2`}
            value={user.role}
            onChange={(e) => void adminSetRole({ data: { userId: user.userId, role: e.target.value as "student" } }).then(() => client.invalidateQueries({ queryKey: ["admin-users"] })).catch((err) => toast.error(explainError(err, bi)))}
          >
            <option value="student">student</option>
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </select>
        </li>
      ))}
    </ul>
  );
}

function Reports({ bi }: { bi: (hi: string, en: string) => string }) {
  const client = useQueryClient();
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: () => adminReports() });
  if (reports.isPending) return <PageSkeleton />;
  return (
    <ul className="space-y-2">
      {(reports.data ?? []).map((report) => (
        <li key={report.id} className="rounded-2xl border border-line p-3 text-sm">
          <p className="font-semibold">{report.displayName} · {report.status}</p>
          <p>{report.reason}</p>
          <p className="text-muted">{report.contentType} {report.contentId}</p>
          <Btn type="button" className="mt-2" variant="outline" onClick={() => void adminSetReport({ data: { id: report.id, status: report.status === "open" ? "resolved" : "open" } }).then(() => client.invalidateQueries({ queryKey: ["admin-reports"] }))}>
            {bi("स्थिति बदलें", "Toggle status")}
          </Btn>
        </li>
      ))}
    </ul>
  );
}

function Audit({ bi }: { bi: (hi: string, en: string) => string }) {
  const rows = useQuery({ queryKey: ["admin-audit"], queryFn: () => adminAudit() });
  if (rows.isPending) return <PageSkeleton />;
  if (rows.isError) return <ErrorNote text={explainError(rows.error, bi)} onRetry={() => void rows.refetch()} />;
  return (
    <ul className="space-y-2 text-sm">
      {(rows.data ?? []).map((row) => (
        <li key={row.id} className="rounded-xl border border-line px-3 py-2">
          <p className="font-medium">{row.action} · {row.resourceType}</p>
          <p className="text-muted">{row.displayName} · {row.resourceId} · {row.createdAt.slice(0, 16)}</p>
        </li>
      ))}
    </ul>
  );
}
