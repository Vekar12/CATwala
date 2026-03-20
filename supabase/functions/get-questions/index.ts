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
