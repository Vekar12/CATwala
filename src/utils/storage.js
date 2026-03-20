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
  const responses = Object.entries(sessionData.answers)
    .filter(([, ans]) => ans.status && ans.status !== 'not_visited')
    .map(([questionId, ans]) => ({
      attempt_id: sessionData.attemptId,
      question_id: questionId,
      section: sessionData._questionSections?.[questionId] || 'VARC',
      selected_option: ans.selected || null,
      tita_answer: null,
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

  const { data: attempt } = await supabase
    .from('test_attempts')
    .select('*')
    .eq('user_id', user.id)
    .eq('test_id', Number(testId))
    .eq('status', 'in_progress')
    .single()

  if (!attempt) return null

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

  // Delete any existing in-progress attempt for this test (retake scenario)
  await supabase
    .from('test_attempts')
    .delete()
    .eq('user_id', user.id)
    .eq('test_id', Number(testId))
    .eq('status', 'in_progress')

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

// --- Completed tests ---

export async function getCompletedTests() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('test_attempts')
    .select('test_id')
    .eq('user_id', user.id)
    .in('status', ['submitted', 'reviewed'])

  return [...new Set((data || []).map(r => r.test_id))]
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
