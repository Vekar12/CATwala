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

    // Insert questions in batch
    let order = 0
    const rows = []
    for (const section of ['VARC', 'DILR', 'QA']) {
      const questions = data.sections[section]?.questions || []
      for (const q of questions) {
        order++
        // Normalize difficulty to match DB constraint
        let difficulty = q.difficulty || 'Medium'
        if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
          if (difficulty === 'tough' || difficulty === 'medium_tough') difficulty = 'Hard'
          else difficulty = 'Medium'
        }

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
          difficulty,
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
