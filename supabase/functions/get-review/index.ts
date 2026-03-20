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
