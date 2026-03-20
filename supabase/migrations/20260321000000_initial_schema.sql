-- ============================================
-- CATwala Complete Backend Schema
-- ============================================

-- 1. Tests
create table if not exists tests (
  id integer primary key,
  title text not null,
  description text,
  total_questions integer not null default 68,
  varc_questions integer not null default 24,
  dilr_questions integer not null default 22,
  qa_questions integer not null default 22,
  duration_minutes integer not null default 120,
  section_duration_minutes integer not null default 40,
  is_active boolean default true,
  created_at timestamptz default timezone('utc', now()),
  sort_order integer not null default 0
);

-- 2. Profiles
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  created_at timestamptz default timezone('utc', now()),
  email text,
  display_name text,
  avatar_url text,
  target_percentile numeric,
  preferred_section text,
  total_tests_taken integer default 0,
  updated_at timestamptz default timezone('utc', now())
);

-- 3. Questions
create table if not exists questions (
  id text primary key,
  test_id integer not null references tests(id) on delete cascade,
  section text not null check (section in ('VARC', 'DILR', 'QA')),
  question_type text not null check (question_type in ('MCQ', 'TITA', 'RC')),
  question_order integer not null,
  passage text,
  passage_id text,
  question_text text not null,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text not null,
  solution text,
  concept_tag text,
  topic text,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')),
  created_at timestamptz default timezone('utc', now())
);

create index if not exists idx_questions_test_id on questions(test_id);
create index if not exists idx_questions_test_section on questions(test_id, section);

-- 4. Test Attempts
create table if not exists test_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  test_id integer not null references tests(id),
  started_at timestamptz default timezone('utc', now()),
  submitted_at timestamptz,
  current_section text default 'VARC' check (current_section in ('VARC', 'DILR', 'QA')),
  current_question_index integer default 0,
  varc_time_remaining integer default 2400,
  dilr_time_remaining integer default 2400,
  qa_time_remaining integer default 2400,
  status text check (status in ('in_progress', 'submitted', 'reviewed')) default 'in_progress'
);

create unique index if not exists idx_one_active_attempt
  on test_attempts(user_id, test_id) where status = 'in_progress';

-- 5. Question Responses
create table if not exists question_responses (
  id uuid default gen_random_uuid() primary key,
  attempt_id uuid references test_attempts(id) on delete cascade not null,
  question_id text not null references questions(id),
  section text not null check (section in ('VARC', 'DILR', 'QA')),
  selected_option text,
  tita_answer text,
  is_marked_for_review boolean default false,
  status text default 'not_visited' check (
    status in ('not_visited', 'not_answered', 'answered', 'marked', 'answered_marked')
  ),
  time_spent_seconds integer default 0,
  constraint unique_question_per_attempt unique (attempt_id, question_id)
);

create index if not exists idx_responses_attempt on question_responses(attempt_id);

-- 6. Attempt Scores
create table if not exists attempt_scores (
  attempt_id uuid references test_attempts(id) on delete cascade primary key,
  varc_score numeric,
  dilr_score numeric,
  qa_score numeric,
  total_score numeric,
  varc_attempted integer,
  dilr_attempted integer,
  qa_attempted integer,
  varc_correct integer,
  dilr_correct integer,
  qa_correct integer,
  varc_wrong integer,
  dilr_wrong integer,
  qa_wrong integer,
  varc_unattempted integer,
  dilr_unattempted integer,
  qa_unattempted integer,
  estimated_percentile numeric,
  created_at timestamptz default timezone('utc', now())
);

-- 7. Test Unlocks
create table if not exists test_unlocks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  test_id integer not null references tests(id),
  unlocked_at timestamptz default timezone('utc', now()),
  constraint unique_user_test_unlock unique (user_id, test_id)
);

-- ============================================
-- RLS Policies
-- ============================================

alter table profiles enable row level security;
alter table tests enable row level security;
alter table questions enable row level security;
alter table test_attempts enable row level security;
alter table question_responses enable row level security;
alter table attempt_scores enable row level security;
alter table test_unlocks enable row level security;

-- Profiles
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Tests (public read for authenticated)
create policy "Authenticated users can view tests" on tests for select using (auth.role() = 'authenticated');

-- Questions: NO direct user access (Edge Functions use service_role to bypass RLS)

-- Test Attempts
create policy "Users can view own attempts" on test_attempts for select using (auth.uid() = user_id);
create policy "Users can insert own attempts" on test_attempts for insert with check (auth.uid() = user_id);
create policy "Users can update own attempts" on test_attempts for update using (auth.uid() = user_id);

-- Question Responses
create policy "Users can view own responses" on question_responses for select using (
  attempt_id in (select id from test_attempts where user_id = auth.uid())
);
create policy "Users can insert own responses" on question_responses for insert with check (
  attempt_id in (select id from test_attempts where user_id = auth.uid())
);
create policy "Users can update own responses" on question_responses for update using (
  attempt_id in (select id from test_attempts where user_id = auth.uid())
);

-- Attempt Scores (read-only for users)
create policy "Users can view own scores" on attempt_scores for select using (
  attempt_id in (select id from test_attempts where user_id = auth.uid())
);

-- Test Unlocks (read-only for users)
create policy "Users can view own unlocks" on test_unlocks for select using (auth.uid() = user_id);

-- ============================================
-- Functions & Triggers
-- ============================================

-- Auto-create profile + unlock test 1 on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  insert into public.test_unlocks (user_id, test_id) values (new.id, 1);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Increment tests taken counter
create or replace function increment_tests_taken(uid uuid)
returns void as $$
begin
  update profiles
  set total_tests_taken = total_tests_taken + 1,
      updated_at = timezone('utc', now())
  where id = uid;
end;
$$ language plpgsql security definer;

-- Safe questions view (no answers/solutions)
create or replace view questions_safe as
select
  id, test_id, section, question_type, question_order,
  passage, passage_id, question_text,
  option_a, option_b, option_c, option_d,
  concept_tag, topic, difficulty
from questions;
