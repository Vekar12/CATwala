// Scrapes 2IIM CAT question bank — topic-wise questions with solutions
// Usage: node scripts/scrape-2iim.js

const fs = require('fs')
const path = require('path')

const TOPICS = [
  // QA - Number System
  { url: 'quant/number-system/hcf-lcm/', section: 'QA', topic: 'HCF and LCM', concept: 'Number System' },
  { url: 'quant/number-system/factors/', section: 'QA', topic: 'Factors and Multiples', concept: 'Number System' },
  { url: 'quant/number-system/remainders/', section: 'QA', topic: 'Remainders', concept: 'Number System' },
  { url: 'quant/number-system/factorial/', section: 'QA', topic: 'Factorials', concept: 'Number System' },
  { url: 'quant/number-system/other/', section: 'QA', topic: 'Digits and Base System', concept: 'Number System' },
  // QA - Arithmetic
  { url: 'quant/arithmetic/ratio-mixtures-averages/', section: 'QA', topic: 'Ratio and Proportion', concept: 'Arithmetic' },
  { url: 'quant/arithmetic/percents-profits/', section: 'QA', topic: 'Percentages', concept: 'Arithmetic' },
  { url: 'quant/arithmetic/speed-time-races/', section: 'QA', topic: 'Time, Speed and Distance', concept: 'Arithmetic' },
  { url: 'quant/arithmetic/exponents-logarithms/', section: 'QA', topic: 'Logarithms', concept: 'Arithmetic' },
  { url: 'quant/arithmetic/pipes-cisterns-work-time/', section: 'QA', topic: 'Time and Work', concept: 'Arithmetic' },
  { url: 'quant/arithmetic/set-theory/', section: 'QA', topic: 'Set Theory', concept: 'Modern Math' },
  // QA - Geometry
  { url: 'quant/geometry/geometry-triangles/', section: 'QA', topic: 'Triangles', concept: 'Geometry' },
  { url: 'quant/geometry/co-ordinate-geometry/', section: 'QA', topic: 'Coordinate Geometry', concept: 'Geometry' },
  { url: 'quant/geometry/mensuration/', section: 'QA', topic: 'Mensuration', concept: 'Geometry' },
  { url: 'quant/geometry/trigonometry/', section: 'QA', topic: 'Trigonometry', concept: 'Geometry' },
  // QA - Algebra
  { url: 'quant/algebra/linear-quadratic-equations/', section: 'QA', topic: 'Linear and Quadratic Equations', concept: 'Algebra' },
  { url: 'quant/algebra/functions/', section: 'QA', topic: 'Functions', concept: 'Algebra' },
  { url: 'quant/algebra/inequalities/', section: 'QA', topic: 'Inequalities', concept: 'Algebra' },
  { url: 'quant/algebra/polynomials/', section: 'QA', topic: 'Polynomials', concept: 'Algebra' },
  { url: 'quant/algebra/progressions/', section: 'QA', topic: 'Sequences and Series', concept: 'Algebra' },
  // QA - Combinatorics
  { url: 'quant/permutation-probability/', section: 'QA', topic: 'Permutations and Combinations', concept: 'Modern Math' },
  // VARC
  { url: 'verbal/sentence-rearrangement/', section: 'VARC', topic: 'Para Jumbles', concept: 'Verbal Ability' },
  { url: 'verbal/sentence-correction/', section: 'VARC', topic: 'Sentence Correction', concept: 'Verbal Ability' },
  { url: 'verbal/sentence-elimination/', section: 'VARC', topic: 'Sentence Elimination', concept: 'Verbal Ability' },
  { url: 'verbal/paragraph-completion/', section: 'VARC', topic: 'Paragraph Completion', concept: 'Verbal Ability' },
  { url: 'verbal/reading-comprehension/', section: 'VARC', topic: 'Reading Comprehension', concept: 'Reading Comprehension' },
  { url: 'verbal/critical-reasoning/', section: 'VARC', topic: 'Critical Reasoning', concept: 'Verbal Ability' },
  { url: 'verbal/word-usage/', section: 'VARC', topic: 'Word Usage', concept: 'Verbal Ability' },
  { url: 'verbal/para-summary/', section: 'VARC', topic: 'Para Summary', concept: 'Verbal Ability' },
]

const BASE = 'https://iim-cat-questions-answers.2iim.com/'
const DELAY = 1500 // ms between requests to be respectful

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchPage(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
  return resp.text()
}

function extractQuestions(html, topicMeta) {
  const questions = []

  // Find question blocks — they typically have a pattern of numbered questions
  // with options and correct answer labels
  // We'll use regex to find question patterns

  // Pattern: question text followed by options and "Correct Answer"
  // The HTML structure varies but generally has clear markers

  // Extract text content by stripping HTML tags
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Find question blocks using "Choice [A-D]" pattern for correct answer
  const questionPattern = /Question\s+(\d+)[:\s]*([\s\S]*?)(?=Question\s+\d+|$)/gi
  let match

  // Alternative: split by question markers
  const sections = text.split(/(?=Question\s+\d+\s)/i).filter(s => s.trim())

  for (const section of sections) {
    const qNumMatch = section.match(/Question\s+(\d+)/i)
    if (!qNumMatch) continue

    const qNum = parseInt(qNumMatch[1])
    const content = section.substring(qNumMatch[0].length).trim()

    // Extract correct answer
    const answerMatch = content.match(/(?:Correct\s+Answer|Answer)\s*(?:is\s+)?(?:Choice\s+)?([A-D])/i)
    const correctAnswer = answerMatch ? answerMatch[1].toUpperCase() : null

    // Try to extract options
    const optA = content.match(/(?:^|\s)A\)\s*(.*?)(?=\s*B\)|$)/s)?.[1]?.trim()
    const optB = content.match(/(?:^|\s)B\)\s*(.*?)(?=\s*C\)|$)/s)?.[1]?.trim()
    const optC = content.match(/(?:^|\s)C\)\s*(.*?)(?=\s*D\)|$)/s)?.[1]?.trim()
    const optD = content.match(/(?:^|\s)D\)\s*(.*?)(?=\s*(?:Correct|Answer|Choice))/s)?.[1]?.trim()

    // Extract question text (before options)
    let questionText = content.split(/\s*A\)\s/)[0]?.trim() || content.substring(0, 300).trim()
    // Clean up
    questionText = questionText.replace(/\s+/g, ' ').trim()

    if (questionText.length > 10) {
      questions.push({
        id: `2iim_${topicMeta.url.replace(/\//g, '_')}_${qNum}`,
        section: topicMeta.section,
        question_type: (optA && optB) ? 'MCQ' : 'TITA',
        passage: null,
        passage_id: null,
        question_text: questionText,
        option_a: optA || null,
        option_b: optB || null,
        option_c: optC || null,
        option_d: optD || null,
        correct_answer: correctAnswer || '',
        solution: '', // Will be fetched separately
        concept_tag: topicMeta.concept,
        topic: topicMeta.topic,
        difficulty: 'Medium', // Default, can be adjusted
      })
    }
  }

  return questions
}

async function scrapeTopic(topicMeta) {
  const url = BASE + topicMeta.url
  console.log(`Fetching: ${topicMeta.topic} (${url})`)

  try {
    const html = await fetchPage(url)
    const questions = extractQuestions(html, topicMeta)
    console.log(`  Found ${questions.length} questions`)
    return questions
  } catch (e) {
    console.error(`  ERROR: ${e.message}`)
    return []
  }
}

async function main() {
  const outDir = path.join(__dirname, '..', 'Questions', 'extracted', '2iim')
  fs.mkdirSync(outDir, { recursive: true })

  const allQuestions = []
  let totalCount = 0

  for (const topic of TOPICS) {
    const questions = await scrapeTopic(topic)
    allQuestions.push(...questions)
    totalCount += questions.length
    await sleep(DELAY)
  }

  // Save all questions
  const output = {
    source: '2IIM CAT Question Bank',
    url: BASE,
    total_questions: totalCount,
    topics: TOPICS.length,
    extracted_at: new Date().toISOString(),
    questions: allQuestions,
  }

  const outPath = path.join(outDir, '2iim-question-bank.json')
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\nDone! ${totalCount} questions saved to ${outPath}`)

  // Also save a summary
  const summary = TOPICS.map(t => {
    const count = allQuestions.filter(q => q.topic === t.topic).length
    return `${t.section} | ${t.topic} | ${count} questions`
  })
  console.log('\nSummary:')
  summary.forEach(s => console.log('  ' + s))
}

main().catch(e => { console.error(e); process.exit(1) })
