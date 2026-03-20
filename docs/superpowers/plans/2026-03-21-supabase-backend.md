# CATwala Supabase Backend Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CATwala's localStorage-only architecture with a Supabase backend that secures test answers, adds authentication, enables cross-device sync, and calculates scores server-side.

**Architecture:** Supabase free tier provides Auth (email + Google), PostgreSQL (questions stored server-side, never exposing answers to frontend), and Edge Functions (server-side scoring, safe question serving, post-submission review). The frontend replaces all `localStorage` calls with Supabase SDK calls.

**Tech Stack:** Supabase (Auth, PostgreSQL, Edge Functions/Deno), React 19, Vite, `@supabase/supabase-js`

**Spec:** `BACKEND.md` in project root

---

## File Structure

### New files to create:
| File | Responsibility |
|------|---------------|
| `src/lib/supabase.js` | Supabase client singleton |
| `src/contexts/AuthContext.jsx` | Auth state provider, session listener |
| `src/pages/Login.jsx` | Login/signup UI |
| `src/pages/Login.css` | Login page styles |
| `src/hooks/useAuth.js` | Convenience hook to access auth context |
| `supabase/migrations/00001_initial_schema.sql` | Full database schema |
| `supabase/functions/get-questions/index.ts` | Serve questions without answers |
| `supabase/functions/submit-test/index.ts` | Server-side scoring |
| `supabase/functions/get-review/index.ts` | Serve answers post-submission |
| `scripts/import-tests.js` | One-time script to import JSON test data into DB |
| `.env.example` | Template for environment variables |

### Files to modify:
| File | Changes |
|------|---------|
| `package.json` | Add `@supabase/supabase-js` dependency |
| `src/main.jsx` | Wrap app with `AuthProvider` |
| `src/App.jsx` | Add `/login` route, auth guard, remove static test imports |
| `src/utils/storage.js` | Rewrite all functions to use Supabase instead of localStorage |
| `src/pages/Home.jsx` | Fetch tests + unlocks from Supabase, add logout button |
| `src/pages/Instructions.jsx` | Create attempt in Supabase instead of localStorage |
| `src/pages/Test.jsx` | Fetch questions via Edge Function, auto-save to Supabase, submit via Edge Function |
| `src/pages/Results.jsx` | Fetch scores from Supabase, remove client-side scoring |
| `src/pages/Review.jsx` | Fetch review data via Edge Function instead of importing JSON |
| `.gitignore` | Add `.env`, `.env.local` |

### Files to delete (after migration is verified):
| File | Reason |
|------|--------|
| `src/data/test1.json` | Questions moved to database |
| `src/data/test2.json` | Questions moved to database |
| `src/data/test3.json` | Questions moved to database |
| `src/data/test4.json` | Questions moved to database |
| `src/utils/scoring.js` | Scoring moved to Edge Function |
| `src/utils/percentile.js` | Percentile moved to Edge Function |

---

## Chunk 1: Foundation (Supabase Setup + Auth)

### Task 1: Install dependencies and configure Supabase client

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase.js`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Install Supabase SDK**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npm install @supabase/supabase-js
```

- [ ] **Step 2: Create `.env.example`**

Create `.env.example`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 3: Add `.env` to `.gitignore`**

Append to `.gitignore`:
```
.env
.env.local
```

- [ ] **Step 4: Create Supabase client**

Create `src/lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

- [ ] **Step 5: Create `.env` with actual values**

User must create a Supabase project at https://supabase.com, then create `.env`:
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

- [ ] **Step 6: Verify the app still builds**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npm run build
```
Expected: Build succeeds (supabase client created but not used yet)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.js .env.example .gitignore
git commit -m "feat: add Supabase SDK and client configuration"
```

---

### Task 2: Create AuthContext and Login page

**Files:**
- Create: `src/contexts/AuthContext.jsx`
- Create: `src/hooks/useAuth.js`
- Create: `src/pages/Login.jsx`
- Create: `src/pages/Login.css`

- [ ] **Step 1: Create AuthContext**

Create `src/contexts/AuthContext.jsx`:
```jsx
import { createContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password })

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: 'google' })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 2: Create useAuth hook**

Create `src/hooks/useAuth.js`:
```js
import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
```

- [ ] **Step 3: Create Login page**

Create `src/pages/Login.jsx`:
```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Login.css'

export default function Login() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password)

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (isSignUp) {
      setError('Check your email to confirm your account.')
      return
    }

    navigate('/')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <p className="login-tagline">India's most realistic CAT mock test</p>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <button className="btn-google" onClick={signInWithGoogle}>
          Continue with Google
        </button>

        <button
          className="btn-toggle-mode"
          onClick={() => { setIsSignUp(!isSignUp); setError('') }}
        >
          {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create Login.css**

Create `src/pages/Login.css`:
```css
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.login-card {
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
}

.login-logo {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.login-tagline {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 32px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.login-form input {
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
}

.login-error {
  color: #e53e3e;
  font-size: 0.85rem;
}

.btn-login {
  padding: 12px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-google {
  width: 100%;
  padding: 12px;
  margin-top: 12px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}

.btn-toggle-mode {
  margin-top: 16px;
  background: none;
  border: none;
  color: #1a73e8;
  cursor: pointer;
  font-size: 0.9rem;
}
```

- [ ] **Step 5: Verify files created**

```bash
ls src/contexts/AuthContext.jsx src/hooks/useAuth.js src/pages/Login.jsx src/pages/Login.css
```
Expected: All 4 files listed

- [ ] **Step 6: Commit**

```bash
git add src/contexts/ src/hooks/ src/pages/Login.jsx src/pages/Login.css
git commit -m "feat: add auth context, useAuth hook, and login page"
```

---

### Task 3: Wire auth into the app (main.jsx + App.jsx)

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Wrap app with AuthProvider in main.jsx**

Modify `src/main.jsx` — replace entire file:
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 2: Add auth guard and login route in App.jsx**

Modify `src/App.jsx` — replace entire file:
```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Home from './pages/Home'
import Instructions from './pages/Instructions'
import Test from './pages/Test'
import Results from './pages/Results'
import Review from './pages/Review'
import Login from './pages/Login'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/instructions/:testId" element={<ProtectedRoute><Instructions /></ProtectedRoute>} />
      <Route path="/test/:testId" element={<ProtectedRoute><Test /></ProtectedRoute>} />
      <Route path="/results/:testId" element={<ProtectedRoute><Results /></ProtectedRoute>} />
      <Route path="/review/:testId" element={<ProtectedRoute><Review /></ProtectedRoute>} />
    </Routes>
  )
}
```

- [ ] **Step 3: Verify app builds**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npm run build
```
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx src/App.jsx
git commit -m "feat: add auth guard and login route to app"
```

---

## Chunk 2: Database Schema + Data Import

### Task 4: Create Supabase migration with full schema

**Files:**
- Create: `supabase/migrations/00001_initial_schema.sql`

- [ ] **Step 1: Initialize Supabase in the project**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npx supabase init
```

- [ ] **Step 2: Create the migration file**

Create `supabase/migrations/00001_initial_schema.sql` with the complete SQL from BACKEND.md Appendix (Section 5 + RLS + triggers). This is the content from lines 1223-1438 of BACKEND.md:

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
```

- [ ] **Step 3: Push migration to Supabase**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```
Expected: Migration applied successfully

- [ ] **Step 4: Verify tables exist in Supabase Dashboard**

Open Supabase Dashboard > Table Editor. Confirm these tables exist:
`tests`, `profiles`, `questions`, `test_attempts`, `question_responses`, `attempt_scores`, `test_unlocks`

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema migration with all tables, RLS, and triggers"
```

---

### Task 5: Create import script and load test data

**Files:**
- Create: `scripts/import-tests.js`

- [ ] **Step 1: Create the import script**

Create `scripts/import-tests.js`:
```js
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TEST_FILES = [
  { file: '../src/data/test1.json', testId: 1 },
  { file: '../src/data/test2.json', testId: 2 },
  { file: '../src/data/test3.json', testId: 3 },
  { file: '../src/data/test4.json', testId: 4 },
]

async function importAll() {
  for (const { file, testId } of TEST_FILES) {
    const filePath = path.resolve(__dirname, file)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    // Insert test metadata
    const { error: testErr } = await supabase.from('tests').upsert({
      id: testId,
      title: data.title || `Mock Test ${testId}`,
      total_questions: 68,
      varc_questions: 24,
      dilr_questions: 22,
      qa_questions: 22,
      duration_minutes: 120,
      section_duration_minutes: 40,
      is_active: true,
      sort_order: testId,
    })
    if (testErr) {
      console.error(`Error inserting test ${testId}:`, testErr.message)
      continue
    }

    // Insert questions in batches
    let order = 0
    const rows = []
    for (const section of ['VARC', 'DILR', 'QA']) {
      const questions = data.sections[section]?.questions || []
      for (const q of questions) {
        order++
        rows.push({
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
          difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty)
            ? q.difficulty
            : (q.difficulty === 'tough' || q.difficulty === 'medium_tough' ? 'Hard' : 'Medium'),
        })
      }
    }

    const { error: qErr } = await supabase.from('questions').upsert(rows)
    if (qErr) {
      console.error(`Error inserting questions for test ${testId}:`, qErr.message)
    } else {
      console.log(`Imported test ${testId}: ${rows.length} questions`)
    }
  }

  console.log('Import complete!')
}

importAll().catch(console.error)
```

Note: The difficulty field in the JSON uses values like `'tough'` and `'medium_tough'` which don't match the DB constraint `('Easy', 'Medium', 'Hard')`. The script maps non-standard values to 'Hard' or 'Medium'.

- [ ] **Step 2: Run the import script**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/import-tests.js
```
Expected: Output showing 4 tests imported with question counts

- [ ] **Step 3: Verify data in Supabase Dashboard**

Open Supabase Dashboard > Table Editor > `questions` table.
Confirm rows exist and `correct_answer` column has values.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-tests.js
git commit -m "feat: add test data import script for Supabase"
```

---

## Chunk 3: Edge Functions

### Task 6: Create `get-questions` Edge Function

**Files:**
- Create: `supabase/functions/get-questions/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/get-questions/index.ts`:
```ts
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

    // Verify user is authenticated
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

    // Group by section (matching the original JSON format the frontend expects)
    const sections = {
      VARC: {
        duration_minutes: 40,
        total_questions: questions.filter(q => q.section === 'VARC').length,
        questions: questions.filter(q => q.section === 'VARC'),
      },
      DILR: {
        duration_minutes: 40,
        total_questions: questions.filter(q => q.section === 'DILR').length,
        questions: questions.filter(q => q.section === 'DILR'),
      },
      QA: {
        duration_minutes: 40,
        total_questions: questions.filter(q => q.section === 'QA').length,
        questions: questions.filter(q => q.section === 'QA'),
      },
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

- [ ] **Step 2: Deploy the function**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npx supabase functions deploy get-questions
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/get-questions/
git commit -m "feat: add get-questions edge function (strips answers)"
```

---

### Task 7: Create `submit-test` Edge Function

**Files:**
- Create: `supabase/functions/submit-test/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/submit-test/index.ts` — use the full implementation from BACKEND.md lines 537-762. This includes:
- Auth verification
- Attempt ownership + status check
- Fetch responses + correct answers from DB
- MCQ scoring (+3 correct, -1 wrong) and TITA scoring (+3 correct, 0 wrong)
- Percentile calculation (17-point lookup table with linear interpolation)
- Write to `attempt_scores`
- Mark attempt as `submitted`
- Unlock next test
- Increment `total_tests_taken` via RPC
- Return result matching the frontend's expected format

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Fetch correct answers from questions table
    const { data: questions } = await supabase
      .from('questions')
      .select('id, section, question_type, correct_answer')
      .eq('test_id', attempt.test_id)

    // Build response lookup
    const responseMap = new Map(
      (responses || []).map(r => [r.question_id, r])
    )

    // Calculate scores
    const sectionScores: Record<string, number> = { VARC: 0, DILR: 0, QA: 0 }
    const sectionStats: Record<string, { correct: number; wrong: number; unattempted: number; attempted: number }> = {
      VARC: { correct: 0, wrong: 0, unattempted: 0, attempted: 0 },
      DILR: { correct: 0, wrong: 0, unattempted: 0, attempted: 0 },
      QA:   { correct: 0, wrong: 0, unattempted: 0, attempted: 0 },
    }

    for (const q of (questions || [])) {
      const resp = responseMap.get(q.id)
      const section = q.section
      const isTITA = q.question_type === 'TITA'

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
    await supabase.from('attempt_scores').upsert({
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

    // Return results matching frontend format
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

- [ ] **Step 2: Deploy the function**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npx supabase functions deploy submit-test
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/submit-test/
git commit -m "feat: add submit-test edge function (server-side scoring)"
```

---

### Task 8: Create `get-review` Edge Function

**Files:**
- Create: `supabase/functions/get-review/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/get-review/index.ts`:
```ts
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

- [ ] **Step 2: Deploy the function**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npx supabase functions deploy get-review
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/get-review/
git commit -m "feat: add get-review edge function (answers after submission)"
```

---

## Chunk 4: Rewrite Storage Layer

### Task 9: Rewrite `storage.js` to use Supabase

**Files:**
- Modify: `src/utils/storage.js`

This is the critical bridge — all pages call these functions, so rewriting this file switches the entire app from localStorage to Supabase.

- [ ] **Step 1: Rewrite storage.js**

Replace `src/utils/storage.js` entirely:
```js
import { supabase } from '../lib/supabase'

// --- Session (test attempt) ---

export async function saveSession(testId, sessionData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Update attempt state
  const { error } = await supabase
    .from('test_attempts')
    .update({
      current_section: sessionData.currentSection,
      current_question_index: sessionData.currentQuestionIndex,
      varc_time_remaining: sessionData.varc_time_remaining,
      dilr_time_remaining: sessionData.dilr_time_remaining,
      qa_time_remaining: sessionData.qa_time_remaining,
    })
    .eq('id', sessionData.attemptId)

  if (error) console.error('saveSession error:', error.message)

  // Upsert question responses
  const responses = Object.entries(sessionData.answers).map(([questionId, ans]) => ({
    attempt_id: sessionData.attemptId,
    question_id: questionId,
    section: questionId.split('_')[0].toUpperCase(), // e.g., 'varc_1' -> derive section
    selected_option: ans.selected || null,
    tita_answer: null, // will be set below for TITA
    is_marked_for_review: ans.marked_for_review || false,
    status: ans.status || 'not_visited',
  }))

  if (responses.length > 0) {
    const { error: respErr } = await supabase
      .from('question_responses')
      .upsert(responses, { onConflict: 'attempt_id,question_id' })
    if (respErr) console.error('saveResponses error:', respErr.message)
  }
}

export async function loadSession(testId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Find in-progress attempt for this test
  const { data: attempt } = await supabase
    .from('test_attempts')
    .select('*')
    .eq('user_id', user.id)
    .eq('test_id', Number(testId))
    .eq('status', 'in_progress')
    .single()

  if (!attempt) return null

  // Load responses
  const { data: responses } = await supabase
    .from('question_responses')
    .select('*')
    .eq('attempt_id', attempt.id)

  const answers = {}
  for (const r of (responses || [])) {
    answers[r.question_id] = {
      selected: r.selected_option || r.tita_answer || '',
      status: r.status,
      marked_for_review: r.is_marked_for_review,
    }
  }

  return {
    attemptId: attempt.id,
    testId: attempt.test_id,
    currentSection: attempt.current_section,
    currentQuestionIndex: attempt.current_question_index,
    varc_time_remaining: attempt.varc_time_remaining,
    dilr_time_remaining: attempt.dilr_time_remaining,
    qa_time_remaining: attempt.qa_time_remaining,
    answers,
  }
}

export async function createAttempt(testId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: attempt, error } = await supabase
    .from('test_attempts')
    .insert({
      user_id: user.id,
      test_id: Number(testId),
    })
    .select()
    .single()

  if (error) {
    console.error('createAttempt error:', error.message)
    return null
  }

  return {
    attemptId: attempt.id,
    testId: attempt.test_id,
    currentSection: 'VARC',
    currentQuestionIndex: 0,
    varc_time_remaining: 2400,
    dilr_time_remaining: 2400,
    qa_time_remaining: 2400,
    answers: {},
  }
}

// --- Results ---

export async function loadResult(testId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get the latest submitted attempt for this test
  const { data: attempt } = await supabase
    .from('test_attempts')
    .select('*, attempt_scores(*)')
    .eq('user_id', user.id)
    .eq('test_id', Number(testId))
    .in('status', ['submitted', 'reviewed'])
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  if (!attempt || !attempt.attempt_scores) return null

  const s = attempt.attempt_scores
  return {
    attemptId: attempt.id,
    testId: attempt.test_id,
    submittedAt: attempt.submitted_at,
    score: {
      total: s.total_score,
      varc: s.varc_score,
      dilr: s.dilr_score,
      qa: s.qa_score,
      varcStats: { correct: s.varc_correct, wrong: s.varc_wrong, unattempted: s.varc_unattempted },
      dilrStats: { correct: s.dilr_correct, wrong: s.dilr_wrong, unattempted: s.dilr_unattempted },
      qaStats: { correct: s.qa_correct, wrong: s.qa_wrong, unattempted: s.qa_unattempted },
      correct: s.varc_correct + s.dilr_correct + s.qa_correct,
      wrong: s.varc_wrong + s.dilr_wrong + s.qa_wrong,
      unattempted: s.varc_unattempted + s.dilr_unattempted + s.qa_unattempted,
    },
    percentile: s.estimated_percentile,
    timings: {
      varc: 2400 - (attempt.varc_time_remaining || 0),
      dilr: 2400 - (attempt.dilr_time_remaining || 0),
      qa: 2400 - (attempt.qa_time_remaining || 0),
    },
  }
}

// --- Unlocks ---

export async function getUnlocks() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('test_unlocks')
    .select('test_id')
    .eq('user_id', user.id)

  return (data || []).map(r => r.test_id)
}

// --- Tests list ---

export async function getTests() {
  const { data } = await supabase
    .from('tests')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  return data || []
}

// markTestComplete is no longer needed — handled by submit-test Edge Function
export function markTestComplete() {
  // no-op: handled server-side
}
```

- [ ] **Step 2: Verify app builds**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npm run build
```
Expected: Build succeeds (pages will have runtime errors until they're updated, but the build should pass)

- [ ] **Step 3: Commit**

```bash
git add src/utils/storage.js
git commit -m "feat: rewrite storage.js to use Supabase instead of localStorage"
```

---

## Chunk 5: Update All Pages

### Task 10: Update Home.jsx

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Rewrite Home.jsx to fetch from Supabase**

Replace `src/pages/Home.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getUnlocks, getTests } from '../utils/storage'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [tests, setTests] = useState([])
  const [unlocks, setUnlocks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [testList, unlockList] = await Promise.all([
        getTests(),
        getUnlocks(),
      ])
      setTests(testList)
      setUnlocks(unlockList)
      setLoading(false)
    }
    load()
  }, [])

  const isCompleted = (n) => unlocks.includes(n)
  const isUnlocked = (n) => n === 1 || unlocks.includes(n - 1)

  if (loading) {
    return <div className="home"><p style={{ textAlign: 'center', padding: '2rem' }}>Loading tests...</p></div>
  }

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <p className="home-tagline">India's most realistic CAT mock test</p>
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>{user?.email}</span>
          <button onClick={signOut} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      <main className="home-main">
        <h2 className="home-section-title">Mock Tests</h2>
        <div className="test-grid">
          {tests.map((t) => {
            const n = t.id
            const completed = isCompleted(n)
            const unlocked = isUnlocked(n)

            return (
              <div
                key={n}
                className={`test-card ${!unlocked ? 'locked' : ''} ${completed ? 'completed' : ''}`}
              >
                <div className="test-card-header">
                  <h3>{t.title}</h3>
                  {!unlocked && <span className="lock-icon">🔒</span>}
                  {completed && <span className="status-badge completed-badge">Completed</span>}
                  {unlocked && !completed && <span className="status-badge available-badge">Available</span>}
                </div>
                <div className="test-card-meta">
                  <span>{t.total_questions} Questions</span>
                  <span>·</span>
                  <span>{t.duration_minutes} Minutes</span>
                </div>
                {!unlocked && (
                  <p className="locked-hint">Complete Test {n - 1} to unlock</p>
                )}
                {unlocked && !completed && (
                  <button
                    className="btn-start"
                    onClick={() => navigate(`/instructions/${n}`)}
                  >
                    Start Test
                  </button>
                )}
                {completed && (
                  <div className="card-actions">
                    <button className="btn-results" onClick={() => navigate(`/results/${n}`)}>
                      View Results
                    </button>
                    <button className="btn-retake" onClick={() => navigate(`/instructions/${n}`)}>
                      Retake
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat: update Home to fetch tests and unlocks from Supabase"
```

---

### Task 11: Update Instructions.jsx

**Files:**
- Modify: `src/pages/Instructions.jsx`

- [ ] **Step 1: Update Instructions to create attempt in Supabase**

In `src/pages/Instructions.jsx`, make these changes:

1. Add import: `import { createAttempt } from '../utils/storage'`
2. Remove import: `import { saveSession } from '../utils/storage'`
3. Make `handleBegin` async and use `createAttempt`:

```jsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createAttempt } from '../utils/storage'
import './Instructions.css'

export default function Instructions() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleBegin() {
    setLoading(true)
    const session = await createAttempt(testId)
    if (session) {
      navigate(`/test/${testId}`)
    } else {
      setLoading(false)
      alert('Failed to create test attempt. Please try again.')
    }
  }

  return (
    <div className="instructions-page">
      <div className="instructions-header">
        <div className="inst-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <h2>Mock Test {testId} — Instructions</h2>
        <div className="step-indicator">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`step-dot ${step >= s ? 'active' : ''}`} />
          ))}
        </div>
      </div>

      <div className="instructions-body">
        {step === 1 && (
          <div className="inst-screen">
            <h3>General Instructions</h3>
            <ol className="inst-list">
              <li>Total duration is <strong>120 minutes</strong> divided into 3 sections of <strong>40 minutes each</strong>.</li>
              <li>The sections are: <strong>Section I: Verbal Ability &amp; Reading Comprehension (VARC)</strong>, <strong>Section II: Data Interpretation &amp; Logical Reasoning (DILR)</strong>, <strong>Section III: Quantitative Ability (QA)</strong>.</li>
              <li>You <strong>cannot move</strong> to the next section before 40 minutes are up.</li>
              <li>You <strong>cannot go back</strong> to a previous section once time has elapsed.</li>
              <li>Each correct MCQ answer carries <strong>+3 marks</strong>. Each wrong MCQ answer carries <strong>-1 mark</strong>. TITA questions carry <strong>+3 for correct</strong>, <strong>0 for wrong or unattempted</strong>. No negative marking for TITA.</li>
              <li>Total questions: <strong>68</strong>. Maximum marks: <strong>204</strong>.</li>
              <li>Use the <strong>Question Palette</strong> on the right to navigate between questions.</li>
              <li>A built-in <strong>calculator</strong> is available on the top right.</li>
              <li>Do not refresh the page. Your progress is <strong>saved automatically</strong>.</li>
              <li>Once you click <strong>Submit</strong>, the test cannot be resumed.</li>
            </ol>
          </div>
        )}

        {step === 2 && (
          <div className="inst-screen">
            <h3>Understanding the Question Palette</h3>
            <div className="legend-list">
              <div className="legend-item">
                <div className="legend-circle gray" />
                <div><strong>Not Visited</strong><p>You have not visited this question yet</p></div>
              </div>
              <div className="legend-item">
                <div className="legend-circle red" />
                <div><strong>Not Answered</strong><p>You visited but did not answer</p></div>
              </div>
              <div className="legend-item">
                <div className="legend-circle green" />
                <div><strong>Answered</strong><p>You have saved an answer</p></div>
              </div>
              <div className="legend-item">
                <div className="legend-circle purple" />
                <div><strong>Marked for Review</strong><p>Marked but not answered</p></div>
              </div>
              <div className="legend-item">
                <div className="legend-circle orange" />
                <div><strong>Answered &amp; Marked for Review</strong><p>Answered and flagged for review</p></div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="inst-screen">
            <h3>Declaration</h3>
            <div className="declaration-box">
              <p>I have read and understood all instructions. I am aware that attempting to use unfair means will result in disqualification. I confirm that I will not use any external resources during the test.</p>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>I agree to the above declaration</span>
            </label>
          </div>
        )}

        <div className="inst-actions">
          {step > 1 && (
            <button className="btn-prev" onClick={() => setStep(step - 1)}>Previous</button>
          )}
          {step < 3 && (
            <button className="btn-next" onClick={() => setStep(step + 1)}>Next</button>
          )}
          {step === 3 && (
            <button className="btn-begin" disabled={!agreed || loading} onClick={handleBegin}>
              {loading ? 'Starting...' : 'I am ready to begin'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Instructions.jsx
git commit -m "feat: update Instructions to create attempt in Supabase"
```

---

### Task 12: Update Test.jsx (biggest change)

**Files:**
- Modify: `src/pages/Test.jsx`

This is the most critical change. The page must:
1. Fetch questions via `get-questions` Edge Function (no JSON import)
2. Load/resume session from Supabase (not localStorage)
3. Auto-save to Supabase (not localStorage)
4. Submit via `submit-test` Edge Function (not client-side scoring)

- [ ] **Step 1: Rewrite Test.jsx**

Replace `src/pages/Test.jsx` entirely:
```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QuestionCard from '../components/QuestionCard'
import QuestionPalette from '../components/QuestionPalette'
import SectionTabs from '../components/SectionTabs'
import Timer from '../components/Timer'
import Calculator from '../components/Calculator'
import { loadSession, saveSession } from '../utils/storage'
import { supabase } from '../lib/supabase'
import './Test.css'

const SECTIONS = ['VARC', 'DILR', 'QA']
const SECTION_TIME = 2400

function getSectionQuestions(testData, section) {
  return testData?.sections?.[section]?.questions || []
}

function getAllQuestions(testData) {
  const all = []
  SECTIONS.forEach((s) => {
    all.push(...getSectionQuestions(testData, s))
  })
  return all
}

export default function Test() {
  const { testId } = useParams()
  const navigate = useNavigate()

  const [testData, setTestData] = useState(null)
  const [session, setSession] = useState(null)
  const [showCalc, setShowCalc] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const timerRef = useRef(null)
  const saveRef = useRef(null)

  // Load test data and session on mount
  useEffect(() => {
    async function init() {
      // Fetch questions via Edge Function
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const resp = await supabase.functions.invoke('get-questions', {
        body: { testId: Number(testId) },
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      })

      if (resp.error) {
        console.error('Failed to load questions:', resp.error)
        navigate('/')
        return
      }

      setTestData(resp.data)

      // Load existing session or expect one from Instructions
      const saved = await loadSession(testId)
      if (saved) {
        setSession(saved)
      } else {
        // No session found — user may have navigated here directly
        navigate(`/instructions/${testId}`)
        return
      }

      setPageLoading(false)
    }
    init()
  }, [testId, navigate])

  // Keep saveRef in sync
  useEffect(() => {
    if (session) saveRef.current = session
  }, [session])

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!session) return
    const interval = setInterval(() => {
      if (saveRef.current) saveSession(testId, saveRef.current)
    }, 10000)
    return () => clearInterval(interval)
  }, [testId, session?.attemptId])

  // Tick timer every second
  useEffect(() => {
    if (!session) return
    timerRef.current = setInterval(() => {
      setSession((prev) => {
        if (!prev) return prev
        const key = `${prev.currentSection.toLowerCase()}_time_remaining`
        const newTime = Math.max(0, (prev[key] ?? SECTION_TIME) - 1)
        return { ...prev, [key]: newTime }
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [session?.attemptId])

  const currentSection = session?.currentSection || 'VARC'
  const currentIndex = session?.currentQuestionIndex || 0
  const answers = session?.answers || {}

  const sectionQuestions = getSectionQuestions(testData, currentSection)
  const currentQuestion = sectionQuestions[currentIndex]

  const timeKey = `${currentSection.toLowerCase()}_time_remaining`
  const timeLeft = session?.[timeKey] ?? SECTION_TIME

  const completedSections = SECTIONS.filter((s) => {
    return SECTIONS.indexOf(s) < SECTIONS.indexOf(currentSection)
  })

  const handleSectionExpire = useCallback(() => {
    const curIdx = SECTIONS.indexOf(currentSection)
    if (curIdx < SECTIONS.length - 1) {
      const nextSection = SECTIONS[curIdx + 1]
      setSession((prev) => {
        const updated = { ...prev, currentSection: nextSection, currentQuestionIndex: 0 }
        saveSession(testId, updated)
        return updated
      })
    } else {
      handleSubmitTest()
    }
  }, [currentSection, testId])

  function updateSession(updates) {
    setSession((prev) => ({ ...prev, ...updates }))
  }

  function handleAnswerChange(value) {
    const qId = currentQuestion.id
    const existing = answers[qId] || {}
    const newAnswers = {
      ...answers,
      [qId]: { ...existing, selected: value, status: existing.status === 'marked' ? 'answered_marked' : 'answered' },
    }
    updateSession({ answers: newAnswers })
  }

  function handleSaveNext() {
    const qId = currentQuestion.id
    const existing = answers[qId] || {}
    const hasAnswer = existing.selected && existing.selected !== ''
    const newStatus = existing.marked_for_review ? 'answered_marked' : (hasAnswer ? 'answered' : 'not_answered')
    const newAnswers = {
      ...answers,
      [qId]: { ...existing, status: hasAnswer ? newStatus : 'not_answered' },
    }
    const nextIndex = Math.min(currentIndex + 1, sectionQuestions.length - 1)
    const nextQId = sectionQuestions[nextIndex].id
    if (!newAnswers[nextQId]) {
      newAnswers[nextQId] = { status: 'not_answered' }
    }
    updateSession({ answers: newAnswers, currentQuestionIndex: nextIndex })
  }

  function handleMarkReview() {
    const qId = currentQuestion.id
    const existing = answers[qId] || {}
    const hasAnswer = existing.selected && existing.selected !== ''
    const newStatus = hasAnswer ? 'answered_marked' : 'marked'
    const newAnswers = {
      ...answers,
      [qId]: { ...existing, status: newStatus, marked_for_review: true },
    }
    const nextIndex = Math.min(currentIndex + 1, sectionQuestions.length - 1)
    const nextQId = sectionQuestions[nextIndex].id
    if (!newAnswers[nextQId]) {
      newAnswers[nextQId] = { status: 'not_answered' }
    }
    updateSession({ answers: newAnswers, currentQuestionIndex: nextIndex })
  }

  function handleClearResponse() {
    const qId = currentQuestion.id
    const existing = answers[qId] || {}
    const newAnswers = {
      ...answers,
      [qId]: { ...existing, selected: '', status: 'not_answered', marked_for_review: false },
    }
    updateSession({ answers: newAnswers })
  }

  function handlePaletteNavigate(index) {
    const qId = sectionQuestions[index].id
    const newAnswers = { ...answers }
    if (!newAnswers[qId]) {
      newAnswers[qId] = { status: 'not_answered' }
    }
    updateSession({ answers: newAnswers, currentQuestionIndex: index })
  }

  function handleSectionSubmit() {
    const curIdx = SECTIONS.indexOf(currentSection)
    if (curIdx < SECTIONS.length - 1) {
      if (!confirmSubmit) {
        setConfirmSubmit(true)
        return
      }
      const nextSection = SECTIONS[curIdx + 1]
      setSession((prev) => {
        const updated = { ...prev, currentSection: nextSection, currentQuestionIndex: 0 }
        saveSession(testId, updated)
        return updated
      })
      setConfirmSubmit(false)
    } else {
      handleSubmitTest()
    }
  }

  async function handleSubmitTest() {
    clearInterval(timerRef.current)

    // Save final state first
    if (saveRef.current) {
      await saveSession(testId, saveRef.current)
    }

    // Call submit-test Edge Function
    const { data: { session: authSession } } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('submit-test', {
      body: { attemptId: saveRef.current.attemptId },
      headers: { Authorization: `Bearer ${authSession.access_token}` },
    })

    if (error) {
      console.error('Submit error:', error)
      alert('Failed to submit test. Please try again.')
      return
    }

    navigate(`/results/${testId}`)
  }

  if (pageLoading || !currentQuestion) {
    return <div className="test-loading">Loading test...</div>
  }

  return (
    <div className="test-page">
      <div className="test-topbar">
        <div className="topbar-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <SectionTabs currentSection={currentSection} completedSections={completedSections} />
        <div className="topbar-right">
          <button className="calc-toggle" onClick={() => setShowCalc(!showCalc)}>
            🔢 Calculator
          </button>
          <Timer secondsLeft={timeLeft} onExpire={handleSectionExpire} />
        </div>
      </div>

      <div className="test-main">
        <div className="test-left">
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={sectionQuestions.length}
            section={currentSection}
            answer={answers[currentQuestion.id]}
            onAnswerChange={handleAnswerChange}
          />
          <div className="test-action-bar">
            <div className="action-left">
              <button className="btn-action btn-mark" onClick={handleMarkReview}>
                Mark for Review & Next
              </button>
              <button className="btn-action btn-clear" onClick={handleClearResponse}>
                Clear Response
              </button>
            </div>
            <button className="btn-action btn-save" onClick={handleSaveNext}>
              Save & Next
            </button>
          </div>
        </div>

        <div className="test-right">
          <QuestionPalette
            questions={sectionQuestions}
            sectionName={currentSection}
            answers={answers}
            currentIndex={currentIndex}
            onNavigate={handlePaletteNavigate}
            onSubmit={handleSectionSubmit}
            timeExpired={timeLeft === 0}
          />
        </div>
      </div>

      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}

      {confirmSubmit && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>Submit Section?</h3>
            <p>Are you sure you want to submit the current section and move to the next? You cannot return to this section.</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmSubmit(false)}>Cancel</button>
              <button className="btn-confirm" onClick={handleSectionSubmit}>Yes, Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Test.jsx
git commit -m "feat: update Test page to use Supabase (questions via edge function, server-side submit)"
```

---

### Task 13: Update Results.jsx

**Files:**
- Modify: `src/pages/Results.jsx`

- [ ] **Step 1: Rewrite Results.jsx to use Supabase**

Replace `src/pages/Results.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadResult } from '../utils/storage'
import './Results.css'

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default function Results() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const r = await loadResult(testId)
      setResult(r)
      setLoading(false)
    }
    load()
  }, [testId])

  if (loading) {
    return <div className="results-empty"><p>Loading results...</p></div>
  }

  if (!result) {
    return (
      <div className="results-empty">
        <p>No result found for this test.</p>
        <button onClick={() => navigate('/')}>Back to Home</button>
      </div>
    )
  }

  const { score, percentile, timings } = result

  const sections = [
    { name: 'VARC', score: score.varc, stats: score.varcStats, time: timings?.varc || 0 },
    { name: 'DILR', score: score.dilr, stats: score.dilrStats, time: timings?.dilr || 0 },
    { name: 'QA', score: score.qa, stats: score.qaStats, time: timings?.qa || 0 },
  ]

  const totalAttempted = score.correct + score.wrong
  const accuracy = totalAttempted > 0 ? ((score.correct / totalAttempted) * 100).toFixed(1) : 0

  return (
    <div className="results-page">
      <div className="results-header">
        <div className="logo-small">
          <span className="logo-cat">CAT</span><span className="logo-wala">Wala</span>
        </div>
        <h1>Test Completed — CATWala Mock Test {testId}</h1>
      </div>

      <div className="results-body">
        <div className="score-card">
          <div className="score-main">
            <div className="score-total">
              <div className="score-value">{score.total}</div>
              <div className="score-max">/ 204</div>
            </div>
            <div className="score-label">Total Score</div>
          </div>
          <div className="score-divider" />
          <div className="percentile-block">
            <div className="percentile-value">{percentile}%</div>
            <div className="percentile-label">Estimated Percentile</div>
          </div>
        </div>

        <div className="section-cards">
          {sections.map((sec) => (
            <div key={sec.name} className="section-result-card">
              <div className="sec-name">{sec.name}</div>
              <div className="sec-score">{sec.score} pts</div>
              <div className="sec-stats">
                <div className="stat-row"><span>Correct</span><span className="stat-val correct">{sec.stats?.correct || 0}</span></div>
                <div className="stat-row"><span>Wrong</span><span className="stat-val wrong">{sec.stats?.wrong || 0}</span></div>
                <div className="stat-row"><span>Unattempted</span><span className="stat-val">{sec.stats?.unattempted || 0}</span></div>
                <div className="stat-row"><span>Time Used</span><span className="stat-val">{fmtTime(sec.time)}</span></div>
              </div>
            </div>
          ))}
        </div>

        <div className="overall-stats">
          <div className="stat-box"><div className="stat-box-val">{totalAttempted}</div><div className="stat-box-label">Total Attempted</div></div>
          <div className="stat-box"><div className="stat-box-val correct">{score.correct}</div><div className="stat-box-label">Correct</div></div>
          <div className="stat-box"><div className="stat-box-val wrong">{score.wrong}</div><div className="stat-box-label">Wrong</div></div>
          <div className="stat-box"><div className="stat-box-val">{score.unattempted}</div><div className="stat-box-label">Unattempted</div></div>
          <div className="stat-box"><div className="stat-box-val">{accuracy}%</div><div className="stat-box-label">Accuracy</div></div>
        </div>

        <div className="results-actions">
          <button className="btn-review" onClick={() => navigate(`/review/${testId}`)}>Review Answers</button>
          <button className="btn-home" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Results.jsx
git commit -m "feat: update Results page to fetch scores from Supabase"
```

---

### Task 14: Update Review.jsx

**Files:**
- Modify: `src/pages/Review.jsx`

- [ ] **Step 1: Rewrite Review.jsx to use get-review Edge Function**

Replace `src/pages/Review.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadResult } from '../utils/storage'
import { supabase } from '../lib/supabase'
import './Review.css'

const SECTIONS = ['VARC', 'DILR', 'QA']

export default function Review() {
  const { testId } = useParams()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [sectionFilter, setSectionFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [expandedSolutions, setExpandedSolutions] = useState({})

  useEffect(() => {
    async function load() {
      // Get the attemptId from result
      const result = await loadResult(testId)
      if (!result) {
        setLoading(false)
        return
      }

      // Fetch review data via Edge Function
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('get-review', {
        body: { attemptId: result.attemptId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (error) {
        console.error('Failed to load review:', error)
        setLoading(false)
        return
      }

      setQuestions(data.questions || [])
      setLoading(false)
    }
    load()
  }, [testId])

  function getQuestionStatus(q) {
    const resp = q.userResponse
    const userAnswer = resp?.selected_option || resp?.tita_answer || ''
    if (!userAnswer || userAnswer === '') return 'Unattempted'
    const correct = userAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
    return correct ? 'Correct' : 'Wrong'
  }

  let filtered = questions
  if (sectionFilter !== 'All') filtered = filtered.filter((q) => q.section === sectionFilter)
  if (statusFilter !== 'All') filtered = filtered.filter((q) => getQuestionStatus(q) === statusFilter)

  function toggleSolution(qId) {
    setExpandedSolutions((prev) => ({ ...prev, [qId]: !prev[qId] }))
  }

  if (loading) {
    return <div className="review-empty"><p>Loading review...</p></div>
  }

  if (questions.length === 0) {
    return (
      <div className="review-empty">
        <p>No result found.</p>
        <button onClick={() => navigate('/')}>Back to Home</button>
      </div>
    )
  }

  return (
    <div className="review-page">
      <div className="review-header">
        <div className="logo-small">
          <span className="logo-cat">CAT</span><span className="logo-wala">Wala</span>
        </div>
        <h1>Answer Review — Mock Test {testId}</h1>
        <button className="btn-back-results" onClick={() => navigate(`/results/${testId}`)}>
          ← Back to Results
        </button>
      </div>

      <div className="review-filters">
        <div className="filter-group">
          <span className="filter-label">Section:</span>
          {['All', ...SECTIONS].map((s) => (
            <button key={s} className={`filter-btn ${sectionFilter === s ? 'active' : ''}`} onClick={() => setSectionFilter(s)}>{s}</button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Status:</span>
          {['All', 'Correct', 'Wrong', 'Unattempted'].map((s) => (
            <button key={s} className={`filter-btn filter-status ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="review-body">
        {filtered.length === 0 && (
          <div className="review-empty-state">No questions match the selected filters.</div>
        )}
        {filtered.map((q, idx) => {
          const resp = q.userResponse
          const userAnswer = resp?.selected_option || resp?.tita_answer || ''
          const status = getQuestionStatus(q)
          const isTITA = q.question_type === 'TITA'
          const options = [
            { key: 'A', text: q.option_a },
            { key: 'B', text: q.option_b },
            { key: 'C', text: q.option_c },
            { key: 'D', text: q.option_d },
          ]

          return (
            <div key={q.id} className={`review-card ${status.toLowerCase()}`}>
              <div className="review-card-header">
                <div className="review-card-meta">
                  <span className="review-qnum">Q{idx + 1}</span>
                  <span className="review-section-tag">{q.section}</span>
                  {q.topic && <span className="review-topic-tag">{q.topic}</span>}
                  {q.concept_tag && <span className="review-concept-tag">{q.concept_tag}</span>}
                  {q.difficulty && (
                    <span className={`diff-badge diff-${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                  )}
                </div>
                <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>
              </div>

              {q.passage && (
                <div className="review-passage">
                  <div className="passage-label">Passage</div>
                  <p>{q.passage}</p>
                </div>
              )}

              <div className="review-question-text">{q.question_text}</div>

              {!isTITA && (
                <div className="review-options">
                  {options.map(({ key, text }) => {
                    const isCorrect = key === q.correct_answer
                    const isUserAnswer = key === userAnswer
                    let cls = 'review-option'
                    if (isCorrect) cls += ' correct-option'
                    if (isUserAnswer && !isCorrect) cls += ' wrong-option'
                    return (
                      <div key={key} className={cls}>
                        <span className="option-key">{key}</span>
                        <span>{text}</span>
                        {isCorrect && <span className="option-tag correct-tag">✓ Correct</span>}
                        {isUserAnswer && !isCorrect && <span className="option-tag wrong-tag">✗ Your answer</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {isTITA && (
                <div className="tita-review">
                  <div className="tita-row">
                    <span>Your answer:</span>
                    <span className={userAnswer ? (status === 'Correct' ? 'correct' : 'wrong') : 'unattempted'}>{userAnswer || '—'}</span>
                  </div>
                  <div className="tita-row">
                    <span>Correct answer:</span>
                    <span className="correct">{q.correct_answer}</span>
                  </div>
                </div>
              )}

              <button className="btn-solution-toggle" onClick={() => toggleSolution(q.id)}>
                {expandedSolutions[q.id] ? '▲ Hide Solution' : '▼ View Solution'}
              </button>

              {expandedSolutions[q.id] && (
                <div className="solution-box">
                  <div className="solution-label">Solution</div>
                  <p>{q.solution}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Review.jsx
git commit -m "feat: update Review page to fetch answers via get-review edge function"
```

---

## Chunk 6: Cleanup and Verification

### Task 15: Remove old files and verify

**Files:**
- Delete: `src/data/test1.json`, `src/data/test2.json`, `src/data/test3.json`, `src/data/test4.json`
- Delete: `src/utils/scoring.js`, `src/utils/percentile.js`

- [ ] **Step 1: Verify no remaining imports of deleted files**

Search the codebase for any remaining references:

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
grep -r "from.*data/test" src/ --include="*.jsx" --include="*.js"
grep -r "from.*scoring" src/ --include="*.jsx" --include="*.js"
grep -r "from.*percentile" src/ --include="*.jsx" --include="*.js"
```
Expected: No matches (all imports have been removed in previous tasks)

- [ ] **Step 2: Delete old files**

```bash
rm src/data/test1.json src/data/test2.json src/data/test3.json src/data/test4.json
rm src/utils/scoring.js src/utils/percentile.js
rmdir src/data 2>/dev/null || true
```

- [ ] **Step 3: Verify app builds**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npm run build
```
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove client-side test data, scoring, and percentile (moved to Supabase)"
```

---

### Task 16: End-to-end manual test

- [ ] **Step 1: Start dev server**

```bash
cd "/Users/pranav/Documents/My Stuff/CATwala"
npm run dev
```

- [ ] **Step 2: Test auth flow**

1. Open `http://localhost:5173/CATwala/`
2. Should redirect to `/login`
3. Sign up with email/password
4. Check email for confirmation link
5. Log in — should see Home with test cards

- [ ] **Step 3: Test question loading**

1. Click "Start Test" on Mock Test 1
2. Complete 3-step instructions
3. Verify questions load (no JSON import — coming from Supabase)
4. Answer a few questions, navigate between them

- [ ] **Step 4: Test auto-save**

1. During a test, wait 10+ seconds
2. Refresh the page
3. Verify session resumes from where you left off (section, question, answers preserved)

- [ ] **Step 5: Test submission**

1. Submit all sections or let timer expire
2. Verify Results page shows score and percentile
3. Verify "Review Answers" shows questions WITH correct answers and solutions

- [ ] **Step 6: Test unlock progression**

1. Go Home — Test 1 should show "Completed", Test 2 should be "Available"
2. Logout and log back in — unlocks should persist

- [ ] **Step 7: Verify security**

1. Open DevTools > Network tab during a test
2. Check the `get-questions` response — should NOT contain `correct_answer` or `solution` fields
3. Check that `questions` table is not accessible via direct PostgREST calls (RLS blocks it)
