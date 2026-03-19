-- CATWala Supabase Schema (Future Backend Upgrade)
-- Run this in your Supabase SQL editor when upgrading from localStorage to backend

-- Users table (handled by Supabase Auth, this is for extended profile)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  created_at timestamp with time zone default timezone('utc', now()),
  email text,
  display_name text
);

-- Test attempts
create table if not exists test_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  test_id integer not null,
  started_at timestamp with time zone default timezone('utc', now()),
  submitted_at timestamp with time zone,
  time_remaining_seconds integer,
  status text check (status in ('in_progress', 'submitted', 'reviewed')) default 'in_progress'
);

-- Per-question responses
create table if not exists question_responses (
  id uuid default gen_random_uuid() primary key,
  attempt_id uuid references test_attempts(id) on delete cascade,
  section text not null,
  question_id text not null,
  selected_option integer,       -- null for TITA or unattempted
  tita_answer numeric,           -- for TITA questions
  is_marked_for_review boolean default false,
  time_spent_seconds integer default 0
);

-- Scoring summary per attempt
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
  estimated_percentile numeric
);

-- RLS Policies (enable row-level security)
alter table profiles enable row level security;
alter table test_attempts enable row level security;
alter table question_responses enable row level security;
alter table attempt_scores enable row level security;

create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can view own attempts" on test_attempts for select using (auth.uid() = user_id);
create policy "Users can insert own attempts" on test_attempts for insert with check (auth.uid() = user_id);
create policy "Users can update own attempts" on test_attempts for update using (auth.uid() = user_id);
create policy "Users can view own responses" on question_responses for select using (
  attempt_id in (select id from test_attempts where user_id = auth.uid())
);
create policy "Users can insert own responses" on question_responses for insert with check (
  attempt_id in (select id from test_attempts where user_id = auth.uid())
);
create policy "Users can update own responses" on question_responses for update using (
  attempt_id in (select id from test_attempts where user_id = auth.uid())
);
create policy "Users can view own scores" on attempt_scores for select using (
  attempt_id in (select id from test_attempts where user_id = auth.uid())
);
create policy "Users can insert own scores" on attempt_scores for insert with check (
  attempt_id in (select id from test_attempts where user_id = auth.uid())
);
