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

      const userAnswer = resp?.selected_option?.trim().toLowerCase()

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
