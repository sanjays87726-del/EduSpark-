import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RequireUser } from "@/components/gate";
import { Btn, Card, ErrorNote, PageSkeleton, explainError, inputClass } from "@/components/kit";
import { usePrefs } from "@/components/prefs";
import { getResult, sendReport, startQuiz, toggleBookmark } from "@/lib/eduspark/api";

function tx(lang: "hi" | "en", hi: string, en: string) {
  return lang === "en" ? en : hi;
}

export function Results({ attemptId }: { attemptId: string }) {
  return (
    <RequireUser>
      <ResultsBody attemptId={attemptId} />
    </RequireUser>
  );
}

function ResultsBody({ attemptId }: { attemptId: string }) {
  const { bi, lang } = usePrefs();
  const result = useQuery({ queryKey: ["result", attemptId], queryFn: () => getResult({ data: { attemptId } }) });
  const navigate = useNavigate();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);

  if (result.isPending) return <PageSkeleton />;
  if (result.isError || !result.data) return <ErrorNote text={explainError(result.error, bi)} onRetry={() => void result.refetch()} />;
  const data = result.data;
  const clock = `${Math.floor(data.timeTakenSeconds / 60)}:${String(data.timeTakenSeconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">{tx(lang, data.titleHi, data.titleEn)}</p>
        <h1 className="text-3xl font-semibold tabular-nums">{data.score} / {data.maximumScore}</h1>
        <p className="text-muted">{data.percentage}% · {clock}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><p className="text-xs text-muted">{bi("कुल", "Total")}</p><p className="text-xl font-semibold">{data.questions.length}</p></Card>
        <Card><p className="text-xs text-muted">{bi("सही", "Correct")}</p><p className="text-xl font-semibold text-good">{data.correct}</p></Card>
        <Card><p className="text-xs text-muted">{bi("गलत", "Incorrect")}</p><p className="text-xl font-semibold text-bad">{data.incorrect}</p></Card>
        <Card><p className="text-xs text-muted">{bi("खाली", "Unanswered")}</p><p className="text-xl font-semibold">{data.unanswered}</p></Card>
      </div>
      {data.subjects.length > 0 ? (
        <Card>
          <h2 className="font-semibold">{bi("विषयवार", "By subject")}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.subjects.map((subject) => (
              <li key={subject.subjectId} className="flex justify-between">
                <span>{subject.subjectId}</span>
                <span className="tabular-nums">{subject.correct}/{subject.correct + subject.incorrect + subject.unanswered}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {data.quizId ? (
          <Btn
            type="button"
            onClick={() =>
              void startQuiz({ data: { quizId: data.quizId! } })
                .then(async (started) => {
                  await client.invalidateQueries({ queryKey: ["dashboard"] });
                  if (started.state === "submitted") await navigate({ to: "/results/$attemptId", params: { attemptId: started.attemptId } });
                  else await navigate({ to: "/play/$attemptId", params: { attemptId: started.attemptId } });
                })
                .catch((err) => toast.error(explainError(err, bi)))
            }
          >
            {bi("फिर से दें", "Retry quiz")}
          </Btn>
        ) : (
          <Link to="/practice" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">{bi("और अभ्यास", "Practice more")}</Link>
        )}
        <Link to="/" className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold">{bi("डैशबोर्ड", "Dashboard")}</Link>
      </div>
      <h2 className="text-lg font-semibold">{bi("समीक्षा", "Review")}</h2>
      <div className="space-y-3">
        {data.questions.map((question, index) => (
          <article key={question.id} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-semibold uppercase text-muted">{index + 1} · {question.status} · {question.awarded}</p>
            <h3 className="mt-1 font-semibold">{tx(lang, question.promptHi, question.promptEn)}</h3>
            <p className="mt-2 text-sm">{bi("आपका उत्तर", "Your answer")}: {question.yourChoice.join(", ") || bi("खाली", "blank")}</p>
            <p className="text-sm">{bi("सही उत्तर", "Correct answer")}: {question.correctAnswers.join(", ")}</p>
            <p className="mt-2 text-sm text-muted">{tx(lang, question.explanationHi, question.explanationEn)}</p>
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-primary"
              onClick={() => void toggleBookmark({ data: { questionId: question.id } }).then((res) => toast.success(res.saved ? bi("सहेजा", "Saved") : bi("हटाया", "Removed")))}
            >
              {bi("बुकमार्क", "Bookmark")}
            </button>
            <button type="button" className="ml-3 mt-2 text-sm text-muted" onClick={() => setReportId(question.id)}>
              {bi("रिपोर्ट", "Report")}
            </button>
          </article>
        ))}
      </div>
      {reportId ? (
        <form
          className="space-y-2 rounded-2xl border border-line p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendReport({ data: { contentType: "question", contentId: reportId, reason } })
              .then(() => {
                toast.success(bi("रिपोर्ट मिल गई।", "Report received."));
                setReportId(null);
                setReason("");
              })
              .catch((err) => toast.error(explainError(err, bi)));
          }}
        >
          <label className="text-sm font-medium" htmlFor="reason">{bi("समस्या लिखें", "Describe the problem")}</label>
          <textarea id="reason" className={inputClass} minLength={8} value={reason} onChange={(e) => setReason(e.target.value)} required />
          <Btn type="submit">{bi("भेजें", "Send")}</Btn>
        </form>
      ) : null}
    </div>
  );
}
