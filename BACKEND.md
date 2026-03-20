# CATwala Backend Architecture

## 1. Overview

CATwala is a CAT (MBA entrance exam) mock test platform. The current implementation is fully client-side: React + Vite with all test data (including correct answers) stored in JSON files shipped to the browser, and user progress persisted via localStorage.

**The problem:** Anyone can open DevTools and view correct answers from the bundled JSON files. Scoring is done client-side, so results can be manipulated. There is no user authentication, no cross-device sync, and no analytics.

**The solution:** Move to a Supabase backend that:
- Stores questions in PostgreSQL (answers never sent to the frontend during a test)
- Validates answers and calculates scores server-side via Edge Functions
- Provides authentication (email + Google OAuth)
- Enables cross-device progress sync, leaderboards, and analytics

**Tech stack:** Supabase free tier (Auth, PostgreSQL, Edge Functions, Storage)

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    React + Vite Frontend                │
│                                                         │
│  Home ── Instructions ── Test ── Results ── Review      │
│                          │         │          │         │
│              auto-save   │   submit │    review │        │
└──────────────────────────┼─────────┼──────────┼─────────┘
                           │         │          │
                    ───────▼─────────▼──────────▼──────
                    │        Supabase Platform         │
                    │                                  │
                    │  ┌──────────┐  ┌──────────────┐  │
                    │  │   Auth   │  │ Edge Functions│  │
                    │  │ (email/  │  │              │  │
                    │  │  Google) │  │ get-questions │  │
                    │  └──────────┘  │ check-answer  │  │
                    │                │ submit-test   │  │
                    │  ┌──────────┐  │ save-progress │  │
                    │  │ PostgREST│  └──────────────┘  │
                    │  │ (auto    │                    │
                    │  │  REST    │  ┌──────────────┐  │
                    │  │  API)    │  │  PostgreSQL   │  │
                    │  └──────────┘  │              │  │
                    │                │ profiles      │  │
                    │                │ tests         │  │
                    │                │ questions     │  │
                    │                │ test_attempts  │  │
                    │                │ question_resp  │  │
                    │                │ attempt_scores │  │
                    │                │ test_unlocks   │  │
                    │                └──────────────┘  │
                    ────────────────────────────────────
```

**Data flow during a test:**
1. User authenticates via Supabase Auth
2. Frontend calls `get-questions` Edge Function -- receives questions WITHOUT `correct_answer` or `solution`
3. User answers questions; frontend auto-saves progress every 10s via PostgREST (direct DB insert/update with RLS)
4. On submit, frontend calls `submit-test` Edge Function which:
   - Reads correct answers from DB (server-side only)
   - Calculates score with proper MCQ/TITA rules
   - Writes to `attempt_scores`
   - Returns results to frontend
5. On review, frontend calls `get-review` which returns questions WITH solutions (only for submitted attempts)

---

## 3. Supabase Setup

### Project Configuration

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Note down: Project URL, `anon` key, `service_role` key
3. Enable Google OAuth in Authentication > Providers
4. Set Site URL to your deployed frontend URL

### Environment Variables

Frontend `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

Edge Functions environment (set in Supabase Dashboard > Edge Functions > Secrets):
```
SUPABASE_URL        # auto-available
SUPABASE_ANON_KEY   # auto-available
SUPABASE_SERVICE_ROLE_KEY  # auto-available
```

### Supabase Client (Frontend)

Create `src/lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

---

## 4. Authentication

### Supabase Auth Setup

**Supported providers:** Email/password + Google OAuth

**Auth flow:**
1. User signs up or logs in
2. Supabase issues a JWT (stored in browser automatically by `@supabase/supabase-js`)
3. All subsequent API calls include this JWT
4. RLS policies use `auth.uid()` to enforce row-level access

### Profile Creation Trigger

Auto-create a profile row when a user signs up:

```sql
-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### Frontend Auth Usage

```js
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
})

// Sign in with email
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword',
})

// Sign in with Google
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
})

// Sign out
await supabase.auth.signOut()

// Get current user
const { data: { user } } = await supabase.auth.getUser()
```

---

## 5. Database Schema

The schema below enhances the existing `docs/schema.sql`. New tables are `tests`, `questions`, and `test_unlocks`. Existing tables get minor additions.

### 5.1 Profiles (enhanced)

```sql
-- Drop existing and recreate with enhancements
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  created_at timestamptz default timezone('utc', now()),
  email text,
  display_name text,
  avatar_url text,
  target_percentile numeric,           -- user's target (e.g. 99.0)
  preferred_section text,              -- 'VARC', 'DILR', 'QA'
  total_tests_taken integer default 0,
  updated_at timestamptz default timezone('utc', now())
);
```

### 5.2 Tests (new)

Store test metadata in the database instead of relying on hardcoded `TOTAL_TESTS = 12`.

```sql
create table if not exists tests (
  id integer primary key,              -- 1, 2, 3, ... matches testId
  title text not null,                 -- 'Mock Test 1'
  description text,
  total_questions integer not null default 68,
  varc_questions integer not null default 24,
  dilr_questions integer not null default 22,
  qa_questions integer not null default 22,
  duration_minutes integer not null default 120,
  section_duration_minutes integer not null default 40,
  is_active boolean default true,      -- can disable tests
  created_at timestamptz default timezone('utc', now()),
  sort_order integer not null default 0
);
```

### 5.3 Questions (new -- CRITICAL)

Move questions from JSON files into the database. This is the single most important security improvement.

```sql
create table if not exists questions (
  id text primary key,                 -- 'varc_1', 'dilr_5', 'qa_12' etc.
  test_id integer not null references tests(id) on delete cascade,
  section text not null check (section in ('VARC', 'DILR', 'QA')),
  question_type text not null check (question_type in ('MCQ', 'TITA', 'RC')),
  question_order integer not null,     -- display order within section
  passage text,                        -- for RC questions
  passage_id text,                     -- groups RC questions under same passage
  question_text text not null,
  option_a text,                       -- null for TITA
  option_b text,
  option_c text,
  option_d text,
  correct_answer text not null,        -- NEVER sent to frontend during test
  solution text,                       -- NEVER sent to frontend during test
  concept_tag text,
  topic text,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')),
  created_at timestamptz default timezone('utc', now())
);

-- Index for fast question lookups by test
create index idx_questions_test_id on questions(test_id);
create index idx_questions_test_section on questions(test_id, section);
```

### 5.4 Test Attempts (from existing schema, enhanced)

```sql
create table if not exists test_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  test_id integer not null references tests(id),
  started_at timestamptz default timezone('utc', now()),
  submitted_at timestamptz,
  current_section text default 'VARC' check (current_section in ('VARC', 'DILR', 'QA')),
  current_question_index integer default 0,
  varc_time_remaining integer default 2400,    -- seconds
  dilr_time_remaining integer default 2400,
  qa_time_remaining integer default 2400,
  status text check (status in ('in_progress', 'submitted', 'reviewed')) default 'in_progress',

  -- Prevent multiple in-progress attempts for same test
  constraint unique_in_progress unique (user_id, test_id, status)
    -- Note: this constraint allows multiple 'submitted' rows (retakes)
    -- We handle this with a partial unique index instead (see below)
);

-- Only one in-progress attempt per user per test
create unique index idx_one_active_attempt
  on test_attempts(user_id, test_id)
  where status = 'in_progress';
```

**Change from existing schema:** Added `current_section`, `current_question_index`, `varc/dilr/qa_time_remaining` fields to support server-side session state (replacing localStorage session). Added `references tests(id)`.

### 5.5 Question Responses (from existing schema, enhanced)

```sql
create table if not exists question_responses (
  id uuid default gen_random_uuid() primary key,
  attempt_id uuid references test_attempts(id) on delete cascade not null,
  question_id text not null references questions(id),
  section text not null check (section in ('VARC', 'DILR', 'QA')),
  selected_option text,               -- 'A','B','C','D' for MCQ, null for unattempted
  tita_answer text,                    -- free text for TITA questions
  is_marked_for_review boolean default false,
  status text default 'not_visited' check (
    status in ('not_visited', 'not_answered', 'answered', 'marked', 'answered_marked')
  ),
  time_spent_seconds integer default 0,

  -- One response per question per attempt
  constraint unique_question_per_attempt unique (attempt_id, question_id)
);

create index idx_responses_attempt on question_responses(attempt_id);
```

**Changes from existing schema:** Changed `selected_option` from integer to text (to store 'A'/'B'/'C'/'D' matching the JSON format). Added `status` field matching frontend answer states. Added foreign key to `questions`. Added unique constraint. Changed `tita_answer` from numeric to text for flexibility.

### 5.6 Attempt Scores (from existing schema, unchanged)

```sql
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
```

**Enhancement from existing:** Added `_wrong` and `_unattempted` breakdowns per section, plus `created_at`.

### 5.7 Test Unlocks (new)

Replace `catwala_unlocks` localStorage with a proper per-user table.

```sql
create table if not exists test_unlocks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  test_id integer not null references tests(id),
  unlocked_at timestamptz default timezone('utc', now()),
  constraint unique_user_test_unlock unique (user_id, test_id)
);

-- Auto-unlock test 1 for all users via the profile creation trigger (updated):
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  -- Auto-unlock test 1
  insert into public.test_unlocks (user_id, test_id)
  values (new.id, 1);
  return new;
end;
$$ language plpgsql security definer;
```

### 5.8 RLS Policies

```sql
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table tests enable row level security;
alter table questions enable row level security;
alter table test_attempts enable row level security;
alter table question_responses enable row level security;
alter table attempt_scores enable row level security;
alter table test_unlocks enable row level security;

-- PROFILES
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- TESTS (read-only for all authenticated users)
create policy "Authenticated users can view tests"
  on tests for select using (auth.role() = 'authenticated');

-- QUESTIONS
-- No direct select policy for regular users!
-- Questions are served through Edge Functions only (get-questions strips answers).
-- The service_role key (used by Edge Functions) bypasses RLS.
-- If you want to allow direct read for non-sensitive fields, use a view instead.

-- TEST ATTEMPTS
create policy "Users can view own attempts"
  on test_attempts for select using (auth.uid() = user_id);
create policy "Users can insert own attempts"
  on test_attempts for insert with check (auth.uid() = user_id);
create policy "Users can update own attempts"
  on test_attempts for update using (auth.uid() = user_id);

-- QUESTION RESPONSES
create policy "Users can view own responses"
  on question_responses for select using (
    attempt_id in (select id from test_attempts where user_id = auth.uid())
  );
create policy "Users can insert own responses"
  on question_responses for insert with check (
    attempt_id in (select id from test_attempts where user_id = auth.uid())
  );
create policy "Users can update own responses"
  on question_responses for update using (
    attempt_id in (select id from test_attempts where user_id = auth.uid())
  );

-- ATTEMPT SCORES (read-only for users; only Edge Functions write scores)
create policy "Users can view own scores"
  on attempt_scores for select using (
    attempt_id in (select id from test_attempts where user_id = auth.uid())
  );
-- No insert/update policy for users -- scores are written by submit-test Edge Function
-- using the service_role key which bypasses RLS

-- TEST UNLOCKS
create policy "Users can view own unlocks"
  on test_unlocks for select using (auth.uid() = user_id);
-- No insert/update policy for users -- unlocks are managed server-side
```

### 5.9 Database View for Safe Question Access

A view that strips sensitive fields, usable by the frontend via PostgREST if needed:

```sql
create or replace view questions_safe as
select
  id, test_id, section, question_type, question_order,
  passage, passage_id, question_text,
  option_a, option_b, option_c, option_d,
  concept_tag, topic, difficulty
from questions;

-- Note: correct_answer and solution are excluded
```

---

## 6. Edge Functions

All Edge Functions use Deno (Supabase's runtime). They run server-side and use the `service_role` key to bypass RLS when needed.

### 6.1 `get-questions`

Serves test questions to the frontend WITHOUT correct answers or solutions.

```ts
// supabase/functions/get-questions/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { testId } = await req.json()

    // Check if user has this test unlocked
    const { data: unlock } = await supabase
      .from('test_unlocks')
      .select('id')
      .eq('user_id', user.id)
      .eq('test_id', testId)
      .single()

    if (!unlock) {
      return new Response(JSON.stringify({ error: 'Test not unlocked' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch questions WITHOUT correct_answer and solution
    const { data: questions, error } = await supabase
      .from('questions')
      .select(`
        id, test_id, section, question_type, question_order,
        passage, passage_id, question_text,
        option_a, option_b, option_c, option_d,
        concept_tag, topic, difficulty
      `)
      .eq('test_id', testId)
      .order('question_order')

    if (error) throw error

    // Group by section
    const sections = {
      VARC: { questions: questions.filter(q => q.section === 'VARC') },
      DILR: { questions: questions.filter(q => q.section === 'DILR') },
      QA:   { questions: questions.filter(q => q.section === 'QA') },
    }

    return new Response(JSON.stringify({ testId, sections }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### 6.2 `submit-test`

Server-side score calculation. The frontend sends the attempt ID; the backend reads responses from DB, compares against correct answers, and writes the score.

```ts
// supabase/functions/submit-test/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Percentile lookup table (matches src/utils/percentile.js)
const PERCENTILE_TABLE = [
  { minScore: 190, percentile: 99.9 },
  { minScore: 175, percentile: 99.5 },
  { minScore: 160, percentile: 99.0 },
  { minScore: 148, percentile: 98.0 },
  { minScore: 135, percentile: 97.0 },
  { minScore: 122, percentile: 95.0 },
  { minScore: 110, percentile: 92.0 },
  { minScore: 98,  percentile: 90.0 },
  { minScore: 85,  percentile: 85.0 },
  { minScore: 72,  percentile: 80.0 },
  { minScore: 60,  percentile: 75.0 },
  { minScore: 48,  percentile: 70.0 },
  { minScore: 36,  percentile: 60.0 },
  { minScore: 24,  percentile: 50.0 },
  { minScore: 12,  percentile: 40.0 },
  { minScore: 0,   percentile: 25.0 },
  { minScore: -Infinity, percentile: 10.0 },
]

function getPercentile(score: number): number {
  for (let i = 0; i < PERCENTILE_TABLE.length; i++) {
    if (score >= PERCENTILE_TABLE[i].minScore) {
      if (i === 0) return PERCENTILE_TABLE[0].percentile
      const upper = PERCENTILE_TABLE[i - 1]
      const lower = PERCENTILE_TABLE[i]
      const range = upper.minScore - lower.minScore
      const diff = score - lower.minScore
      const pctRange = upper.percentile - lower.percentile
      return Math.round((lower.percentile + (diff / range) * pctRange) * 100) / 100
    }
  }
  return 10.0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { attemptId } = await req.json()

    // Verify attempt belongs to user and is in_progress
    const { data: attempt, error: attemptErr } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single()

    if (attemptErr || !attempt) {
      return new Response(JSON.stringify({ error: 'Attempt not found or already submitted' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch all responses for this attempt
    const { data: responses } = await supabase
      .from('question_responses')
      .select('question_id, selected_option, tita_answer, section')
      .eq('attempt_id', attemptId)

    // Fetch correct answers from questions table (server-side only!)
    const { data: questions } = await supabase
      .from('questions')
      .select('id, section, question_type, correct_answer')
      .eq('test_id', attempt.test_id)

    // Build response lookup
    const responseMap = new Map(
      (responses || []).map(r => [r.question_id, r])
    )

    // Calculate scores
    const sectionScores = { VARC: 0, DILR: 0, QA: 0 }
    const sectionStats = {
      VARC: { correct: 0, wrong: 0, unattempted: 0, attempted: 0 },
      DILR: { correct: 0, wrong: 0, unattempted: 0, attempted: 0 },
      QA:   { correct: 0, wrong: 0, unattempted: 0, attempted: 0 },
    }

    for (const q of (questions || [])) {
      const resp = responseMap.get(q.id)
      const section = q.section as keyof typeof sectionScores
      const isTITA = q.question_type === 'TITA'

      // Determine user's answer
      const userAnswer = isTITA
        ? resp?.tita_answer?.trim().toLowerCase()
        : resp?.selected_option?.trim().toLowerCase()

      if (!userAnswer || userAnswer === '') {
        sectionStats[section].unattempted += 1
        continue
      }

      sectionStats[section].attempted += 1
      const isCorrect = userAnswer === q.correct_answer.trim().toLowerCase()

      if (isCorrect) {
        sectionScores[section] += 3
        sectionStats[section].correct += 1
      } else {
        const penalty = isTITA ? 0 : -1
        sectionScores[section] += penalty
        sectionStats[section].wrong += 1
      }
    }

    const totalScore = sectionScores.VARC + sectionScores.DILR + sectionScores.QA
    const percentile = getPercentile(totalScore)

    // Write score
    const { error: scoreErr } = await supabase
      .from('attempt_scores')
      .upsert({
        attempt_id: attemptId,
        varc_score: sectionScores.VARC,
        dilr_score: sectionScores.DILR,
        qa_score: sectionScores.QA,
        total_score: totalScore,
        varc_attempted: sectionStats.VARC.attempted,
        dilr_attempted: sectionStats.DILR.attempted,
        qa_attempted: sectionStats.QA.attempted,
        varc_correct: sectionStats.VARC.correct,
        dilr_correct: sectionStats.DILR.correct,
        qa_correct: sectionStats.QA.correct,
        varc_wrong: sectionStats.VARC.wrong,
        dilr_wrong: sectionStats.DILR.wrong,
        qa_wrong: sectionStats.QA.wrong,
        varc_unattempted: sectionStats.VARC.unattempted,
        dilr_unattempted: sectionStats.DILR.unattempted,
        qa_unattempted: sectionStats.QA.unattempted,
        estimated_percentile: percentile,
      })

    if (scoreErr) throw scoreErr

    // Mark attempt as submitted
    const now = new Date().toISOString()
    await supabase
      .from('test_attempts')
      .update({ status: 'submitted', submitted_at: now })
      .eq('id', attemptId)

    // Unlock next test
    const nextTestId = attempt.test_id + 1
    const { data: nextTest } = await supabase
      .from('tests')
      .select('id')
      .eq('id', nextTestId)
      .single()

    if (nextTest) {
      await supabase
        .from('test_unlocks')
        .upsert(
          { user_id: user.id, test_id: nextTestId },
          { onConflict: 'user_id,test_id' }
        )
    }

    // Update profile stats
    await supabase.rpc('increment_tests_taken', { uid: user.id })

    // Return results
    const result = {
      testId: attempt.test_id,
      submittedAt: now,
      score: {
        total: totalScore,
        varc: sectionScores.VARC,
        dilr: sectionScores.DILR,
        qa: sectionScores.QA,
        varcStats: sectionStats.VARC,
        dilrStats: sectionStats.DILR,
        qaStats: sectionStats.QA,
        correct: sectionStats.VARC.correct + sectionStats.DILR.correct + sectionStats.QA.correct,
        wrong: sectionStats.VARC.wrong + sectionStats.DILR.wrong + sectionStats.QA.wrong,
        unattempted: sectionStats.VARC.unattempted + sectionStats.DILR.unattempted + sectionStats.QA.unattempted,
      },
      percentile,
      timings: {
        varc: 2400 - (attempt.varc_time_remaining || 0),
        dilr: 2400 - (attempt.dilr_time_remaining || 0),
        qa: 2400 - (attempt.qa_time_remaining || 0),
      },
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

**Helper RPC for profile stats:**

```sql
create or replace function increment_tests_taken(uid uuid)
returns void as $$
begin
  update profiles
  set total_tests_taken = total_tests_taken + 1,
      updated_at = timezone('utc', now())
  where id = uid;
end;
$$ language plpgsql security definer;
```

### 6.3 `get-review`

Returns questions WITH correct answers and solutions, but only for submitted attempts.

```ts
// supabase/functions/get-review/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { attemptId } = await req.json()

    // Verify attempt belongs to user AND is submitted
    const { data: attempt } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .in('status', ['submitted', 'reviewed'])
      .single()

    if (!attempt) {
      return new Response(JSON.stringify({ error: 'Attempt not found or not yet submitted' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch full questions INCLUDING correct_answer and solution
    const { data: questions } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', attempt.test_id)
      .order('question_order')

    // Fetch user's responses
    const { data: responses } = await supabase
      .from('question_responses')
      .select('*')
      .eq('attempt_id', attemptId)

    const responseMap = new Map(
      (responses || []).map(r => [r.question_id, r])
    )

    // Merge questions with user responses
    const reviewData = (questions || []).map(q => ({
      ...q,
      userResponse: responseMap.get(q.id) || null,
    }))

    // Mark as reviewed
    await supabase
      .from('test_attempts')
      .update({ status: 'reviewed' })
      .eq('id', attemptId)

    return new Response(JSON.stringify({ questions: reviewData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

## 7. API Endpoints

### Auth (Supabase Auth SDK -- no custom endpoints needed)

| Action | Method | SDK Call |
|--------|--------|---------|
| Sign up (email) | -- | `supabase.auth.signUp({ email, password })` |
| Log in (email) | -- | `supabase.auth.signInWithPassword({ email, password })` |
| Log in (Google) | -- | `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| Log out | -- | `supabase.auth.signOut()` |
| Get session | -- | `supabase.auth.getSession()` |
| Password reset | -- | `supabase.auth.resetPasswordForEmail(email)` |

### User Profile (PostgREST -- direct table access via RLS)

| Action | Method | Call |
|--------|--------|------|
| Get profile | SELECT | `supabase.from('profiles').select('*').eq('id', userId).single()` |
| Update profile | UPDATE | `supabase.from('profiles').update({ display_name }).eq('id', userId)` |

### Tests (PostgREST + Edge Functions)

| Action | Method | Call |
|--------|--------|------|
| List all tests | SELECT | `supabase.from('tests').select('*').eq('is_active', true).order('sort_order')` |
| Get user's unlocks | SELECT | `supabase.from('test_unlocks').select('test_id').eq('user_id', userId)` |
| Get questions (safe) | Edge Function | `supabase.functions.invoke('get-questions', { body: { testId } })` |

### Test Attempts (PostgREST + Edge Functions)

| Action | Method | Call |
|--------|--------|------|
| Create attempt | INSERT | `supabase.from('test_attempts').insert({ user_id, test_id }).select().single()` |
| Save progress (auto-save) | UPSERT | `supabase.from('test_attempts').update({ current_section, current_question_index, varc_time_remaining, ... }).eq('id', attemptId)` |
| Save responses (auto-save) | UPSERT | `supabase.from('question_responses').upsert(responses, { onConflict: 'attempt_id,question_id' })` |
| Submit test | Edge Function | `supabase.functions.invoke('submit-test', { body: { attemptId } })` |
| Resume attempt | SELECT | `supabase.from('test_attempts').select('*').eq('user_id', userId).eq('test_id', testId).eq('status', 'in_progress').single()` |

### Results (PostgREST + Edge Functions)

| Action | Method | Call |
|--------|--------|------|
| Get score | SELECT | `supabase.from('attempt_scores').select('*').eq('attempt_id', attemptId).single()` |
| Get review data | Edge Function | `supabase.functions.invoke('get-review', { body: { attemptId } })` |
| Get attempt history | SELECT | `supabase.from('test_attempts').select('*, attempt_scores(*)').eq('user_id', userId).eq('status', 'submitted')` |

---

## 8. Migration Plan

### Step 1: Set Up Supabase Project

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize in project root
cd /Users/pranav/Documents/My\ Stuff/CATwala
supabase init

# Link to your remote project
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 2: Run Schema Migrations

Create migration files:

```bash
supabase migration new initial_schema
```

Copy the full schema SQL from Section 5 into `supabase/migrations/YYYYMMDDHHMMSS_initial_schema.sql`, then:

```bash
supabase db push
```

### Step 3: Import Test JSON Data into Database

Create a one-time import script:

```js
// scripts/import-tests.js
// Run with: node scripts/import-tests.js

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // use service role for admin access
)

const TEST_FILES = [
  { file: 'src/data/test1.json', testId: 1 },
  { file: 'src/data/test2.json', testId: 2 },
  { file: 'src/data/test3.json', testId: 3 },
  { file: 'src/data/test4.json', testId: 4 },
]

async function importAll() {
  for (const { file, testId } of TEST_FILES) {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'))

    // Insert test metadata
    await supabase.from('tests').upsert({
      id: testId,
      title: `Mock Test ${testId}`,
      total_questions: 68,
      varc_questions: 24,
      dilr_questions: 22,
      qa_questions: 22,
      duration_minutes: 120,
      section_duration_minutes: 40,
      is_active: true,
      sort_order: testId,
    })

    // Insert questions
    let order = 0
    for (const section of ['VARC', 'DILR', 'QA']) {
      const questions = data.sections[section]?.questions || []
      for (const q of questions) {
        order++
        await supabase.from('questions').upsert({
          id: q.id,
          test_id: testId,
          section: q.section,
          question_type: q.question_type,
          question_order: order,
          passage: q.passage || null,
          passage_id: q.passage_id || null,
          question_text: q.question_text,
          option_a: q.option_a || null,
          option_b: q.option_b || null,
          option_c: q.option_c || null,
          option_d: q.option_d || null,
          correct_answer: q.correct_answer,
          solution: q.solution || null,
          concept_tag: q.concept_tag || null,
          topic: q.topic || null,
          difficulty: q.difficulty || null,
        })
      }
    }

    console.log(`Imported test ${testId}: ${order} questions`)
  }
}

importAll().catch(console.error)
```

### Step 4: Deploy Edge Functions

```bash
supabase functions deploy get-questions
supabase functions deploy submit-test
supabase functions deploy get-review
```

### Step 5: Remove JSON Files from Frontend Build

```bash
# After confirming DB import is complete and Edge Functions work:
rm src/data/test1.json
rm src/data/test2.json
rm src/data/test3.json
rm src/data/test4.json
```

### Step 6: Replace localStorage Calls with Supabase Calls

See Section 9 for detailed file-by-file changes.

### Step 7: Update .gitignore

```
# Add to .gitignore
.env
.env.local
```

---

## 9. Frontend Changes Needed

### New Files to Create

| File | Purpose |
|------|---------|
| `src/lib/supabase.js` | Supabase client initialization |
| `src/contexts/AuthContext.jsx` | Auth state provider (wrap App) |
| `src/pages/Login.jsx` | Login/signup page |
| `src/hooks/useAuth.js` | Auth hook for components |

### Files to Modify

#### `src/App.jsx`
- Wrap with `<AuthProvider>`
- Add `/login` route
- Add auth guard: redirect to `/login` if not authenticated
- Remove static test data imports

#### `src/utils/storage.js` (rewrite or replace)
Replace every function with Supabase equivalents:

| Current function | Replacement |
|-----------------|-------------|
| `saveSession(testId, data)` | `supabase.from('test_attempts').update(...)` + `supabase.from('question_responses').upsert(...)` |
| `loadSession(testId)` | `supabase.from('test_attempts').select('*').eq('test_id', testId).eq('status', 'in_progress')` |
| `saveResult(testId, data)` | Handled by `submit-test` Edge Function |
| `loadResult(testId)` | `supabase.from('attempt_scores').select(...)` |
| `getUnlocks()` | `supabase.from('test_unlocks').select('test_id')` |
| `markTestComplete(testId)` | Handled by `submit-test` Edge Function (auto-unlocks next) |

#### `src/pages/Home.jsx`
- Remove `const TOTAL_TESTS = 12` -- fetch from `tests` table
- Replace `getUnlocks()` with Supabase query
- Fetch tests list + user unlocks on mount
- Show loading state while fetching
- Add logout button

#### `src/pages/Test.jsx`
- Remove `import testData from '../data/test1.json'` (the biggest change)
- Fetch questions via `get-questions` Edge Function on mount
- Replace `loadSession(testId)` with DB query to check for existing in-progress attempt
- Auto-save: change `saveSession(testId, data)` to batch upsert `test_attempts` + `question_responses`
- Submit: call `submit-test` Edge Function instead of `calculateScore()` + `saveResult()`
- Handle loading/error states

#### `src/pages/Results.jsx`
- Remove `loadResult(testId)` -- fetch from `attempt_scores` via Supabase
- Remove `markTestComplete(testId)` -- handled server-side
- Fetch percentile from DB (already calculated by `submit-test`)
- Remove `import { getPercentile }` -- no longer needed client-side

#### `src/pages/Review.jsx`
- Remove `import testData from '../data/test1.json'`
- Fetch review data via `get-review` Edge Function
- This is the ONLY place correct answers + solutions appear in frontend (post-submission)

#### `src/utils/scoring.js`
- Can be removed entirely (scoring is now server-side)
- Or keep as a reference / for offline fallback

#### `src/utils/percentile.js`
- Can be removed entirely (percentile is now calculated server-side)
- Or keep for display purposes only (the actual stored value comes from DB)

---

## 10. Environment Variables

### Frontend (`.env`)

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These are safe to expose in the frontend -- the `anon` key only grants access that RLS policies allow.

### Edge Functions (auto-injected by Supabase)

```
SUPABASE_URL               # Available automatically
SUPABASE_ANON_KEY          # Available automatically
SUPABASE_SERVICE_ROLE_KEY  # Available automatically (bypasses RLS)
```

### Import Script / Admin (`.env.local`, never committed)

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role-key  # NEVER expose this
```

---

## 11. Future Considerations

### Leaderboard

```sql
-- Leaderboard view: best score per user per test
create or replace view leaderboard as
select
  ta.test_id,
  p.display_name,
  s.total_score,
  s.estimated_percentile,
  ta.submitted_at,
  row_number() over (
    partition by ta.test_id
    order by s.total_score desc, ta.submitted_at asc
  ) as rank
from test_attempts ta
join attempt_scores s on s.attempt_id = ta.id
join profiles p on p.id = ta.user_id
where ta.status in ('submitted', 'reviewed');

-- RLS: leaderboard is read-only for all authenticated users
-- (Views inherit the RLS of underlying tables, so you may need
-- a security definer function or separate policy approach)
```

### Analytics Dashboard

Track aggregate stats for admin insights:
- Average score per test
- Question difficulty analysis (% correct per question)
- Section-wise performance trends per user
- Time spent per question (already captured in `question_responses.time_spent_seconds`)

### Question Bank Management

- Admin UI to create/edit questions
- Bulk import from CSV/Excel
- Tag-based question filtering
- Difficulty auto-calibration based on actual user performance

### Percentile Recalculation

Current percentile is static (hardcoded thresholds). Future improvement:
- Store all scores in `attempt_scores`
- Run a scheduled Edge Function (cron) to recalculate percentiles based on actual score distribution
- Update `estimated_percentile` for all attempts periodically

### Offline / Hybrid Mode

For unreliable internet during a test:
- Cache questions in memory after initial fetch
- Queue auto-save requests with retry logic
- Use `navigator.onLine` to detect connectivity
- Sync queued saves when back online

### Rate Limiting

Free tier consideration: add rate limiting to Edge Functions to prevent abuse:
- Max 1 `submit-test` call per attempt
- Max 1 `get-questions` call per 5 seconds per user
- Use Supabase's built-in rate limiting or implement via Redis/in-memory counters

---

## Appendix: Complete Migration SQL

Run this in Supabase SQL Editor to set up everything at once. This is the full schema combining existing `schema.sql` with all enhancements.

```sql
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

-- 2. Profiles (enhanced)
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

-- 4. Test Attempts (enhanced)
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

-- 5. Question Responses (enhanced)
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

-- 6. Attempt Scores (enhanced)
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

-- Questions: NO direct user access (Edge Functions use service_role)

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
```
