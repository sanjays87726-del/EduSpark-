-- EduSpark-Quiz application schema. Authorization is enforced in server
-- functions (verified session user id). Answer keys live on attempts and are
-- never selected by student-facing reads.

create table if not exists profiles (
  user_id text primary key,
  display_name text not null default '',
  photo_url text,
  preferred_language text not null default 'hi',
  selected_class text,
  exam_targets jsonb not null default '[]'::jsonb,
  selected_subjects jsonb not null default '[]'::jsonb,
  role text not null default 'student',
  daily_goal integer not null default 10,
  show_on_leaderboard boolean not null default true,
  theme text not null default 'light',
  onboarding_done boolean not null default false,
  guardian_ack boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('student', 'teacher', 'admin')),
  constraint profiles_lang_check check (preferred_language in ('hi', 'en')),
  constraint profiles_goal_check check (daily_goal between 1 and 200)
);

create table if not exists catalogs (
  id text primary key,
  kind text not null,
  name_hi text not null,
  name_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  constraint catalogs_kind_check check (kind in ('class', 'exam'))
);

create table if not exists subjects (
  id text primary key,
  name_hi text not null,
  name_en text not null,
  is_active boolean not null default true
);

create table if not exists subject_catalogs (
  subject_id text not null references subjects (id) on delete cascade,
  catalog_id text not null references catalogs (id) on delete cascade,
  primary key (subject_id, catalog_id)
);

create table if not exists chapters (
  id text primary key,
  subject_id text not null references subjects (id) on delete cascade,
  catalog_id text references catalogs (id) on delete set null,
  name_hi text not null,
  name_en text not null,
  sort_order integer not null default 0
);

create table if not exists topics (
  id text primary key,
  chapter_id text not null references chapters (id) on delete cascade,
  subject_id text not null references subjects (id) on delete cascade,
  name_hi text not null,
  name_en text not null,
  sort_order integer not null default 0
);

create table if not exists questions (
  id text primary key,
  subject_id text not null references subjects (id),
  topic_id text references topics (id) on delete set null,
  chapter_id text references chapters (id) on delete set null,
  catalog_id text references catalogs (id) on delete set null,
  type text not null,
  difficulty text not null default 'medium',
  prompt_hi text not null,
  prompt_en text not null,
  passage_hi text,
  passage_en text,
  figure text,
  options jsonb not null default '[]'::jsonb,
  correct_answers jsonb not null default '[]'::jsonb,
  explanation_hi text not null default '',
  explanation_en text not null default '',
  hint_hi text,
  hint_en text,
  source_note text,
  marks double precision not null default 1,
  negative_marks double precision not null default 0,
  status text not null default 'published',
  content_hash text not null,
  is_demo boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_type_check check (type in ('mcq', 'multi', 'tf', 'fill', 'numerical', 'passage')),
  constraint questions_diff_check check (difficulty in ('easy', 'medium', 'hard')),
  constraint questions_status_check check (status in ('draft', 'published'))
);

create unique index if not exists questions_hash_idx on questions (content_hash);
create index if not exists questions_subject_idx on questions (subject_id, status);
create index if not exists questions_catalog_idx on questions (catalog_id, status);

create table if not exists quizzes (
  id text primary key,
  title_hi text not null,
  title_en text not null,
  description_hi text not null default '',
  description_en text not null default '',
  catalog_id text references catalogs (id) on delete set null,
  subject_id text references subjects (id) on delete set null,
  kind text not null default 'quiz',
  duration_seconds integer,
  negative_marks double precision not null default 0,
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  feedback_mode text not null default 'after_submit',
  status text not null default 'published',
  is_daily boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_kind_check check (kind in ('practice', 'quiz', 'mock', 'daily')),
  constraint quizzes_feedback_check check (feedback_mode in ('immediate', 'after_submit')),
  constraint quizzes_status_check check (status in ('draft', 'published'))
);

create index if not exists quizzes_status_idx on quizzes (status, kind);

create table if not exists quiz_questions (
  quiz_id text not null references quizzes (id) on delete cascade,
  question_id text not null references questions (id) on delete cascade,
  sort_order integer not null,
  primary key (quiz_id, question_id)
);

create table if not exists attempts (
  id text primary key,
  user_id text not null,
  quiz_id text,
  mode text not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  question_ids jsonb not null default '[]'::jsonb,
  option_orders jsonb not null default '{}'::jsonb,
  answer_key jsonb not null default '{}'::jsonb,
  breakdown jsonb not null default '{}'::jsonb,
  feedback_mode text not null default 'after_submit',
  negative_override double precision,
  title_hi text not null default '',
  title_en text not null default '',
  score double precision,
  maximum_score double precision,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  time_taken_seconds integer,
  counts_for_rank boolean not null default false,
  status text not null default 'in_progress',
  created_at timestamptz not null default now(),
  constraint attempts_status_check check (status in ('in_progress', 'submitted')),
  constraint attempts_mode_check check (mode in ('practice', 'quiz', 'mock', 'daily', 'revision'))
);

create index if not exists attempts_user_idx on attempts (user_id, status, started_at desc);
create index if not exists attempts_quiz_idx on attempts (quiz_id, status);
create unique index if not exists attempts_one_open
  on attempts (user_id, quiz_id)
  where status = 'in_progress' and quiz_id is not null;

create table if not exists bookmarks (
  user_id text not null,
  question_id text not null references questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists bookmarks_user_idx on bookmarks (user_id, created_at desc);

create table if not exists daily_activity (
  user_id text not null,
  activity_date date not null,
  quiz_count integer not null default 0,
  questions_attempted integer not null default 0,
  primary key (user_id, activity_date)
);

create index if not exists daily_activity_user_idx on daily_activity (user_id, activity_date desc);

create table if not exists achievements (
  id text primary key,
  name_hi text not null,
  name_en text not null,
  description_hi text not null,
  description_en text not null
);

create table if not exists user_achievements (
  user_id text not null,
  achievement_id text not null references achievements (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists reports (
  id text primary key,
  user_id text not null,
  content_type text not null,
  content_id text not null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_status_check check (status in ('open', 'resolved'))
);

create index if not exists reports_status_idx on reports (status, created_at desc);

create table if not exists admin_audit_logs (
  id text primary key,
  admin_uid text not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_idx on admin_audit_logs (created_at desc);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);

insert into achievements (id, name_hi, name_en, description_hi, description_en) values
  ('first_quiz', 'पहली शुरुआत', 'First step', 'पहली प्रश्नोत्तरी पूरी की।', 'Finished a first quiz.'),
  ('ten_correct', 'दस सही', 'Ten correct', 'कुल दस सही उत्तर।', 'Ten correct answers overall.'),
  ('perfect', 'शुद्ध अंक', 'Perfect paper', 'एक पूरी प्रश्नोत्तरी में सौ प्रतिशत।', 'Scored 100% on a finished quiz.'),
  ('mock_done', 'मॉक पूरा', 'Mock finished', 'पहली मॉक परीक्षा जमा की।', 'Submitted a first mock test.'),
  ('questions_100', 'सौ प्रश्न', 'Hundred questions', 'सौ प्रश्नों के उत्तर दिए।', 'Answered 100 questions.'),
  ('streak_3', 'तीन दिन', 'Three-day streak', 'लगातार तीन दिन अभ्यास।', 'Studied three days in a row.'),
  ('streak_5', 'पाँच दिन', 'Five-day streak', 'लगातार पाँच दिन अभ्यास।', 'Studied five days in a row.')
on conflict (id) do nothing;

insert into app_settings (key, value) values
  ('leaderboard_enabled', 'true'::jsonb)
on conflict (key) do nothing;
