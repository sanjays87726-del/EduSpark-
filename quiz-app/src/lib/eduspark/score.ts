export type QuestionType = "mcq" | "multi" | "tf" | "fill" | "numerical" | "passage";

export type GradeStatus = "correct" | "incorrect" | "unanswered";

export type KeyEntry = {
  type: string;
  correct: string[];
  marks: number;
  negative: number;
  explanationHi: string;
  explanationEn: string;
  subjectId: string;
};

export type StoredAnswer = {
  choice: string[];
  review?: boolean;
  revealed?: boolean;
};

export type GradeItem = {
  questionId: string;
  status: GradeStatus;
  awarded: number;
  subjectId: string;
};

export type GradeSummary = {
  score: number;
  maximumScore: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentage: number;
  items: GradeItem[];
};

const CHOICE_TYPES = new Set(["mcq", "tf", "passage", "multi"]);

export function percentage(score: number, max: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round((score / max) * 1000) / 10;
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isCorrectAnswer(
  type: string,
  correct: string[],
  given: string[],
): boolean {
  const expected = correct.map((c) => c.trim()).filter(Boolean);
  const got = given.map((c) => c.trim()).filter(Boolean);
  if (expected.length === 0 || got.length === 0) return false;

  if (type === "multi") {
    const a = new Set(expected);
    const b = new Set(got);
    if (a.size !== b.size) return false;
    for (const item of a) if (!b.has(item)) return false;
    return true;
  }

  if (type === "numerical") {
    const target = Number(expected[0]);
    const value = Number(got[0].replace(/,/g, ""));
    if (!Number.isFinite(target) || !Number.isFinite(value)) {
      return normalizeText(got[0]) === normalizeText(expected[0]);
    }
    return Math.abs(target - value) <= 1e-6;
  }

  if (type === "fill") {
    const answer = normalizeText(got[0] ?? "");
    return expected.some((item) => {
      const variants = item.split("|").map((part) => normalizeText(part));
      return variants.includes(answer);
    });
  }

  return got.length === 1 && expected.includes(got[0]);
}

export function scoreQuestion(
  entry: KeyEntry,
  given: string[] | undefined,
  negativeOverride: number | null,
): { status: GradeStatus; awarded: number } {
  const choice = (given ?? []).map((c) => c.trim()).filter(Boolean);
  if (choice.length === 0) return { status: "unanswered", awarded: 0 };
  const negative = negativeOverride == null ? entry.negative : negativeOverride;
  if (isCorrectAnswer(entry.type, entry.correct, choice)) {
    return { status: "correct", awarded: round2(entry.marks) };
  }
  return { status: "incorrect", awarded: round2(-Math.abs(negative)) };
}

export function gradeAttempt(
  order: string[],
  key: Record<string, KeyEntry>,
  answers: Record<string, StoredAnswer | undefined>,
  negativeOverride: number | null,
): GradeSummary {
  const items: GradeItem[] = [];
  let score = 0;
  let maximumScore = 0;
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;

  for (const questionId of order) {
    const entry = key[questionId];
    if (!entry) continue;
    maximumScore += Number.isFinite(entry.marks) ? entry.marks : 0;
    const result = scoreQuestion(entry, answers[questionId]?.choice, negativeOverride);
    score += result.awarded;
    if (result.status === "correct") correct += 1;
    else if (result.status === "incorrect") incorrect += 1;
    else unanswered += 1;
    items.push({
      questionId,
      status: result.status,
      awarded: result.awarded,
      subjectId: entry.subjectId,
    });
  }

  score = round2(score);
  maximumScore = round2(maximumScore);
  return {
    score,
    maximumScore,
    correct,
    incorrect,
    unanswered,
    percentage: percentage(score, maximumScore),
    items,
  };
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function kolkataDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  const next = new Date(utc + days * 86_400_000);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Consecutive study days ending today, or yesterday if today is still empty. */
export function computeStreak(datesDesc: string[], today: string): number {
  const unique = [...new Set(datesDesc.filter(Boolean))].sort().reverse();
  if (unique.length === 0) return 0;
  const yesterday = shiftDate(today, -1);
  if (unique[0] !== today && unique[0] !== yesterday) return 0;
  let streak = 1;
  let cursor = unique[0];
  for (let i = 1; i < unique.length; i += 1) {
    const expected = shiftDate(cursor, -1);
    if (unique[i] !== expected) break;
    streak += 1;
    cursor = unique[i];
  }
  return streak;
}

export type QuestionDraft = {
  type: string;
  promptHi: string;
  promptEn: string;
  options: { id: string; hi: string; en: string }[];
  correct: string[];
  marks: number;
  negative: number;
};

export function validateQuestionDraft(draft: QuestionDraft): string | null {
  if (!draft.promptHi.trim() || !draft.promptEn.trim()) return "Prompt required in Hindi and English.";
  if (draft.promptHi.length > 2000 || draft.promptEn.length > 2000) return "Prompt is too long.";
  if (!Number.isFinite(draft.marks) || draft.marks <= 0 || draft.marks > 20) return "Marks must be between 0 and 20.";
  if (!Number.isFinite(draft.negative) || draft.negative < 0 || draft.negative > 20) return "Negative marks are invalid.";
  const ids = draft.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) return "Option ids must be unique.";
  if (CHOICE_TYPES.has(draft.type)) {
    if (draft.type === "tf" && draft.options.length !== 2) return "True/false needs exactly two options.";
    if (draft.type !== "tf" && (draft.options.length < 2 || draft.options.length > 8)) {
      return "Choice questions need 2 to 8 options.";
    }
    if (draft.options.some((o) => !o.hi.trim() || !o.en.trim() || !o.id.trim())) return "Every option needs an id and both languages.";
    if (draft.correct.length === 0) return "Choose the correct option.";
    if (draft.correct.some((id) => !ids.includes(id))) return "Correct answer is not one of the options.";
    if (draft.type !== "multi" && draft.correct.length !== 1) return "This question type allows one correct option.";
  } else if (draft.type === "fill" || draft.type === "numerical") {
    if (draft.correct.length === 0 || !draft.correct[0]?.trim()) return "Enter the accepted answer.";
    if (draft.type === "numerical" && !Number.isFinite(Number(draft.correct[0]))) return "Numerical answer must be a number.";
  } else {
    return "Unknown question type.";
  }
  return null;
}
