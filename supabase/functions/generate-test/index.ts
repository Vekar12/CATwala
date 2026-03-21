import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// CAT exam structure
const STRUCTURE = {
  VARC: { count: 24, time: 40 },
  DILR: { count: 20, time: 40 },
  QA: { count: 22, time: 40 },
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
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

    // Auth
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const difficultyPref = body.difficulty || 'all' // 'all', 'Easy', 'Medium', 'Hard'

    // Get user's profile for preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('difficulty_preference, syllabus_progress')
      .eq('id', user.id)
      .single()

    const difficulty = difficultyPref !== 'all' ? difficultyPref : (profile?.difficulty_preference || 'all')

    // Get questions user has already seen (from question_analytics)
    const { data: seenData } = await supabase
      .from('question_analytics')
      .select('question_id')
      .eq('user_id', user.id)

    const seenIds = new Set((seenData || []).map(r => r.question_id))

    // Fetch all available questions grouped by section
    const sections: Record<string, any[]> = { VARC: [], DILR: [], QA: [] }

    for (const section of ['VARC', 'DILR', 'QA']) {
      let query = supabase
        .from('questions')
        .select('id, section, question_type, question_text, option_a, option_b, option_c, option_d, passage, passage_id, concept_tag, topic, difficulty')
        .eq('section', section)

      if (difficulty !== 'all') {
        query = query.eq('difficulty', difficulty)
      }

      const { data: questions } = await query
      sections[section] = questions || []
    }

    // Build the test: pick random questions, prefer unseen
    const selectedQuestions: Record<string, any[]> = { VARC: [], DILR: [], QA: [] }

    for (const [section, needed] of Object.entries(STRUCTURE)) {
      const allQ = sections[section]
      const unseen = allQ.filter(q => !seenIds.has(q.id))
      const seen = allQ.filter(q => seenIds.has(q.id))

      // Prefer unseen, fall back to seen if not enough
      let pool = shuffle(unseen)
      if (pool.length < needed.count) {
        pool = [...pool, ...shuffle(seen)]
      }

      // For VARC/DILR: handle passage groups (RC/set questions must stay together)
      if (section === 'VARC' || section === 'DILR') {
        const withPassage: Record<string, any[]> = {}
        const standalone: any[] = []

        for (const q of pool) {
          if (q.passage_id) {
            if (!withPassage[q.passage_id]) withPassage[q.passage_id] = []
            withPassage[q.passage_id].push(q)
          } else {
            standalone.push(q)
          }
        }

        // Add passage groups first (keep groups intact)
        const passageGroups = shuffle(Object.values(withPassage))
        let count = 0
        for (const group of passageGroups) {
          if (count + group.length <= needed.count) {
            selectedQuestions[section].push(...group)
            count += group.length
          }
        }

        // Fill remaining with standalone questions
        for (const q of standalone) {
          if (count >= needed.count) break
          selectedQuestions[section].push(q)
          count++
        }
      } else {
        // QA: just pick random questions
        selectedQuestions[section] = pool.slice(0, needed.count)
      }
    }

    // Build response in test format (matching get-questions format)
    const testSections: Record<string, any> = {}
    let totalQuestions = 0

    for (const [section, config] of Object.entries(STRUCTURE)) {
      const questions = selectedQuestions[section].map((q, i) => ({
        ...q,
        question_order: i + 1,
      }))
      testSections[section] = {
        duration_minutes: config.time,
        total_questions: questions.length,
        questions,
      }
      totalQuestions += questions.length
    }

    const result = {
      testId: `random_${Date.now()}`,
      title: `Practice Test (${difficulty === 'all' ? 'Mixed' : difficulty} Difficulty)`,
      is_random: true,
      total_questions: totalQuestions,
      unseen_count: Object.values(selectedQuestions).flat().filter(q => !seenIds.has(q.id)).length,
      sections: testSections,
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
