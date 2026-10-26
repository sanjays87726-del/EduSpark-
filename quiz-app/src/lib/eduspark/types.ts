export type Lang = "hi" | "en";
export type Role = "student" | "teacher" | "admin";
export type ThemeChoice = "light" | "dark" | "system";
export type QuizKind = "practice" | "quiz" | "mock" | "daily" | "revision";

export type Profile = {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  email: string | null;
  preferredLanguage: Lang;
  selectedClass: string | null;
  examTargets: string[];
  selectedSubjects: string[];
  role: Role;
  dailyGoal: number;
  showOnLeaderboard: boolean;
  theme: ThemeChoice;
  onboardingDone: boolean;
  guardianAck: boolean;
  createdAt: string;
};

export type Catalog = {
  id: string;
  kind: "class" | "exam";
  nameHi: string;
  nameEn: string;
  sortOrder: number;
};

export type Subject = { id: string; nameHi: string; nameEn: string };
export type SubjectLink = { subjectId: string; catalogId: string };
export type Chapter = {
  id: string;
  subjectId: string;
  catalogId: string | null;
  nameHi: string;
  nameEn: string;
  sortOrder: number;
};
export type Topic = {
  id: string;
  chapterId: string;
  subjectId: string;
  nameHi: string;
  nameEn: string;
  sortOrder: number;
};

export type QuizCard = {
  id: string;
  titleHi: string;
  titleEn: string;
  descriptionHi: string;
  descriptionEn: string;
  catalogId: string | null;
  subjectId: string | null;
  kind: string;
  durationSeconds: number | null;
  negativeMarks: number;
  feedbackMode: "immediate" | "after_submit";
  isDaily: boolean;
  isDemo: boolean;
  questionCount: number;
};

export type PlayOption = { id: string; hi: string; en: string };

export type PlayQuestion = {
  id: string;
  type: string;
  difficulty: string;
  promptHi: string;
  promptEn: string;
  passageHi: string | null;
  passageEn: string | null;
  figure: string | null;
  options: PlayOption[];
  marks: number;
  negativeMarks: number;
  subjectId: string;
  hintHi: string | null;
  hintEn: string | null;
};

export type AnswerState = { choice: string[]; review: boolean; revealed: boolean };

export type Reveal = {
  correct: boolean;
  correctAnswers: string[];
  explanationHi: string;
  explanationEn: string;
};

export type LiveAttempt = {
  state: "live";
  attemptId: string;
  quizId: string | null;
  mode: string;
  titleHi: string;
  titleEn: string;
  feedbackMode: "immediate" | "after_submit";
  deadlineAt: string | null;
  serverNow: string;
  questions: PlayQuestion[];
  answers: Record<string, AnswerState>;
  reveals: Record<string, Reveal>;
};

export type AttemptPointer = { state: "submitted"; attemptId: string; alreadyDone?: boolean };

export type ResultQuestion = PlayQuestion & {
  status: "correct" | "incorrect" | "unanswered";
  awarded: number;
  yourChoice: string[];
  correctAnswers: string[];
  explanationHi: string;
  explanationEn: string;
};

export type QuizResult = {
  attemptId: string;
  quizId: string | null;
  mode: string;
  titleHi: string;
  titleEn: string;
  score: number;
  maximumScore: number;
  percentage: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  timeTakenSeconds: number;
  submittedAt: string;
  questions: ResultQuestion[];
  subjects: { subjectId: string; correct: number; incorrect: number; unanswered: number }[];
  newAchievements: string[];
};

export type DashboardData = {
  profile: Profile;
  stats: {
    answered: number;
    correct: number;
    incorrect: number;
    accuracy: number;
    mocks: number;
    quizzesDone: number;
    streak: number;
    bookmarks: number;
    todayAnswered: number;
  };
  continueAttempt: {
    id: string;
    titleHi: string;
    titleEn: string;
    mode: string;
    deadlineAt: string | null;
  } | null;
  recent: RecentAttempt[];
  recommended: QuizCard[];
  daily: { quiz: QuizCard; doneToday: boolean; attemptId: string | null } | null;
  subjects: SubjectStat[];
  achievements: AchievementBadge[];
  activity: { date: string; questions: number }[];
};

export type RecentAttempt = {
  id: string;
  titleHi: string;
  titleEn: string;
  mode: string;
  score: number;
  maximumScore: number;
  percentage: number;
  submittedAt: string;
};

export type SubjectStat = {
  subjectId: string;
  nameHi: string;
  nameEn: string;
  correct: number;
  incorrect: number;
};

export type AchievementBadge = {
  id: string;
  nameHi: string;
  nameEn: string;
  descriptionHi: string;
  descriptionEn: string;
  awardedAt: string | null;
};

export type LeaderRow = {
  rank: number;
  displayName: string;
  points: number;
  accuracy: number;
  mine: boolean;
};

export type BookmarkItem = {
  questionId: string;
  promptHi: string;
  promptEn: string;
  subjectId: string;
  difficulty: string;
  createdAt: string;
};
