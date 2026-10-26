import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RequireUser } from "@/components/gate";
import { Btn, ErrorNote, PageSkeleton, explainError } from "@/components/kit";
import { usePrefs } from "@/components/prefs";
import { getPlay, revealAnswer, saveAnswer, submitAttempt, toggleBookmark } from "@/lib/eduspark/api";
import type { AnswerState, PlayQuestion, Reveal } from "@/lib/eduspark/types";

function text(lang: "hi" | "en", hi: string, en: string) {
  return lang === "en" ? en : hi;
}

function Triangle() {
  return (
    <svg viewBox="0 0 220 140" className="mx-auto mt-3 h-36 w-full max-w-xs" role="img" aria-label="Right triangle, legs 6 and 8">
      <polygon points="30,110 170,110 30,30" fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth="3" />
      <path d="M30 96 H44 V110" fill="none" stroke="var(--ink)" strokeWidth="2" />
      <text x="90" y="128" fill="var(--ink)" fontSize="14">6</text>
      <text x="8" y="76" fill="var(--ink)" fontSize="14">8</text>
      <text x="100" y="70" fill="var(--accent)" fontSize="16">?</text>
    </svg>
  );
}

export function Player({ attemptId }: { attemptId: string }) {
  return (
    <RequireUser>
      <PlayerBody attemptId={attemptId} />
    </RequireUser>
  );
}

function PlayerBody({ attemptId }: { attemptId: string }) {
  const { bi, lang } = usePrefs();
  const navigate = useNavigate();
  const client = useQueryClient();
  const play = useQuery({ queryKey: ["play", attemptId], queryFn: () => getPlay({ data: { attemptId } }) });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [reveals, setReveals] = useState<Record<string, Reveal>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    if (!play.data || play.data.state !== "live") return;
    setAnswers(play.data.answers);
    setReveals(play.data.reveals);
  }, [play.data]);

  useEffect(() => {
    if (play.data?.state === "submitted") {
      void navigate({ to: "/results/$attemptId", params: { attemptId } });
    }
  }, [play.data, attemptId, navigate]);

  const live = play.data?.state === "live" ? play.data : null;
  const question = live?.questions[index];
  const remaining = useCountdown(live?.deadlineAt ?? null, live?.serverNow ?? null);

  useEffect(() => {
    if (remaining !== 0 || !live || submitted.current) return;
    submitted.current = true;
    void submitAttempt({ data: { attemptId } }).then(() => {
      toast.message(bi("समय समाप्त। उत्तर जमा हो गए।", "Time is up. Your answers were submitted."));
      void navigate({ to: "/results/$attemptId", params: { attemptId } });
    });
  }, [remaining, live, attemptId, bi, navigate]);

  async function persist(next: AnswerState, qid: string) {
    try {
      const saved = await saveAnswer({ data: { attemptId, questionId: qid, choice: next.choice, review: next.review } });
      if (saved.expired) {
        await navigate({ to: "/results/$attemptId", params: { attemptId } });
      }
    } catch (err) {
      toast.error(explainError(err, bi));
    }
  }

  function update(qid: string, next: AnswerState) {
    setAnswers((curr) => ({ ...curr, [qid]: next }));
    void persist(next, qid);
  }

  async function finish() {
    setBusy(true);
    try {
      await submitAttempt({ data: { attemptId } });
      await client.invalidateQueries({ queryKey: ["dashboard"] });
      await navigate({ to: "/results/$attemptId", params: { attemptId } });
    } catch (err) {
      toast.error(explainError(err, bi));
      setBusy(false);
    }
  }

  if (play.isPending) return <PageSkeleton />;
  if (play.isError || !live || !question) {
    return <ErrorNote text={explainError(play.error, bi)} onRetry={() => void play.refetch()} />;
  }

  const state = answers[question.id] ?? { choice: [], review: false, revealed: false };
  const reveal = reveals[question.id];
  const negative = live.feedbackMode === "after_submit";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">{live.mode}</p>
            <h1 className="text-xl font-semibold">{text(lang, live.titleHi, live.titleEn)}</h1>
          </div>
          {remaining != null ? (
            <p className="rounded-xl bg-primary-soft px-3 py-2 text-lg font-semibold tabular-nums text-primary" aria-live="polite">
              {formatLeft(remaining)}
            </p>
          ) : (
            <p className="text-sm text-muted">{bi("बिना घड़ी", "Untimed")}</p>
          )}
        </div>
        <article className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">
            {bi("प्रश्न", "Question")} {index + 1}/{live.questions.length}
            {question.type === "multi" ? ` · ${bi("एक से अधिक सही हो सकते हैं", "More than one may be correct")}` : ""}
          </p>
          {question.passageHi ? (
            <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm leading-6">{text(lang, question.passageHi, question.passageEn ?? question.passageHi)}</p>
          ) : null}
          <h2 className="mt-3 text-lg font-semibold leading-7">{text(lang, question.promptHi, question.promptEn)}</h2>
          {question.figure === "triangle68" ? <Triangle /> : null}
          <div className="mt-4 space-y-2">
            {question.type === "fill" || question.type === "numerical" ? (
              <input
                className="min-h-11 w-full rounded-xl border border-line bg-canvas px-3"
                value={state.choice[0] ?? ""}
                inputMode={question.type === "numerical" ? "decimal" : "text"}
                disabled={state.revealed}
                aria-label={bi("उत्तर", "Answer")}
                onChange={(e) => update(question.id, { ...state, choice: e.target.value ? [e.target.value] : [] })}
              />
            ) : (
              question.options.map((option, optionIndex) => {
                const selected = state.choice.includes(option.id);
                const show = Boolean(reveal);
                const right = show && reveal?.correctAnswers.includes(option.id);
                const wrong = show && selected && !right;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={state.revealed}
                    aria-pressed={selected}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left ${
                      right ? "border-good bg-good-soft" : wrong ? "border-bad bg-bad-soft" : selected ? "border-primary bg-primary-soft" : "border-line"
                    }`}
                    onClick={() => {
                      const choice =
                        question.type === "multi"
                          ? selected
                            ? state.choice.filter((id) => id !== option.id)
                            : [...state.choice, option.id]
                          : [option.id];
                      update(question.id, { ...state, choice });
                    }}
                  >
                    <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-xs font-semibold">{optionIndex + 1}</span>
                    <span>{text(lang, option.hi, option.en)}</span>
                  </button>
                );
              })
            )}
          </div>
          {question.hintHi && !reveal ? (
            <div className="mt-3">
              <button type="button" className="text-sm font-semibold text-primary" onClick={() => setHint((v) => !v)}>
                {hint ? bi("संकेत छिपाएँ", "Hide hint") : bi("संकेत", "Hint")}
              </button>
              {hint ? <p className="mt-1 text-sm text-muted">{text(lang, question.hintHi, question.hintEn ?? "")}</p> : null}
            </div>
          ) : null}
          {reveal ? (
            <div className={`mt-4 rounded-xl p-3 text-sm ${reveal.correct ? "bg-good-soft" : "bg-bad-soft"}`}>
              <p className="font-semibold">{reveal.correct ? bi("सही", "Correct") : bi("गलत", "Incorrect")}</p>
              <p className="mt-1">{text(lang, reveal.explanationHi, reveal.explanationEn)}</p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn type="button" variant="outline" onClick={() => update(question.id, { ...state, choice: [] })} disabled={state.revealed}>
              {bi("साफ़ करें", "Clear")}
            </Btn>
            <Btn
              type="button"
              variant={state.review ? "soft" : "outline"}
              onClick={() => update(question.id, { ...state, review: !state.review })}
            >
              {bi("दोबारा देखें", "Mark review")}
            </Btn>
            <Btn
              type="button"
              variant="ghost"
              onClick={() =>
                void toggleBookmark({ data: { questionId: question.id } })
                  .then((res) => toast.success(res.saved ? bi("सहेजा", "Saved") : bi("हटाया", "Removed")))
                  .catch((err) => toast.error(explainError(err, bi)))
              }
            >
              {bi("बुकमार्क", "Bookmark")}
            </Btn>
            {live.feedbackMode === "immediate" && !state.revealed ? (
              <Btn
                type="button"
                onClick={() =>
                  void revealAnswer({ data: { attemptId, questionId: question.id } })
                    .then((res) => {
                      if (res.expired || !res.reveal) {
                        void navigate({ to: "/results/$attemptId", params: { attemptId } });
                        return;
                      }
                      setReveals((curr) => ({ ...curr, [question.id]: res.reveal! }));
                      setAnswers((curr) => ({ ...curr, [question.id]: { ...state, revealed: true } }));
                    })
                    .catch((err) => toast.error(explainError(err, bi)))
                }
              >
                {bi("जाँचें", "Check")}
              </Btn>
            ) : null}
          </div>
        </article>
        <div className="mt-3 flex gap-2">
          <Btn type="button" variant="outline" className="flex-1" disabled={index === 0} onClick={() => { setIndex((n) => n - 1); setHint(false); }}>
            {bi("पिछला", "Previous")}
          </Btn>
          {index < live.questions.length - 1 ? (
            <Btn type="button" className="flex-1" onClick={() => { setIndex((n) => n + 1); setHint(false); }}>
              {bi("अगला", "Next")}
            </Btn>
          ) : (
            <Btn type="button" className="flex-1" onClick={() => setConfirm(true)}>
              {bi("जमा करें", "Submit")}
            </Btn>
          )}
        </div>
        {negative ? <p className="mt-2 text-xs text-muted">{bi("सक्रिय परीक्षा में सही उत्तर अंत तक नहीं दिखते।", "Correct answers stay hidden until you submit.")}</p> : null}
        <Link to="/" className="mt-3 inline-flex min-h-11 items-center text-sm text-muted">{bi("डैशबोर्ड", "Dashboard")}</Link>
      </section>
      <Palette
        questions={live.questions}
        answers={answers}
        index={index}
        onPick={(n) => { setIndex(n); setHint(false); }}
        label={bi("प्रश्न पट", "Question palette")}
      />
      {confirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-surface p-4">
            <h2 className="text-lg font-semibold">{bi("जमा करें?", "Submit now?")}</h2>
            <p className="mt-2 text-sm text-muted">{bi("जमा करने के बाद उत्तर नहीं बदलेंगे।", "You cannot change answers after submission.")}</p>
            <div className="mt-4 flex gap-2">
              <Btn type="button" variant="outline" className="flex-1" onClick={() => setConfirm(false)}>{bi("रद्द", "Cancel")}</Btn>
              <Btn type="button" className="flex-1" disabled={busy} onClick={() => void finish()}>{bi("हाँ, जमा करें", "Yes, submit")}</Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Palette({
  questions,
  answers,
  index,
  onPick,
  label,
}: {
  questions: PlayQuestion[];
  answers: Record<string, AnswerState>;
  index: number;
  onPick: (index: number) => void;
  label: string;
}) {
  return (
    <aside className="rounded-2xl border border-line bg-surface p-3 lg:sticky lg:top-20 lg:self-start">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="grid grid-cols-8 gap-2 lg:grid-cols-5">
        {questions.map((question, i) => {
          const state = answers[question.id];
          const answered = (state?.choice.length ?? 0) > 0;
          return (
            <button
              key={question.id}
              type="button"
              aria-current={i === index}
              className={`grid size-11 place-items-center rounded-lg text-sm font-semibold ${
                i === index ? "bg-primary text-on-primary" : state?.review ? "bg-warn/20 text-ink" : answered ? "bg-good-soft text-ink" : "bg-surface-2 text-muted"
              }`}
              onClick={() => onPick(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function formatLeft(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function useCountdown(deadline: string | null, serverNow: string | null) {
  const offset = useMemo(() => (serverNow ? new Date(serverNow).getTime() - Date.now() : 0), [serverNow]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, new Date(deadline).getTime() - (now + offset));
}
