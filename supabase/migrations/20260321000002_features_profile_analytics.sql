-- ============================================
-- Feature 2: Profile preferences
-- Feature 6: Difficulty preference
-- Feature 3: CAT timeline
-- Feature 4: Syllabus tracker
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS difficulty_preference text DEFAULT 'all' CHECK (difficulty_preference IN ('all', 'Easy', 'Medium', 'Hard'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cat_exam_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_timeline boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS syllabus_progress jsonb DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preparation_months integer;

-- ============================================
-- Feature 1: Per-question analytics
-- ============================================

CREATE TABLE IF NOT EXISTS question_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  attempt_id uuid REFERENCES test_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id text NOT NULL REFERENCES questions(id),
  test_id integer NOT NULL REFERENCES tests(id),
  section text NOT NULL CHECK (section IN ('VARC', 'DILR', 'QA')),
  topic text,
  concept_tag text,
  difficulty text,
  time_spent_seconds integer DEFAULT 0,
  is_correct boolean,
  is_attempted boolean DEFAULT false,
  created_at timestamptz DEFAULT timezone('utc', now()),
  CONSTRAINT unique_user_question_attempt UNIQUE (user_id, attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_user ON question_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_topic ON question_analytics(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_analytics_section ON question_analytics(user_id, section);

ALTER TABLE question_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own analytics" ON question_analytics FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- Feature 4: Syllabus topics reference
-- ============================================

CREATE TABLE IF NOT EXISTS syllabus_topics (
  id serial PRIMARY KEY,
  section text NOT NULL CHECK (section IN ('VARC', 'DILR', 'QA')),
  topic text NOT NULL,
  subtopics text[] DEFAULT '{}',
  sort_order integer DEFAULT 0,
  CONSTRAINT unique_section_topic UNIQUE (section, topic)
);

ALTER TABLE syllabus_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view syllabus" ON syllabus_topics FOR SELECT USING (auth.role() = 'authenticated');

INSERT INTO syllabus_topics (section, topic, subtopics, sort_order) VALUES
  ('VARC', 'Reading Comprehension', ARRAY['Main Idea', 'Inference', 'Tone', 'Vocabulary in Context', 'Author Purpose'], 1),
  ('VARC', 'Para Jumbles', ARRAY['4-sentence', '5-sentence', 'Odd One Out'], 2),
  ('VARC', 'Para Summary', ARRAY['Summarization', 'Key Idea Extraction'], 3),
  ('VARC', 'Sentence Elimination', ARRAY['Odd Sentence', 'Coherence'], 4),
  ('VARC', 'Vocabulary', ARRAY['Word Meaning', 'Synonyms', 'Antonyms', 'Usage'], 5),
  ('DILR', 'Data Interpretation', ARRAY['Tables', 'Bar Graphs', 'Pie Charts', 'Line Graphs', 'Caselets'], 1),
  ('DILR', 'Logical Reasoning', ARRAY['Arrangements', 'Puzzles', 'Blood Relations', 'Syllogisms'], 2),
  ('DILR', 'Set Theory', ARRAY['Venn Diagrams', 'Maxima Minima'], 3),
  ('DILR', 'Games & Tournaments', ARRAY['Round Robin', 'Knockout', 'Scheduling'], 4),
  ('DILR', 'Binary Logic', ARRAY['Truth Tellers', 'Liars', 'Alternators'], 5),
  ('QA', 'Arithmetic', ARRAY['Percentages', 'Profit Loss', 'SI/CI', 'Ratio Proportion', 'Time Work', 'Time Speed Distance', 'Mixtures', 'Averages'], 1),
  ('QA', 'Algebra', ARRAY['Linear Equations', 'Quadratic Equations', 'Inequalities', 'Functions', 'Logarithms'], 2),
  ('QA', 'Number Theory', ARRAY['Divisibility', 'Remainders', 'Factors', 'HCF LCM', 'Base System'], 3),
  ('QA', 'Geometry', ARRAY['Triangles', 'Circles', 'Quadrilaterals', 'Coordinate Geometry', 'Mensuration'], 4),
  ('QA', 'Combinatorics', ARRAY['Permutations', 'Combinations', 'Probability'], 5),
  ('QA', 'Modern Math', ARRAY['Progressions', 'Series', 'Binomial Theorem', 'Set Theory'], 6)
ON CONFLICT (section, topic) DO NOTHING;
