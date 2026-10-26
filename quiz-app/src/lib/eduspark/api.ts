import { createHash, randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  CATALOGS,
  CHAPTERS,
  QUESTIONS,
  QUIZZES,
  SOURCE_NOTE,
  SUBJECT_CATALOGS,
  SUBJECTS,
  TOPICS,
  type DemoQuestion,
} from "./demo-data";
import {
  computeStreak,
  gradeAttempt,
  kolkataDate,
  round2,
  shiftDate,
  validateQuestionDraft,
  type KeyEntry,
  type StoredAnswer,
} from "./score";
import type {
  AchievementBadge,
  BookmarkItem,
  Catalog,
  Chapter,
  DashboardData,
  LeaderRow,
  LiveAttempt,
  PlayQuestion,
  Profile,
  QuizCard,
  QuizResult,
  RecentAttempt,
  Reveal,
  Role,
  Subject,
  SubjectLink,
  SubjectStat,
  Topic,
} from "./types";

const KNOWN = new Set([
  "FORBIDDEN",
  "NOT_FOUND",
  "EMPTY",
  "VALIDATION",
  "DUPLICATE",
  "RATE_LIMIT",
  "LOCKED",
  "LAST_ADMIN",
  "CONFIRM",
  "SERVER",
]);

const hits = new Map<string, number[]>();

function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) throw new Error("RATE_LIMIT");
  recent.push(now);
  hits.set(key, recent);
}

function fail(code: string): never {
  throw new Error(code);
}

async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof Error && KNOWN.has(err.message)) throw err;
    console.error("[eduspark]", err instanceof Error ? err.message : "error");
    throw new Error("SERVER");
  }
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) fail("VALIDATION");
  return parsed.data;
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function isoOrNull(value: unknown): string | null {
  if (value == null) return null;
  return iso(value);
}

function strList(value: unknown): string[] {
  const list = asJson<unknown>(value, []);
  return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
}

function hashPrompt(hi: string, en: string): string {
  return createHash("sha256").update(`${hi.trim()}\n${en.trim()}`).digest("hex");
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.EDUSPARK_ADMIN_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

type ProfileRow = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  preferred_language: string;
  selected_class: string | null;
  exam_targets: unknown;
  selected_subjects: unknown;
  role: string;
  daily_goal: number;
  show_on_leaderboard: boolean;
  theme: string;
  onboarding_done: boolean;
  guardian_ack: boolean;
  created_at: unknown;
};

function mapProfile(row: ProfileRow, email: string | null): Profile {
  const lang = row.preferred_language === "en" ? "en" : "hi";
  const role: Role = row.role === "admin" || row.role === "teacher" ? row.role : "student";
  const theme = row.theme === "dark" || row.theme === "system" ? row.theme : "light";
  return {
    userId: row.user_id,
    displayName: row.display_name || "Student",
    photoUrl: row.photo_url,
    email,
    preferredLanguage: lang,
    selectedClass: row.selected_class,
    examTargets: strList(row.exam_targets),
    selectedSubjects: strList(row.selected_subjects),
    role,
    dailyGoal: num(row.daily_goal) || 10,
    showOnLeaderboard: Boolean(row.show_on_leaderboard),
    theme,
    onboardingDone: Boolean(row.onboarding_done),
    guardianAck: Boolean(row.guardian_ack),
    createdAt: iso(row.created_at),
  };
}

async function ensureProfile(sql: Sql, userId: string): Promise<Profile> {
  const users = await sql<{ name: string; email: string; image: string | null }>`
    select name, email, image from "user" where id = ${userId} limit 1
  `;
  const name = users[0]?.name?.trim() || "Student";
  const email = users[0]?.email ?? null;
  await sql`
    insert into profiles (user_id, display_name, photo_url)
    values (${userId}, ${name}, ${users[0]?.image ?? null})
    on conflict (user_id) do nothing
  `;
  if (email && adminEmails().has(email.toLowerCase())) {
    await sql`update profiles set role = 'admin', updated_at = now() where user_id = ${userId} and role <> 'admin'`;
  } else {
    await sql`
      update profiles
      set role = 'admin', updated_at = now()
      where user_id = ${userId}
        and role = 'student'
        and not exists (select 1 from profiles where role = 'admin')
    `;
  }
  const rows = await sql<ProfileRow>`select * from profiles where user_id = ${userId} limit 1`;
  if (!rows[0]) fail("SERVER");
  return mapProfile(rows[0], email);
}

async function requireStaff(sql: Sql, userId: string): Promise<Profile> {
  const profile = await ensureProfile(sql, userId);
  if (profile.role !== "admin" && profile.role !== "teacher") fail("FORBIDDEN");
  return profile;
}

async function requireAdmin(sql: Sql, userId: string): Promise<Profile> {
  const profile = await ensureProfile(sql, userId);
  if (profile.role !== "admin") fail("FORBIDDEN");
  return profile;
}

let seeding: Promise<void> | null = null;

async function ensureSeed(sql: Sql) {
  seeding ??= seedDemo(sql).catch((err) => {
    seeding = null;
    throw err;
  });
  await seeding;
}

async function seedDemo(sql: Sql) {
  const ready = await sql<{ key: string }>`select key from app_settings where key = 'demo_ready'`;
  if (ready.length > 0) return;
  for (const catalog of CATALOGS) {
    await sql`
      insert into catalogs (id, kind, name_hi, name_en, sort_order)
      values (${catalog.id}, ${catalog.kind}, ${catalog.nameHi}, ${catalog.nameEn}, ${catalog.sort})
      on conflict (id) do nothing
    `;
  }
  for (const subject of SUBJECTS) {
    await sql`
      insert into subjects (id, name_hi, name_en)
      values (${subject.id}, ${subject.nameHi}, ${subject.nameEn})
      on conflict (id) do nothing
    `;
  }
  for (const link of SUBJECT_CATALOGS) {
    await sql`
      insert into subject_catalogs (subject_id, catalog_id)
      values (${link.subjectId}, ${link.catalogId})
      on conflict do nothing
    `;
  }
  for (const chapter of CHAPTERS) {
    await sql`
      insert into chapters (id, subject_id, catalog_id, name_hi, name_en, sort_order)
      values (${chapter.id}, ${chapter.subjectId}, ${chapter.catalogId}, ${chapter.nameHi}, ${chapter.nameEn}, ${chapter.sort})
      on conflict (id) do nothing
    `;
  }
  for (const topic of TOPICS) {
    await sql`
      insert into topics (id, chapter_id, subject_id, name_hi, name_en, sort_order)
      values (${topic.id}, ${topic.chapterId}, ${topic.subjectId}, ${topic.nameHi}, ${topic.nameEn}, ${topic.sort})
      on conflict (id) do nothing
    `;
  }
  for (const question of QUESTIONS) await insertQuestion(sql, question, true);
  for (const quiz of QUIZZES) {
    await sql`
      insert into quizzes (
        id, title_hi, title_en, description_hi, description_en, catalog_id, subject_id,
        kind, duration_seconds, negative_marks, shuffle_questions, shuffle_options,
        feedback_mode, status, is_daily, is_demo
      ) values (
        ${quiz.id}, ${quiz.titleHi}, ${quiz.titleEn}, ${quiz.descriptionHi}, ${quiz.descriptionEn},
        ${quiz.catalogId}, ${quiz.subjectId}, ${quiz.kind}, ${quiz.durationSeconds}, ${quiz.negativeMarks},
        ${quiz.shuffleQuestions}, ${quiz.shuffleOptions}, ${quiz.feedbackMode}, 'published',
        ${quiz.isDaily}, true
      )
      on conflict (id) do nothing
    `;
    for (let i = 0; i < quiz.questionIds.length; i += 1) {
      await sql`
        insert into quiz_questions (quiz_id, question_id, sort_order)
        values (${quiz.id}, ${quiz.questionIds[i]}, ${i})
        on conflict do nothing
      `;
    }
  }
  await sql`
    insert into app_settings (key, value) values ('demo_ready', 'true'::jsonb)
    on conflict (key) do nothing
  `;
}

async function insertQuestion(sql: Sql, question: DemoQuestion, demo: boolean) {
  await sql.query(
    `insert into questions (
      id, subject_id, topic_id, chapter_id, catalog_id, type, difficulty,
      prompt_hi, prompt_en, passage_hi, passage_en, figure, options, correct_answers,
      explanation_hi, explanation_en, hint_hi, hint_en, source_note, marks, negative_marks,
      status, content_hash, is_demo
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16,$17,$18,$19,1,0,'published',$20,$21
    ) on conflict (id) do nothing`,
    [
      question.id,
      question.subjectId,
      question.topicId,
      question.chapterId,
      question.catalogId,
      question.type,
      question.difficulty,
      question.promptHi,
      question.promptEn,
      question.passageHi ?? null,
      question.passageEn ?? null,
      question.figure ?? null,
      JSON.stringify(question.options),
      JSON.stringify(question.correct),
      question.explanationHi,
      question.explanationEn,
      question.hintHi ?? null,
      question.hintEn ?? null,
      SOURCE_NOTE,
      hashPrompt(question.promptHi, question.promptEn),
      demo,
    ],
  );
}

type QuestionRow = {
  id: string;
  subject_id: string;
  type: string;
  difficulty: string;
  prompt_hi: string;
  prompt_en: string;
  passage_hi: string | null;
  passage_en: string | null;
  figure: string | null;
  options: unknown;
  correct_answers: unknown;
  explanation_hi: string;
  explanation_en: string;
  hint_hi: string | null;
  hint_en: string | null;
  marks: unknown;
  negative_marks: unknown;
  status: string;
  chapter_id: string | null;
  topic_id: string | null;
  catalog_id: string | null;
};

type StoredKey = KeyEntry & {
  promptHi: string;
  promptEn: string;
  passageHi: string | null;
  passageEn: string | null;
  figure: string | null;
  options: { id: string; hi: string; en: string }[];
  hintHi: string | null;
  hintEn: string | null;
  difficulty: string;
};

function optionsOf(value: unknown): { id: string; hi: string; en: string }[] {
  const list = asJson<unknown>(value, []);
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: string; hi?: string; en?: string };
    if (!row.id) return [];
    return [{ id: String(row.id), hi: String(row.hi ?? ""), en: String(row.en ?? "") }];
  });
}

function toKey(row: QuestionRow): StoredKey {
  return {
    type: row.type,
    correct: strList(row.correct_answers),
    marks: num(row.marks) || 1,
    negative: num(row.negative_marks),
    explanationHi: row.explanation_hi,
    explanationEn: row.explanation_en,
    subjectId: row.subject_id,
    promptHi: row.prompt_hi,
    promptEn: row.prompt_en,
    passageHi: row.passage_hi,
    passageEn: row.passage_en,
    figure: row.figure,
    options: optionsOf(row.options),
    hintHi: row.hint_hi,
    hintEn: row.hint_en,
    difficulty: row.difficulty,
  };
}

function toPlay(row: QuestionRow, order: string[] | undefined, showHint: boolean): PlayQuestion {
  const options = optionsOf(row.options);
  const ranked = order?.length ? [...options].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : options;
  return {
    id: row.id,
    type: row.type,
    difficulty: row.difficulty,
    promptHi: row.prompt_hi,
    promptEn: row.prompt_en,
    passageHi: row.passage_hi,
    passageEn: row.passage_en,
    figure: row.figure,
    options: ranked,
    marks: num(row.marks) || 1,
    negativeMarks: num(row.negative_marks),
    subjectId: row.subject_id,
    hintHi: showHint ? row.hint_hi : null,
    hintEn: showHint ? row.hint_en : null,
  };
}

type AttemptRow = {
  id: string;
  user_id: string;
  quiz_id: string | null;
  mode: string;
  started_at: unknown;
  deadline_at: unknown;
  submitted_at: unknown;
  answers: unknown;
  question_ids: unknown;
  option_orders: unknown;
  answer_key: unknown;
  breakdown: unknown;
  feedback_mode: string;
  negative_override: unknown;
  title_hi: string;
  title_en: string;
  score: unknown;
  maximum_score: unknown;
  correct_count: unknown;
  incorrect_count: unknown;
  unanswered_count: unknown;
  time_taken_seconds: unknown;
  counts_for_rank: boolean;
  status: string;
};

function answersOf(value: unknown): Record<string, StoredAnswer> {
  const raw = asJson<Record<string, StoredAnswer>>(value, {});
  return raw && typeof raw === "object" ? raw : {};
}

function keyMap(value: unknown): Record<string, StoredKey> {
  return asJson<Record<string, StoredKey>>(value, {});
}

async function audit(sql: Sql, adminUid: string, action: string, resourceType: string, resourceId: string) {
  await sql`
    insert into admin_audit_logs (id, admin_uid, action, resource_type, resource_id)
    values (${randomUUID()}, ${adminUid}, ${action}, ${resourceType}, ${resourceId})
  `;
}

async function awardFor(sql: Sql, userId: string, mode: string, summaryPerfect: boolean) {
  const awarded: string[] = [];
  const totals = await sql<{ correct: number; answered: number; mocks: number; quizzes: number }>`
    select
      coalesce(sum(correct_count), 0)::int as correct,
      coalesce(sum(correct_count + incorrect_count), 0)::int as answered,
      coalesce(count(*) filter (where mode = 'mock'), 0)::int as mocks,
      count(*)::int as quizzes
    from attempts
    where user_id = ${userId} and status = 'submitted'
  `;
  const dates = await sql<{ activity_date: string }>`
    select activity_date::text as activity_date
    from daily_activity
    where user_id = ${userId}
    order by activity_date desc
  `;
  const streak = computeStreak(
    dates.map((row) => String(row.activity_date).slice(0, 10)),
    kolkataDate(),
  );
  const correct = num(totals[0]?.correct);
  const answered = num(totals[0]?.answered);
  const checks: [string, boolean][] = [
    ["first_quiz", num(totals[0]?.quizzes) >= 1],
    ["ten_correct", correct >= 10],
    ["questions_100", answered >= 100],
    ["perfect", summaryPerfect],
    ["mock_done", mode === "mock" || num(totals[0]?.mocks) >= 1],
    ["streak_3", streak >= 3],
    ["streak_5", streak >= 5],
  ];
  for (const [id, ok] of checks) {
    if (!ok) continue;
    const inserted = await sql<{ achievement_id: string }>`
      insert into user_achievements (user_id, achievement_id)
      values (${userId}, ${id})
      on conflict do nothing
      returning achievement_id
    `;
    if (inserted[0]) awarded.push(inserted[0].achievement_id);
  }
  return awarded;
}

async function finalize(sql: Sql, userId: string, row: AttemptRow): Promise<string[]> {
  const order = strList(row.question_ids);
  const key = keyMap(row.answer_key);
  const answers = answersOf(row.answers);
  const negative = row.negative_override == null ? null : num(row.negative_override);
  const summary = gradeAttempt(order, key, answers, negative);
  const breakdown: Record<string, string> = {};
  for (const item of summary.items) breakdown[item.questionId] = item.status;
  const started = new Date(iso(row.started_at)).getTime();
  let seconds = Math.max(0, Math.round((Date.now() - started) / 1000));
  if (row.deadline_at) {
    const cap = Math.round((new Date(iso(row.deadline_at)).getTime() - started) / 1000);
    if (cap > 0) seconds = Math.min(seconds, cap);
  }
  const updated = await sql<{ id: string }>`
    update attempts set
      status = 'submitted',
      submitted_at = now(),
      score = ${summary.score},
      maximum_score = ${summary.maximumScore},
      correct_count = ${summary.correct},
      incorrect_count = ${summary.incorrect},
      unanswered_count = ${summary.unanswered},
      time_taken_seconds = ${seconds},
      breakdown = ${JSON.stringify(breakdown)}::jsonb
    where id = ${row.id} and user_id = ${userId} and status = 'in_progress'
    returning id
  `;
  if (!updated[0]) return [];
  const today = kolkataDate();
  const answered = summary.correct + summary.incorrect;
  await sql`
    insert into daily_activity (user_id, activity_date, quiz_count, questions_attempted)
    values (${userId}, ${today}::date, 1, ${answered})
    on conflict (user_id, activity_date) do update set
      quiz_count = daily_activity.quiz_count + 1,
      questions_attempted = daily_activity.questions_attempted + ${answered}
  `;
  const perfect = summary.percentage === 100 && summary.unanswered === 0 && summary.correct > 0;
  return awardFor(sql, userId, row.mode, perfect);
}

async function loadAttempt(sql: Sql, userId: string, attemptId: string): Promise<AttemptRow> {
  const rows = await sql<AttemptRow>`
    select id, user_id, quiz_id, mode, started_at, deadline_at, submitted_at, answers,
      question_ids, option_orders, answer_key, breakdown, feedback_mode, negative_override,
      title_hi, title_en, score, maximum_score, correct_count, incorrect_count,
      unanswered_count, time_taken_seconds, counts_for_rank, status
    from attempts
    where id = ${attemptId} and user_id = ${userId}
    limit 1
  `;
  if (!rows[0]) fail("NOT_FOUND");
  return rows[0];
}

type QuizRow = {
  id: string;
  title_hi: string;
  title_en: string;
  description_hi: string;
  description_en: string;
  catalog_id: string | null;
  subject_id: string | null;
  kind: string;
  duration_seconds: number | null;
  negative_marks: unknown;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  feedback_mode: string;
  status: string;
  is_daily: boolean;
  is_demo: boolean;
  question_count?: number;
};

function mapQuiz(row: QuizRow): QuizCard {
  return {
    id: row.id,
    titleHi: row.title_hi,
    titleEn: row.title_en,
    descriptionHi: row.description_hi,
    descriptionEn: row.description_en,
    catalogId: row.catalog_id,
    subjectId: row.subject_id,
    kind: row.kind,
    durationSeconds: row.duration_seconds == null ? null : num(row.duration_seconds),
    negativeMarks: num(row.negative_marks),
    feedbackMode: row.feedback_mode === "immediate" ? "immediate" : "after_submit",
    isDaily: Boolean(row.is_daily),
    isDemo: Boolean(row.is_demo),
    questionCount: num(row.question_count),
  };
}

const blank = z.string().trim().max(40).optional();

function cleanId(value: string | undefined): string | null {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

export const getTaxonomy = createServerFn({ method: "GET" }).handler(async () =>
  guard(async () => {
    const sql = await getSql();
    await ensureSeed(sql);
    const catalogs = await sql<{ id: string; kind: string; name_hi: string; name_en: string; sort_order: number }>`
      select id, kind, name_hi, name_en, sort_order from catalogs where is_active order by sort_order, name_en
    `;
    const subjects = await sql<{ id: string; name_hi: string; name_en: string }>`
      select id, name_hi, name_en from subjects where is_active order by name_en
    `;
    const links = await sql<{ subject_id: string; catalog_id: string }>`
      select subject_id, catalog_id from subject_catalogs
    `;
    const chapters = await sql<{
      id: string;
      subject_id: string;
      catalog_id: string | null;
      name_hi: string;
      name_en: string;
      sort_order: number;
    }>`select id, subject_id, catalog_id, name_hi, name_en, sort_order from chapters order by sort_order, name_en`;
    const topics = await sql<{
      id: string;
      chapter_id: string;
      subject_id: string;
      name_hi: string;
      name_en: string;
      sort_order: number;
    }>`select id, chapter_id, subject_id, name_hi, name_en, sort_order from topics order by sort_order, name_en`;
    return {
      catalogs: catalogs.map(
        (row): Catalog => ({
          id: row.id,
          kind: row.kind === "exam" ? "exam" : "class",
          nameHi: row.name_hi,
          nameEn: row.name_en,
          sortOrder: num(row.sort_order),
        }),
      ),
      subjects: subjects.map((row): Subject => ({ id: row.id, nameHi: row.name_hi, nameEn: row.name_en })),
      links: links.map((row): SubjectLink => ({ subjectId: row.subject_id, catalogId: row.catalog_id })),
      chapters: chapters.map(
        (row): Chapter => ({
          id: row.id,
          subjectId: row.subject_id,
          catalogId: row.catalog_id,
          nameHi: row.name_hi,
          nameEn: row.name_en,
          sortOrder: num(row.sort_order),
        }),
      ),
      topics: topics.map(
        (row): Topic => ({
          id: row.id,
          chapterId: row.chapter_id,
          subjectId: row.subject_id,
          nameHi: row.name_hi,
          nameEn: row.name_en,
          sortOrder: num(row.sort_order),
        }),
      ),
    };
  }),
);

const QuizFilter = z.object({
  catalogId: blank,
  subjectId: blank,
  kind: blank,
  chapterId: blank,
  topicId: blank,
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

export const listQuizzes = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(QuizFilter, data ?? {}))
  .handler(async ({ data }) =>
    guard(async () => {
      const sql = await getSql();
      await ensureSeed(sql);
      const rows = await sql.query<QuizRow>(
        `select q.*, (select count(*)::int from quiz_questions qq where qq.quiz_id = q.id) as question_count
         from quizzes q
         where q.status = 'published'
           and ($1::text is null or q.catalog_id = $1)
           and ($2::text is null or q.subject_id = $2)
           and ($3::text is null or q.kind = $3)
           and (
             $4::text is null and $5::text is null and $6::text is null
             or exists (
               select 1
               from quiz_questions qq
               join questions qs on qs.id = qq.question_id
               where qq.quiz_id = q.id
                 and qs.status = 'published'
                 and ($4::text is null or qs.chapter_id = $4)
                 and ($5::text is null or qs.topic_id = $5)
                 and ($6::text is null or qs.difficulty = $6)
             )
           )
         order by q.is_daily desc, q.title_en`,
        [
          cleanId(data.catalogId),
          cleanId(data.subjectId),
          cleanId(data.kind),
          cleanId(data.chapterId),
          cleanId(data.topicId),
          data.difficulty ?? null,
        ],
      );
      return rows.map(mapQuiz);
    }),
  );

export const getQuizDetail = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(z.object({ quizId: z.string().trim().min(1).max(80) }), data))
  .handler(async ({ data }) =>
    guard(async () => {
      const sql = await getSql();
      await ensureSeed(sql);
      const rows = await sql.query<QuizRow>(
        `select q.*, (select count(*)::int from quiz_questions qq where qq.quiz_id = q.id) as question_count
         from quizzes q where q.id = $1 and q.status = 'published' limit 1`,
        [data.quizId],
      );
      if (!rows[0]) fail("NOT_FOUND");
      return mapQuiz(rows[0]);
    }),
  );

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    guard(async () => {
      const sql = await getSql();
      await ensureSeed(sql);
      return ensureProfile(sql, context.userId);
    }),
  );

const ProfileInput = z.object({
  displayName: z.string().trim().min(1).max(40),
  preferredLanguage: z.enum(["hi", "en"]),
  selectedClass: z.string().trim().max(40).nullable(),
  examTargets: z.array(z.string().trim().max(40)).max(12),
  selectedSubjects: z.array(z.string().trim().max(40)).max(20),
  dailyGoal: z.number().int().min(1).max(100),
  showOnLeaderboard: z.boolean(),
  theme: z.enum(["light", "dark", "system"]),
  photoUrl: z.string().max(400).nullable(),
  onboardingDone: z.boolean(),
  guardianAck: z.boolean(),
});

export const saveProfile = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(ProfileInput, data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const profile = await ensureProfile(sql, context.userId);
      let photo: string | null = null;
      if (data.photoUrl) {
        let url: URL;
        try {
          url = new URL(data.photoUrl);
        } catch {
          fail("VALIDATION");
        }
        if (url.protocol !== "https:") fail("VALIDATION");
        photo = url.toString();
      }
      const displayName = data.displayName.replace(/[\u0000-\u001f]/g, "").trim();
      if (!displayName) fail("VALIDATION");
      await sql`
        update profiles set
          display_name = ${displayName},
          preferred_language = ${data.preferredLanguage},
          selected_class = ${data.selectedClass || null},
          exam_targets = ${JSON.stringify(data.examTargets)}::jsonb,
          selected_subjects = ${JSON.stringify(data.selectedSubjects)}::jsonb,
          daily_goal = ${data.dailyGoal},
          show_on_leaderboard = ${data.showOnLeaderboard},
          theme = ${data.theme},
          photo_url = ${photo},
          onboarding_done = ${data.onboardingDone},
          guardian_ack = ${data.guardianAck || profile.guardianAck},
          updated_at = now()
        where user_id = ${context.userId}
      `;
      return ensureProfile(sql, context.userId);
    }),
  );

async function subjectStats(sql: Sql, userId: string): Promise<SubjectStat[]> {
  const rows = await sql<{ subject_id: string; name_hi: string; name_en: string; correct: number; incorrect: number }>`
    select s.id as subject_id, s.name_hi, s.name_en,
      coalesce(sum(case when e.value = 'correct' then 1 else 0 end), 0)::int as correct,
      coalesce(sum(case when e.value = 'incorrect' then 1 else 0 end), 0)::int as incorrect
    from attempts a
    cross join lateral jsonb_each_text(a.breakdown) e
    join questions q on q.id = e.key
    join subjects s on s.id = q.subject_id
    where a.user_id = ${userId} and a.status = 'submitted'
    group by s.id, s.name_hi, s.name_en
    order by (coalesce(sum(case when e.value = 'correct' then 1 else 0 end), 0)
      + coalesce(sum(case when e.value = 'incorrect' then 1 else 0 end), 0)) desc
  `;
  return rows.map((row) => ({
    subjectId: row.subject_id,
    nameHi: row.name_hi,
    nameEn: row.name_en,
    correct: num(row.correct),
    incorrect: num(row.incorrect),
  }));
}

async function recentAttempts(sql: Sql, userId: string): Promise<RecentAttempt[]> {
  const rows = await sql<{
    id: string;
    title_hi: string;
    title_en: string;
    mode: string;
    score: unknown;
    maximum_score: unknown;
    submitted_at: unknown;
  }>`
    select id, title_hi, title_en, mode, score, maximum_score, submitted_at
    from attempts
    where user_id = ${userId} and status = 'submitted'
    order by submitted_at desc
    limit 8
  `;
  return rows.map((row) => {
    const score = num(row.score);
    const maximumScore = num(row.maximum_score);
    return {
      id: row.id,
      titleHi: row.title_hi,
      titleEn: row.title_en,
      mode: row.mode,
      score,
      maximumScore,
      percentage: maximumScore > 0 ? round2((score / maximumScore) * 100) : 0,
      submittedAt: iso(row.submitted_at),
    };
  });
}

async function badges(sql: Sql, userId: string): Promise<AchievementBadge[]> {
  const rows = await sql<{
    id: string;
    name_hi: string;
    name_en: string;
    description_hi: string;
    description_en: string;
    awarded_at: unknown;
  }>`
    select a.id, a.name_hi, a.name_en, a.description_hi, a.description_en, ua.awarded_at
    from achievements a
    left join user_achievements ua on ua.achievement_id = a.id and ua.user_id = ${userId}
    order by a.id
  `;
  return rows.map((row) => ({
    id: row.id,
    nameHi: row.name_hi,
    nameEn: row.name_en,
    descriptionHi: row.description_hi,
    descriptionEn: row.description_en,
    awardedAt: row.awarded_at ? iso(row.awarded_at) : null,
  }));
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DashboardData> =>
    guard(async () => {
      const sql = await getSql();
      await ensureSeed(sql);
      const profile = await ensureProfile(sql, context.userId);
      const today = kolkataDate();
      const statsRow = await sql<{
        correct: number;
        incorrect: number;
        mocks: number;
        quizzes: number;
      }>`
        select
          coalesce(sum(correct_count), 0)::int as correct,
          coalesce(sum(incorrect_count), 0)::int as incorrect,
          coalesce(count(*) filter (where mode = 'mock'), 0)::int as mocks,
          count(*)::int as quizzes
        from attempts
        where user_id = ${context.userId} and status = 'submitted'
      `;
      const todayRow = await sql<{ questions_attempted: number }>`
        select questions_attempted from daily_activity
        where user_id = ${context.userId} and activity_date = ${today}::date
      `;
      const marks = await sql<{ n: number }>`select count(*)::int as n from bookmarks where user_id = ${context.userId}`;
      const dates = await sql<{ activity_date: string }>`
        select activity_date::text as activity_date from daily_activity
        where user_id = ${context.userId} order by activity_date desc
      `;
      const open = await sql<{ id: string; title_hi: string; title_en: string; mode: string; deadline_at: unknown }>`
        select id, title_hi, title_en, mode, deadline_at from attempts
        where user_id = ${context.userId} and status = 'in_progress'
        order by started_at desc limit 1
      `;
      const quizzes = await sql.query<QuizRow>(
        `select q.*, (select count(*)::int from quiz_questions qq where qq.quiz_id = q.id) as question_count
         from quizzes q
         where q.status = 'published' and q.kind <> 'daily'
           and ($1::text is null or q.catalog_id = $1 or q.catalog_id is null)
         order by case when q.catalog_id = $1 then 0 else 1 end, q.title_en
         limit 4`,
        [profile.selectedClass],
      );
      const dailyRows = await sql.query<QuizRow>(
        `select q.*, (select count(*)::int from quiz_questions qq where qq.quiz_id = q.id) as question_count
         from quizzes q where q.is_daily = true and q.status = 'published' limit 1`,
      );
      let daily: DashboardData["daily"] = null;
      if (dailyRows[0]) {
        const done = await sql<{ id: string }>`
          select id from attempts
          where user_id = ${context.userId} and quiz_id = ${dailyRows[0].id} and status = 'submitted'
            and (submitted_at at time zone 'Asia/Kolkata')::date = ${today}::date
          order by submitted_at desc limit 1
        `;
        daily = { quiz: mapQuiz(dailyRows[0]), doneToday: Boolean(done[0]), attemptId: done[0]?.id ?? null };
      }
      const activityRows = await sql<{ activity_date: string; questions_attempted: number }>`
        select activity_date::text as activity_date, questions_attempted
        from daily_activity
        where user_id = ${context.userId} and activity_date >= ${shiftDate(today, -13)}::date
        order by activity_date
      `;
      const byDate = new Map(activityRows.map((row) => [String(row.activity_date).slice(0, 10), num(row.questions_attempted)]));
      const activity = Array.from({ length: 14 }, (_, index) => {
        const date = shiftDate(today, index - 13);
        return { date, questions: byDate.get(date) ?? 0 };
      });
      const correct = num(statsRow[0]?.correct);
      const incorrect = num(statsRow[0]?.incorrect);
      return {
        profile,
        stats: {
          answered: correct + incorrect,
          correct,
          incorrect,
          accuracy: correct + incorrect > 0 ? round2((correct / (correct + incorrect)) * 100) : 0,
          mocks: num(statsRow[0]?.mocks),
          quizzesDone: num(statsRow[0]?.quizzes),
          streak: computeStreak(dates.map((row) => String(row.activity_date).slice(0, 10)), today),
          bookmarks: num(marks[0]?.n),
          todayAnswered: num(todayRow[0]?.questions_attempted),
        },
        continueAttempt: open[0]
          ? {
              id: open[0].id,
              titleHi: open[0].title_hi,
              titleEn: open[0].title_en,
              mode: open[0].mode,
              deadlineAt: isoOrNull(open[0].deadline_at),
            }
          : null,
        recent: await recentAttempts(sql, context.userId),
        recommended: quizzes.map(mapQuiz),
        daily,
        subjects: await subjectStats(sql, context.userId),
        achievements: await badges(sql, context.userId),
        activity,
      };
    }),
  );

export const getProgress = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    guard(async () => {
      const dash = await (async () => {
        const sql = await getSql();
        await ensureSeed(sql);
        const profile = await ensureProfile(sql, context.userId);
        const today = kolkataDate();
        const dates = await sql<{ activity_date: string }>`
          select activity_date::text as activity_date from daily_activity where user_id = ${context.userId} order by activity_date desc
        `;
        const statsRow = await sql<{ correct: number; incorrect: number; unanswered: number; mocks: number }>`
          select coalesce(sum(correct_count),0)::int as correct,
                 coalesce(sum(incorrect_count),0)::int as incorrect,
                 coalesce(sum(unanswered_count),0)::int as unanswered,
                 coalesce(count(*) filter (where mode = 'mock'),0)::int as mocks
          from attempts where user_id = ${context.userId} and status = 'submitted'
        `;
        const activityRows = await sql<{ activity_date: string; questions_attempted: number }>`
          select activity_date::text as activity_date, questions_attempted from daily_activity
          where user_id = ${context.userId} and activity_date >= ${shiftDate(today, -13)}::date
        `;
        const byDate = new Map(activityRows.map((row) => [String(row.activity_date).slice(0, 10), num(row.questions_attempted)]));
        return {
          profile,
          correct: num(statsRow[0]?.correct),
          incorrect: num(statsRow[0]?.incorrect),
          unanswered: num(statsRow[0]?.unanswered),
          mocks: num(statsRow[0]?.mocks),
          streak: computeStreak(dates.map((row) => String(row.activity_date).slice(0, 10)), today),
          subjects: await subjectStats(sql, context.userId),
          recent: await recentAttempts(sql, context.userId),
          achievements: await badges(sql, context.userId),
          activity: Array.from({ length: 14 }, (_, index) => {
            const date = shiftDate(today, index - 13);
            return { date, questions: byDate.get(date) ?? 0 };
          }),
        };
      })();
      return dash;
    }),
  );

const BoardInput = z.object({
  period: z.enum(["week", "month", "all"]),
  quizId: z.string().trim().max(80).optional(),
  offset: z.number().int().min(0).max(500).optional(),
});

export const getLeaderboard = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(BoardInput, data ?? {}))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      await ensureProfile(sql, context.userId);
      const setting = await sql<{ value: unknown }>`select value from app_settings where key = 'leaderboard_enabled'`;
      const enabled = setting[0] ? asJson<boolean>(setting[0].value, true) !== false : true;
      if (!enabled) return { enabled: false, rows: [] as LeaderRow[], mine: null as LeaderRow | null };
      const today = kolkataDate();
      let start: string | null = null;
      if (data.period === "week") {
        const [y, m, d] = today.split("-").map(Number);
        const weekday = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
        start = shiftDate(today, -(weekday === 0 ? 6 : weekday - 1));
      } else if (data.period === "month") start = `${today.slice(0, 7)}-01`;
      const offset = data.offset ?? 0;
      const rows = await sql.query<{
        user_id: string;
        display_name: string;
        points: unknown;
        correct: unknown;
        incorrect: unknown;
      }>(
        `with best as (
           select a.user_id, a.quiz_id, max(a.score) as score,
             (array_agg(a.correct_count order by a.score desc, a.submitted_at asc))[1] as correct_count,
             (array_agg(a.incorrect_count order by a.score desc, a.submitted_at asc))[1] as incorrect_count,
             min(a.submitted_at) as first_submit
           from attempts a
           where a.status = 'submitted' and a.counts_for_rank = true and a.quiz_id is not null
             and ($1::text is null or a.quiz_id = $1)
             and ($2::date is null or (a.submitted_at at time zone 'Asia/Kolkata')::date >= $2::date)
           group by a.user_id, a.quiz_id
         ),
         agg as (
           select user_id, sum(score) as points, sum(correct_count) as correct,
             sum(incorrect_count) as incorrect, min(first_submit) as first_submit
           from best group by user_id
         )
         select p.user_id, p.display_name, agg.points, agg.correct, agg.incorrect
         from agg
         join profiles p on p.user_id = agg.user_id
         where p.show_on_leaderboard = true
         order by agg.points desc,
           case when agg.correct + agg.incorrect = 0 then 0
                else agg.correct::float / (agg.correct + agg.incorrect) end desc,
           agg.first_submit asc
         limit 20 offset $3`,
        [cleanId(data.quizId), start, offset],
      );
      const mapped = rows.map((row, index): LeaderRow => {
        const correct = num(row.correct);
        const incorrect = num(row.incorrect);
        return {
          rank: offset + index + 1,
          displayName: row.display_name || "Student",
          points: round2(num(row.points)),
          accuracy: correct + incorrect > 0 ? round2((correct / (correct + incorrect)) * 100) : 0,
          mine: row.user_id === context.userId,
        };
      });
      return { enabled: true, rows: mapped, mine: mapped.find((row) => row.mine) ?? null };
    }),
  );

async function openAttempt(
  sql: Sql,
  userId: string,
  input: {
    quizId: string | null;
    mode: string;
    titleHi: string;
    titleEn: string;
    questionIds: string[];
    feedbackMode: "immediate" | "after_submit";
    durationSeconds: number | null;
    negativeMarks: number;
    shuffleOptions: boolean;
    countsForRank: boolean;
  },
) {
  const ids = input.questionIds;
  if (ids.length === 0) fail("EMPTY");
  const rows = await sql.query<QuestionRow>(
    `select * from questions where id = any($1::text[]) and status = 'published'`,
    [ids],
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => byId.get(id)).filter((row): row is QuestionRow => Boolean(row));
  if (ordered.length === 0) fail("EMPTY");
  const answerKey: Record<string, StoredKey> = {};
  const optionOrders: Record<string, string[]> = {};
  for (const row of ordered) {
    answerKey[row.id] = toKey(row);
    const optionIds = optionsOf(row.options).map((option) => option.id);
    optionOrders[row.id] = input.shuffleOptions ? shuffle(optionIds) : optionIds;
  }
  const id = randomUUID();
  const deadline =
    input.durationSeconds && input.durationSeconds > 0
      ? new Date(Date.now() + input.durationSeconds * 1000).toISOString()
      : null;
  await sql.query(
    `insert into attempts (
      id, user_id, quiz_id, mode, deadline_at, answers, question_ids, option_orders, answer_key,
      feedback_mode, negative_override, title_hi, title_en, counts_for_rank, status
    ) values (
      $1,$2,$3,$4,$5,'{}'::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,'in_progress'
    )`,
    [
      id,
      userId,
      input.quizId,
      input.mode,
      deadline,
      JSON.stringify(ordered.map((row) => row.id)),
      JSON.stringify(optionOrders),
      JSON.stringify(answerKey),
      input.feedbackMode,
      input.negativeMarks > 0 ? input.negativeMarks : null,
      input.titleHi,
      input.titleEn,
      input.countsForRank,
    ],
  );
  return id;
}

export const startQuiz = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(z.object({ quizId: z.string().trim().min(1).max(80) }), data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      rateLimit(`start:${context.userId}`, 30, 10 * 60 * 1000);
      const sql = await getSql();
      await ensureSeed(sql);
      await ensureProfile(sql, context.userId);
      const quizzes = await sql.query<QuizRow>(`select * from quizzes where id = $1 and status = 'published' limit 1`, [
        data.quizId,
      ]);
      const quiz = quizzes[0];
      if (!quiz) fail("NOT_FOUND");
      const today = kolkataDate();
      if (quiz.is_daily) {
        const done = await sql<{ id: string }>`
          select id from attempts
          where user_id = ${context.userId} and quiz_id = ${quiz.id} and status = 'submitted'
            and (submitted_at at time zone 'Asia/Kolkata')::date = ${today}::date
          limit 1
        `;
        if (done[0]) return { state: "submitted" as const, attemptId: done[0].id, alreadyDone: true };
      }
      const open = await sql<{ id: string }>`
        select id from attempts
        where user_id = ${context.userId} and quiz_id = ${quiz.id} and status = 'in_progress'
        limit 1
      `;
      if (open[0]) return { state: "live" as const, attemptId: open[0].id };
      const linked = await sql<{ question_id: string }>`
        select question_id from quiz_questions where quiz_id = ${quiz.id} order by sort_order
      `;
      const questionIds = quiz.shuffle_questions ? shuffle(linked.map((row) => row.question_id)) : linked.map((row) => row.question_id);
      try {
        const attemptId = await openAttempt(sql, context.userId, {
          quizId: quiz.id,
          mode: quiz.kind,
          titleHi: quiz.title_hi,
          titleEn: quiz.title_en,
          questionIds,
          feedbackMode: quiz.feedback_mode === "immediate" ? "immediate" : "after_submit",
          durationSeconds: quiz.duration_seconds,
          negativeMarks: num(quiz.negative_marks),
          shuffleOptions: Boolean(quiz.shuffle_options),
          countsForRank: quiz.kind === "quiz" || quiz.kind === "mock" || quiz.kind === "daily",
        });
        return { state: "live" as const, attemptId };
      } catch (err) {
        const again = await sql<{ id: string }>`
          select id from attempts
          where user_id = ${context.userId} and quiz_id = ${quiz.id} and status = 'in_progress'
          limit 1
        `;
        if (again[0]) return { state: "live" as const, attemptId: again[0].id };
        throw err;
      }
    }),
  );

const CustomInput = z.object({
  mode: z.enum(["practice", "revision"]),
  subjectId: blank,
  chapterId: blank,
  topicId: blank,
  catalogId: blank,
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  limit: z.number().int().min(3).max(20).optional(),
});

export const startCustom = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(CustomInput, data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      rateLimit(`start:${context.userId}`, 30, 10 * 60 * 1000);
      const sql = await getSql();
      await ensureSeed(sql);
      await ensureProfile(sql, context.userId);
      const limit = data.limit ?? 8;
      let ids: string[] = [];
      if (data.mode === "revision") {
        const rows = await sql.query<{ id: string }>(
          `select picked.id from (
             select e.key as id
             from attempts a
             cross join lateral jsonb_each_text(a.breakdown) e
             where a.user_id = $1 and a.status = 'submitted' and e.value = 'incorrect'
             union
             select question_id as id from bookmarks where user_id = $1
           ) picked
           join questions q on q.id = picked.id
           where q.status = 'published'
             and ($2::text is null or q.subject_id = $2)
             and ($3::text is null or q.chapter_id = $3)
             and ($4::text is null or q.topic_id = $4)
             and ($5::text is null or q.catalog_id = $5)
             and ($6::text is null or q.difficulty = $6)
           limit $7`,
          [
            context.userId,
            cleanId(data.subjectId),
            cleanId(data.chapterId),
            cleanId(data.topicId),
            cleanId(data.catalogId),
            data.difficulty ?? null,
            limit,
          ],
        );
        ids = rows.map((row) => row.id);
      } else {
        const rows = await sql.query<{ id: string }>(
          `select id from questions
           where status = 'published'
             and ($1::text is null or subject_id = $1)
             and ($2::text is null or chapter_id = $2)
             and ($3::text is null or topic_id = $3)
             and ($4::text is null or catalog_id = $4)
             and ($5::text is null or difficulty = $5)
           order by random()
           limit $6`,
          [
            cleanId(data.subjectId),
            cleanId(data.chapterId),
            cleanId(data.topicId),
            cleanId(data.catalogId),
            data.difficulty ?? null,
            limit,
          ],
        );
        ids = rows.map((row) => row.id);
      }
      const attemptId = await openAttempt(sql, context.userId, {
        quizId: null,
        mode: data.mode,
        titleHi: data.mode === "revision" ? "दोहराव" : "अभ्यास",
        titleEn: data.mode === "revision" ? "Revision" : "Practice",
        questionIds: ids,
        feedbackMode: "immediate",
        durationSeconds: null,
        negativeMarks: 0,
        shuffleOptions: true,
        countsForRank: false,
      });
      return { state: "live" as const, attemptId };
    }),
  );

function answerState(raw: StoredAnswer | undefined): { choice: string[]; review: boolean; revealed: boolean } {
  return {
    choice: Array.isArray(raw?.choice) ? raw.choice.map(String) : [],
    review: Boolean(raw?.review),
    revealed: Boolean(raw?.revealed),
  };
}

export const getPlay = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(z.object({ attemptId: z.string().uuid() }), data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<LiveAttempt | { state: "submitted"; attemptId: string }> =>
    guard(async () => {
      const sql = await getSql();
      let row = await loadAttempt(sql, context.userId, data.attemptId);
      if (row.status === "in_progress" && row.deadline_at && new Date(iso(row.deadline_at)).getTime() <= Date.now()) {
        await finalize(sql, context.userId, row);
        row = await loadAttempt(sql, context.userId, data.attemptId);
      }
      if (row.status === "submitted") return { state: "submitted", attemptId: row.id };
      const ids = strList(row.question_ids);
      const questions = await sql.query<QuestionRow>(`select * from questions where id = any($1::text[])`, [ids]);
      const byId = new Map(questions.map((item) => [item.id, item]));
      const orders = asJson<Record<string, string[]>>(row.option_orders, {});
      const showHint = row.feedback_mode === "immediate";
      const answers = answersOf(row.answers);
      const key = keyMap(row.answer_key);
      const reveals: Record<string, Reveal> = {};
      const playAnswers: LiveAttempt["answers"] = {};
      for (const id of ids) {
        const state = answerState(answers[id]);
        playAnswers[id] = state;
        if (state.revealed && key[id]) {
          const graded = gradeAttempt([id], key, { [id]: state }, row.negative_override == null ? null : num(row.negative_override));
          reveals[id] = {
            correct: graded.items[0]?.status === "correct",
            correctAnswers: key[id].correct,
            explanationHi: key[id].explanationHi,
            explanationEn: key[id].explanationEn,
          };
        }
      }
      return {
        state: "live",
        attemptId: row.id,
        quizId: row.quiz_id,
        mode: row.mode,
        titleHi: row.title_hi,
        titleEn: row.title_en,
        feedbackMode: row.feedback_mode === "immediate" ? "immediate" : "after_submit",
        deadlineAt: isoOrNull(row.deadline_at),
        serverNow: new Date().toISOString(),
        questions: ids.flatMap((id) => {
          const question = byId.get(id);
          return question ? [toPlay(question, orders[id], showHint)] : [];
        }),
        answers: playAnswers,
        reveals,
      };
    }),
  );

const SaveInput = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  choice: z.array(z.string().max(120)).max(8),
  review: z.boolean(),
});

export const saveAnswer = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(SaveInput, data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      rateLimit(`save:${context.userId}`, 120, 60 * 1000);
      const sql = await getSql();
      const row = await loadAttempt(sql, context.userId, data.attemptId);
      if (row.status !== "in_progress") return { expired: true as const };
      if (row.deadline_at && new Date(iso(row.deadline_at)).getTime() <= Date.now()) {
        await finalize(sql, context.userId, row);
        return { expired: true as const };
      }
      const ids = strList(row.question_ids);
      if (!ids.includes(data.questionId)) fail("VALIDATION");
      const current = answerState(answersOf(row.answers)[data.questionId]);
      if (current.revealed) fail("LOCKED");
      const key = keyMap(row.answer_key)[data.questionId];
      let choice = data.choice.map((item) => item.trim()).filter(Boolean).slice(0, 8);
      if (key && ["mcq", "multi", "tf", "passage"].includes(key.type)) {
        const allowed = new Set(key.options.map((option) => option.id));
        choice = choice.filter((item) => allowed.has(item));
        if (key.type !== "multi") choice = choice.slice(0, 1);
      } else choice = choice.slice(0, 1);
      const payload = { choice, review: data.review, revealed: false };
      await sql`
        update attempts
        set answers = jsonb_set(answers, ${`{${data.questionId}}`}::text[], ${JSON.stringify(payload)}::jsonb, true)
        where id = ${row.id} and user_id = ${context.userId} and status = 'in_progress'
      `;
      return { expired: false as const };
    }),
  );

export const revealAnswer = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    parse(z.object({ attemptId: z.string().uuid(), questionId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/) }), data),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const row = await loadAttempt(sql, context.userId, data.attemptId);
      if (row.feedback_mode !== "immediate") fail("FORBIDDEN");
      if (row.status !== "in_progress") return { expired: true as const, reveal: null };
      const state = answerState(answersOf(row.answers)[data.questionId]);
      if (state.choice.length === 0) fail("VALIDATION");
      const key = keyMap(row.answer_key)[data.questionId];
      if (!key) fail("NOT_FOUND");
      const payload = { ...state, revealed: true };
      await sql`
        update attempts
        set answers = jsonb_set(answers, ${`{${data.questionId}}`}::text[], ${JSON.stringify(payload)}::jsonb, true)
        where id = ${row.id} and user_id = ${context.userId} and status = 'in_progress'
      `;
      const graded = gradeAttempt([data.questionId], { [data.questionId]: key }, { [data.questionId]: payload }, null);
      const reveal: Reveal = {
        correct: graded.items[0]?.status === "correct",
        correctAnswers: key.correct,
        explanationHi: key.explanationHi,
        explanationEn: key.explanationEn,
      };
      return { expired: false as const, reveal };
    }),
  );

export const submitAttempt = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(z.object({ attemptId: z.string().uuid() }), data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      rateLimit(`submit:${context.userId}`, 20, 10 * 60 * 1000);
      const sql = await getSql();
      const row = await loadAttempt(sql, context.userId, data.attemptId);
      if (row.status === "in_progress") await finalize(sql, context.userId, row);
      return { attemptId: row.id };
    }),
  );

export const getResult = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(z.object({ attemptId: z.string().uuid() }), data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<QuizResult> =>
    guard(async () => {
      const sql = await getSql();
      const row = await loadAttempt(sql, context.userId, data.attemptId);
      if (row.status !== "submitted") fail("FORBIDDEN");
      const order = strList(row.question_ids);
      const key = keyMap(row.answer_key);
      const answers = answersOf(row.answers);
      const live = await sql.query<QuestionRow>(`select * from questions where id = any($1::text[])`, [order]);
      const byId = new Map(live.map((item) => [item.id, item]));
      const subjects = new Map<string, { correct: number; incorrect: number; unanswered: number }>();
      const questions: QuizResult["questions"] = order.flatMap((id) => {
        const entry = key[id];
        if (!entry) return [];
        const choice = answerState(answers[id]).choice;
        const graded = gradeAttempt([id], { [id]: entry }, { [id]: { choice } }, row.negative_override == null ? null : num(row.negative_override));
        const status = graded.items[0]?.status ?? "unanswered";
        const bucket = subjects.get(entry.subjectId) ?? { correct: 0, incorrect: 0, unanswered: 0 };
        bucket[status] += 1;
        subjects.set(entry.subjectId, bucket);
        const rowLive = byId.get(id);
        const base: PlayQuestion = rowLive
          ? toPlay(rowLive, undefined, false)
          : {
              id,
              type: entry.type,
              difficulty: entry.difficulty,
              promptHi: entry.promptHi,
              promptEn: entry.promptEn,
              passageHi: entry.passageHi,
              passageEn: entry.passageEn,
              figure: entry.figure,
              options: entry.options,
              marks: entry.marks,
              negativeMarks: entry.negative,
              subjectId: entry.subjectId,
              hintHi: null,
              hintEn: null,
            };
        return [
          {
            ...base,
            status,
            awarded: graded.items[0]?.awarded ?? 0,
            yourChoice: choice,
            correctAnswers: entry.correct,
            explanationHi: entry.explanationHi,
            explanationEn: entry.explanationEn,
          },
        ];
      });
      const score = num(row.score);
      const maximumScore = num(row.maximum_score);
      return {
        attemptId: row.id,
        quizId: row.quiz_id,
        mode: row.mode,
        titleHi: row.title_hi,
        titleEn: row.title_en,
        score,
        maximumScore,
        percentage: maximumScore > 0 ? round2((score / maximumScore) * 100) : 0,
        correct: num(row.correct_count),
        incorrect: num(row.incorrect_count),
        unanswered: num(row.unanswered_count),
        timeTakenSeconds: num(row.time_taken_seconds),
        submittedAt: iso(row.submitted_at),
        questions,
        subjects: [...subjects.entries()].map(([subjectId, counts]) => ({ subjectId, ...counts })),
        newAchievements: [],
      };
    }),
  );

export const toggleBookmark = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(z.object({ questionId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/) }), data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      await ensureProfile(sql, context.userId);
      const removed = await sql<{ question_id: string }>`
        delete from bookmarks where user_id = ${context.userId} and question_id = ${data.questionId}
        returning question_id
      `;
      if (removed[0]) return { saved: false };
      const exists = await sql<{ id: string }>`select id from questions where id = ${data.questionId} and status = 'published'`;
      if (!exists[0]) fail("NOT_FOUND");
      await sql`
        insert into bookmarks (user_id, question_id) values (${context.userId}, ${data.questionId})
        on conflict do nothing
      `;
      return { saved: true };
    }),
  );

export const listBookmarks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    guard(async () => {
      const sql = await getSql();
      await ensureProfile(sql, context.userId);
      const rows = await sql<{
        question_id: string;
        prompt_hi: string;
        prompt_en: string;
        subject_id: string;
        difficulty: string;
        created_at: unknown;
      }>`
        select b.question_id, q.prompt_hi, q.prompt_en, q.subject_id, q.difficulty, b.created_at
        from bookmarks b
        join questions q on q.id = b.question_id
        where b.user_id = ${context.userId}
        order by b.created_at desc
        limit 100
      `;
      return rows.map(
        (row): BookmarkItem => ({
          questionId: row.question_id,
          promptHi: row.prompt_hi,
          promptEn: row.prompt_en,
          subjectId: row.subject_id,
          difficulty: row.difficulty,
          createdAt: iso(row.created_at),
        }),
      );
    }),
  );

export const sendReport = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    parse(
      z.object({
        contentType: z.enum(["question", "quiz"]),
        contentId: z.string().trim().min(1).max(80),
        reason: z.string().trim().min(8).max(500),
      }),
      data,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      rateLimit(`report:${context.userId}`, 10, 60 * 60 * 1000);
      const sql = await getSql();
      await ensureProfile(sql, context.userId);
      await sql`
        insert into reports (id, user_id, content_type, content_id, reason)
        values (${randomUUID()}, ${context.userId}, ${data.contentType}, ${data.contentId}, ${data.reason})
      `;
      return { ok: true };
    }),
  );

export const deleteAccount = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(z.object({ confirm: z.string() }), data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      if (data.confirm !== "DELETE") fail("CONFIRM");
      const sql = await getSql();
      const profile = await ensureProfile(sql, context.userId);
      if (profile.role === "admin") {
        const admins = await sql<{ n: number }>`select count(*)::int as n from profiles where role = 'admin'`;
        if (num(admins[0]?.n) <= 1) fail("LAST_ADMIN");
      }
      await sql`delete from bookmarks where user_id = ${context.userId}`;
      await sql`delete from daily_activity where user_id = ${context.userId}`;
      await sql`delete from user_achievements where user_id = ${context.userId}`;
      await sql`delete from reports where user_id = ${context.userId}`;
      await sql`delete from attempts where user_id = ${context.userId}`;
      await sql`delete from profiles where user_id = ${context.userId}`;
      await sql`delete from "session" where "userId" = ${context.userId}`;
      await sql`delete from "account" where "userId" = ${context.userId}`;
      await sql`delete from "user" where id = ${context.userId}`;
      return { ok: true };
    }),
  );

const QuestionInput = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{0,80}$/).optional(),
  subjectId: z.string().trim().min(1).max(40),
  chapterId: z.string().trim().max(40).nullable(),
  topicId: z.string().trim().max(40).nullable(),
  catalogId: z.string().trim().max(40).nullable(),
  type: z.enum(["mcq", "multi", "tf", "fill", "numerical", "passage"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  promptHi: z.string().max(2000),
  promptEn: z.string().max(2000),
  passageHi: z.string().max(4000).nullable(),
  passageEn: z.string().max(4000).nullable(),
  options: z.array(z.object({ id: z.string().trim().min(1).max(20), hi: z.string().max(500), en: z.string().max(500) })).max(8),
  correct: z.array(z.string().max(200)).max(8),
  explanationHi: z.string().max(4000),
  explanationEn: z.string().max(4000),
  hintHi: z.string().max(500).nullable(),
  hintEn: z.string().max(500).nullable(),
  marks: z.number().min(0.25).max(20),
  negative: z.number().min(0).max(20),
  status: z.enum(["draft", "published"]),
});

async function writeQuestion(sql: Sql, data: z.infer<typeof QuestionInput>, demo = false) {
  const problem = validateQuestionDraft({
    type: data.type,
    promptHi: data.promptHi,
    promptEn: data.promptEn,
    options: data.options,
    correct: data.correct,
    marks: data.marks,
    negative: data.negative,
  });
  if (problem) fail("VALIDATION");
  const id = data.id?.trim() || `q-${randomUUID().slice(0, 8)}`;
  const hash = hashPrompt(data.promptHi, data.promptEn);
  const clash = await sql<{ id: string }>`select id from questions where content_hash = ${hash} and id <> ${id} limit 1`;
  if (clash[0]) fail("DUPLICATE");
  await sql.query(
    `insert into questions (
      id, subject_id, topic_id, chapter_id, catalog_id, type, difficulty,
      prompt_hi, prompt_en, passage_hi, passage_en, figure, options, correct_answers,
      explanation_hi, explanation_en, hint_hi, hint_en, source_note, marks, negative_marks,
      status, content_hash, is_demo, version
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,null,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,1
    )
    on conflict (id) do update set
      subject_id = excluded.subject_id,
      topic_id = excluded.topic_id,
      chapter_id = excluded.chapter_id,
      catalog_id = excluded.catalog_id,
      type = excluded.type,
      difficulty = excluded.difficulty,
      prompt_hi = excluded.prompt_hi,
      prompt_en = excluded.prompt_en,
      passage_hi = excluded.passage_hi,
      passage_en = excluded.passage_en,
      options = excluded.options,
      correct_answers = excluded.correct_answers,
      explanation_hi = excluded.explanation_hi,
      explanation_en = excluded.explanation_en,
      hint_hi = excluded.hint_hi,
      hint_en = excluded.hint_en,
      marks = excluded.marks,
      negative_marks = excluded.negative_marks,
      status = excluded.status,
      content_hash = excluded.content_hash,
      version = questions.version + 1,
      updated_at = now()`,
    [
      id,
      data.subjectId,
      data.topicId || null,
      data.chapterId || null,
      data.catalogId || null,
      data.type,
      data.difficulty,
      data.promptHi.trim(),
      data.promptEn.trim(),
      data.passageHi,
      data.passageEn,
      JSON.stringify(data.options),
      JSON.stringify(data.correct),
      data.explanationHi.trim(),
      data.explanationEn.trim(),
      data.hintHi,
      data.hintEn,
      demo ? SOURCE_NOTE : "Staff entry",
      data.marks,
      data.negative,
      data.status,
      hash,
      demo,
    ],
  );
  return id;
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    guard(async () => {
      const sql = await getSql();
      await ensureSeed(sql);
      await requireStaff(sql, context.userId);
      const rows = await sql<{
        users: number;
        active: number;
        attempts: number;
        submitted: number;
        questions: number;
        quizzes: number;
        open_reports: number;
      }>`
        select
          (select count(*)::int from profiles) as users,
          (select count(distinct user_id)::int from attempts where started_at > now() - interval '7 days') as active,
          (select count(*)::int from attempts) as attempts,
          (select count(*)::int from attempts where status = 'submitted') as submitted,
          (select count(*)::int from questions) as questions,
          (select count(*)::int from quizzes) as quizzes,
          (select count(*)::int from reports where status = 'open') as open_reports
      `;
      const attempts = num(rows[0]?.attempts);
      const submitted = num(rows[0]?.submitted);
      return {
        users: num(rows[0]?.users),
        active: num(rows[0]?.active),
        attempts,
        submitted,
        completion: attempts > 0 ? round2((submitted / attempts) * 100) : 0,
        questions: num(rows[0]?.questions),
        quizzes: num(rows[0]?.quizzes),
        openReports: num(rows[0]?.open_reports),
      };
    }),
  );

const SearchInput = z.object({
  q: z.string().max(80).optional(),
  subjectId: blank,
  status: z.enum(["draft", "published", ""]).optional(),
  offset: z.number().int().min(0).max(500).optional(),
});

export const adminQuestions = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(SearchInput, data ?? {}))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const profile = await requireStaff(sql, context.userId);
      const q = data.q?.trim() ?? "";
      const like = q ? `%${q.replace(/[\\%_]/g, "")}%` : null;
      const rows = await sql.query<QuestionRow & { status: string }>(
        `select * from questions
         where ($1::text is null or prompt_hi ilike $1 or prompt_en ilike $1 or id ilike $1)
           and ($2::text is null or subject_id = $2)
           and ($3::text is null or status = $3)
         order by updated_at desc
         limit 30 offset $4`,
        [like, cleanId(data.subjectId), cleanId(data.status), data.offset ?? 0],
      );
      return {
        role: profile.role,
        questions: rows.map((row) => ({
          ...toPlay(row, undefined, true),
          chapterId: row.chapter_id,
          topicId: row.topic_id,
          catalogId: row.catalog_id,
          status: row.status,
          correct: strList(row.correct_answers),
          explanationHi: row.explanation_hi,
          explanationEn: row.explanation_en,
          marks: num(row.marks) || 1,
          negative: num(row.negative_marks),
        })),
      };
    }),
  );

export const adminSaveQuestion = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(QuestionInput, data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const profile = await requireStaff(sql, context.userId);
      const id = await writeQuestion(sql, data);
      await audit(sql, profile.userId, "save_question", "question", id);
      return { id };
    }),
  );

export const adminDeleteQuestion = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(z.object({ id: z.string().trim().min(1).max(80), confirm: z.literal("DELETE") }), data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const profile = await requireStaff(sql, context.userId);
      await sql`delete from quiz_questions where question_id = ${data.id}`;
      await sql`delete from bookmarks where question_id = ${data.id}`;
      const removed = await sql<{ id: string }>`delete from questions where id = ${data.id} returning id`;
      if (!removed[0]) fail("NOT_FOUND");
      await audit(sql, profile.userId, "delete_question", "question", data.id);
      return { ok: true };
    }),
  );

const QuizInput = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{0,80}$/).optional(),
  titleHi: z.string().trim().min(2).max(120),
  titleEn: z.string().trim().min(2).max(120),
  descriptionHi: z.string().max(600),
  descriptionEn: z.string().max(600),
  catalogId: z.string().trim().max(40).nullable(),
  subjectId: z.string().trim().max(40).nullable(),
  kind: z.enum(["practice", "quiz", "mock", "daily"]),
  durationMinutes: z.number().int().min(0).max(180).nullable(),
  negativeMarks: z.number().min(0).max(5),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  feedbackMode: z.enum(["immediate", "after_submit"]),
  status: z.enum(["draft", "published"]),
  questionIds: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
});

export const adminSaveQuiz = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(QuizInput, data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const profile = await requireStaff(sql, context.userId);
      const found = await sql.query<{ id: string }>(`select id from questions where id = any($1::text[])`, [data.questionIds]);
      if (found.length !== new Set(data.questionIds).size) fail("VALIDATION");
      const id = data.id?.trim() || `quiz-${randomUUID().slice(0, 8)}`;
      const seconds = data.durationMinutes && data.durationMinutes > 0 ? data.durationMinutes * 60 : null;
      await sql`
        insert into quizzes (
          id, title_hi, title_en, description_hi, description_en, catalog_id, subject_id, kind,
          duration_seconds, negative_marks, shuffle_questions, shuffle_options, feedback_mode, status, is_daily, is_demo
        ) values (
          ${id}, ${data.titleHi}, ${data.titleEn}, ${data.descriptionHi}, ${data.descriptionEn},
          ${data.catalogId || null}, ${data.subjectId || null}, ${data.kind}, ${seconds}, ${data.negativeMarks},
          ${data.shuffleQuestions}, ${data.shuffleOptions}, ${data.feedbackMode}, ${data.status},
          ${data.kind === "daily"}, false
        )
        on conflict (id) do update set
          title_hi = excluded.title_hi,
          title_en = excluded.title_en,
          description_hi = excluded.description_hi,
          description_en = excluded.description_en,
          catalog_id = excluded.catalog_id,
          subject_id = excluded.subject_id,
          kind = excluded.kind,
          duration_seconds = excluded.duration_seconds,
          negative_marks = excluded.negative_marks,
          shuffle_questions = excluded.shuffle_questions,
          shuffle_options = excluded.shuffle_options,
          feedback_mode = excluded.feedback_mode,
          status = excluded.status,
          is_daily = excluded.is_daily,
          updated_at = now()
      `;
      await sql`delete from quiz_questions where quiz_id = ${id}`;
      for (let i = 0; i < data.questionIds.length; i += 1) {
        await sql`
          insert into quiz_questions (quiz_id, question_id, sort_order)
          values (${id}, ${data.questionIds[i]}, ${i})
        `;
      }
      await audit(sql, profile.userId, "save_quiz", "quiz", id);
      return { id };
    }),
  );

export const adminListQuizzes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    guard(async () => {
      const sql = await getSql();
      await requireStaff(sql, context.userId);
      const rows = await sql<QuizRow & { question_ids: unknown }>`
        select q.*, (
          select coalesce(json_agg(qq.question_id order by qq.sort_order), '[]'::json)
          from quiz_questions qq where qq.quiz_id = q.id
        ) as question_ids,
        (select count(*)::int from quiz_questions qq where qq.quiz_id = q.id) as question_count
        from quizzes q
        order by q.updated_at desc
        limit 50
      `;
      return rows.map((row) => ({ ...mapQuiz(row), status: row.status, questionIds: strList(row.question_ids) }));
    }),
  );

export const adminSetQuizStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    parse(z.object({ id: z.string().trim().min(1).max(80), status: z.enum(["draft", "published"]) }), data),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const profile = await requireStaff(sql, context.userId);
      const updated = await sql`update quizzes set status = ${data.status}, updated_at = now() where id = ${data.id} returning id`;
      if (!updated[0]) fail("NOT_FOUND");
      await audit(sql, profile.userId, "set_quiz_status", "quiz", data.id);
      return { ok: true };
    }),
  );

export const adminUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    guard(async () => {
      const sql = await getSql();
      await requireAdmin(sql, context.userId);
      const rows = await sql<{ user_id: string; display_name: string; role: string; email: string; created_at: unknown }>`
        select p.user_id, p.display_name, p.role, u.email, p.created_at
        from profiles p
        join "user" u on u.id = p.user_id
        order by p.created_at desc
        limit 50
      `;
      return rows.map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        role: row.role,
        email: row.email,
        createdAt: iso(row.created_at),
        mine: row.user_id === context.userId,
      }));
    }),
  );

export const adminSetRole = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    parse(z.object({ userId: z.string().trim().min(1).max(80), role: z.enum(["student", "teacher", "admin"]) }), data),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const profile = await requireAdmin(sql, context.userId);
      if (data.userId === context.userId && data.role !== "admin") {
        const admins = await sql<{ n: number }>`select count(*)::int as n from profiles where role = 'admin'`;
        if (num(admins[0]?.n) <= 1) fail("LAST_ADMIN");
      }
      const updated = await sql`
        update profiles set role = ${data.role}, updated_at = now() where user_id = ${data.userId} returning user_id
      `;
      if (!updated[0]) fail("NOT_FOUND");
      await audit(sql, profile.userId, "set_role", "user", data.userId);
      return { ok: true };
    }),
  );

export const adminReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    guard(async () => {
      const sql = await getSql();
      await requireStaff(sql, context.userId);
      const rows = await sql<{
        id: string;
        content_type: string;
        content_id: string;
        reason: string;
        status: string;
        created_at: unknown;
        display_name: string;
      }>`
        select r.id, r.content_type, r.content_id, r.reason, r.status, r.created_at, p.display_name
        from reports r
        left join profiles p on p.user_id = r.user_id
        order by r.created_at desc
        limit 40
      `;
      return rows.map((row) => ({
        id: row.id,
        contentType: row.content_type,
        contentId: row.content_id,
        reason: row.reason,
        status: row.status,
        createdAt: iso(row.created_at),
        displayName: row.display_name || "Student",
      }));
    }),
  );

export const adminSetReport = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(z.object({ id: z.string().uuid(), status: z.enum(["open", "resolved"]) }), data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const profile = await requireStaff(sql, context.userId);
      await sql`update reports set status = ${data.status} where id = ${data.id}`;
      await audit(sql, profile.userId, "set_report", "report", data.id);
      return { ok: true };
    }),
  );

export const adminImport = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(z.object({ items: z.array(QuestionInput).max(50) }), data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      rateLimit(`import:${context.userId}`, 8, 60 * 60 * 1000);
      const sql = await getSql();
      const profile = await requireStaff(sql, context.userId);
      const errors: { index: number; message: string }[] = [];
      let created = 0;
      for (let index = 0; index < data.items.length; index += 1) {
        try {
          await writeQuestion(sql, data.items[index]!);
          created += 1;
        } catch (err) {
          const message = err instanceof Error && err.message === "DUPLICATE" ? "DUPLICATE" : "VALIDATION";
          errors.push({ index, message });
        }
      }
      await audit(sql, profile.userId, "import_questions", "question", String(created));
      return { created, errors };
    }),
  );

export const adminAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    guard(async () => {
      const sql = await getSql();
      await requireAdmin(sql, context.userId);
      const rows = await sql<{ id: string; action: string; resource_type: string; resource_id: string; created_at: unknown; display_name: string }>`
        select l.id, l.action, l.resource_type, l.resource_id, l.created_at, p.display_name
        from admin_audit_logs l
        left join profiles p on p.user_id = l.admin_uid
        order by l.created_at desc
        limit 40
      `;
      return rows.map((row) => ({
        id: row.id,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        createdAt: iso(row.created_at),
        displayName: row.display_name || "Admin",
      }));
    }),
  );

export const adminSaveSetting = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(z.object({ leaderboardEnabled: z.boolean() }), data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const profile = await requireAdmin(sql, context.userId);
      await sql`
        insert into app_settings (key, value) values ('leaderboard_enabled', ${JSON.stringify(data.leaderboardEnabled)}::jsonb)
        on conflict (key) do update set value = excluded.value
      `;
      await audit(sql, profile.userId, "leaderboard_setting", "settings", "leaderboard_enabled");
      return { ok: true };
    }),
  );

const TaxonInput = z.discriminatedUnion("entity", [
  z.object({
    entity: z.literal("catalog"),
    id: z.string().regex(/^[a-z0-9-]{2,40}$/),
    kind: z.enum(["class", "exam"]),
    nameHi: z.string().trim().min(1).max(60),
    nameEn: z.string().trim().min(1).max(60),
    sort: z.number().int().min(0).max(999),
  }),
  z.object({
    entity: z.literal("subject"),
    id: z.string().regex(/^[a-z0-9-]{2,40}$/),
    nameHi: z.string().trim().min(1).max(60),
    nameEn: z.string().trim().min(1).max(60),
  }),
  z.object({
    entity: z.literal("chapter"),
    id: z.string().regex(/^[a-z0-9-]{2,40}$/),
    subjectId: z.string().trim().min(1).max(40),
    catalogId: z.string().trim().max(40).nullable(),
    nameHi: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().min(1).max(80),
    sort: z.number().int().min(0).max(999),
  }),
  z.object({
    entity: z.literal("link"),
    subjectId: z.string().trim().min(1).max(40),
    catalogId: z.string().trim().min(1).max(40),
  }),
]);

export const adminSaveTaxonomy = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(TaxonInput, data))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    guard(async () => {
      const sql = await getSql();
      const profile = await requireStaff(sql, context.userId);
      if (data.entity === "catalog") {
        await sql`
          insert into catalogs (id, kind, name_hi, name_en, sort_order)
          values (${data.id}, ${data.kind}, ${data.nameHi}, ${data.nameEn}, ${data.sort})
          on conflict (id) do update set name_hi = excluded.name_hi, name_en = excluded.name_en, kind = excluded.kind, sort_order = excluded.sort_order
        `;
      } else if (data.entity === "subject") {
        await sql`
          insert into subjects (id, name_hi, name_en) values (${data.id}, ${data.nameHi}, ${data.nameEn})
          on conflict (id) do update set name_hi = excluded.name_hi, name_en = excluded.name_en
        `;
      } else if (data.entity === "chapter") {
        await sql`
          insert into chapters (id, subject_id, catalog_id, name_hi, name_en, sort_order)
          values (${data.id}, ${data.subjectId}, ${data.catalogId}, ${data.nameHi}, ${data.nameEn}, ${data.sort})
          on conflict (id) do update set
            name_hi = excluded.name_hi, name_en = excluded.name_en, subject_id = excluded.subject_id,
            catalog_id = excluded.catalog_id, sort_order = excluded.sort_order
        `;
      } else {
        await sql`
          insert into subject_catalogs (subject_id, catalog_id) values (${data.subjectId}, ${data.catalogId})
          on conflict do nothing
        `;
      }
      await audit(sql, profile.userId, "save_taxonomy", data.entity, "id" in data ? data.id : data.catalogId);
      return { ok: true };
    }),
  );
