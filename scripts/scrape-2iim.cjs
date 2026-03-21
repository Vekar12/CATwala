const fs = require('fs')
const path = require('path')

const TOPICS = [
  { url: 'quant/number-system/hcf-lcm/', section: 'QA', topic: 'HCF and LCM', concept: 'Number System' },
  { url: 'quant/number-system/factors/', section: 'QA', topic: 'Factors and Multiples', concept: 'Number System' },
  { url: 'quant/number-system/remainders/', section: 'QA', topic: 'Remainders', concept: 'Number System' },
  { url: 'quant/number-system/factorial/', section: 'QA', topic: 'Factorials', concept: 'Number System' },
  { url: 'quant/number-system/other/', section: 'QA', topic: 'Digits and Base System', concept: 'Number System' },
  { url: 'quant/arithmetic/ratio-mixtures-averages/', section: 'QA', topic: 'Ratio and Proportion', concept: 'Arithmetic' },
  { url: 'quant/arithmetic/percents-profits/', section: 'QA', topic: 'Percentages', concept: 'Arithmetic' },
  { url: 'quant/arithmetic/speed-time-races/', section: 'QA', topic: 'Time Speed and Distance', concept: 'Arithmetic' },
  { url: 'quant/arithmetic/exponents-logarithms/', section: 'QA', topic: 'Logarithms', concept: 'Arithmetic' },
  { url: 'quant/arithmetic/pipes-cisterns-work-time/', section: 'QA', topic: 'Time and Work', concept: 'Arithmetic' },
  { url: 'quant/arithmetic/set-theory/', section: 'QA', topic: 'Set Theory', concept: 'Modern Math' },
  { url: 'quant/geometry/geometry-triangles/', section: 'QA', topic: 'Triangles', concept: 'Geometry' },
  { url: 'quant/geometry/co-ordinate-geometry/', section: 'QA', topic: 'Coordinate Geometry', concept: 'Geometry' },
  { url: 'quant/geometry/mensuration/', section: 'QA', topic: 'Mensuration', concept: 'Geometry' },
  { url: 'quant/geometry/trigonometry/', section: 'QA', topic: 'Trigonometry', concept: 'Geometry' },
  { url: 'quant/algebra/linear-quadratic-equations/', section: 'QA', topic: 'Linear and Quadratic Equations', concept: 'Algebra' },
  { url: 'quant/algebra/functions/', section: 'QA', topic: 'Functions', concept: 'Algebra' },
  { url: 'quant/algebra/inequalities/', section: 'QA', topic: 'Inequalities', concept: 'Algebra' },
  { url: 'quant/algebra/polynomials/', section: 'QA', topic: 'Polynomials', concept: 'Algebra' },
  { url: 'quant/algebra/progressions/', section: 'QA', topic: 'Sequences and Series', concept: 'Algebra' },
  { url: 'quant/permutation-probability/', section: 'QA', topic: 'Permutations and Combinations', concept: 'Modern Math' },
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
const DELAY = 2000

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchPage(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  return resp.text()
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\w+;/g, '').replace(/\s+/g, ' ').trim()
}

function extractQuestions(html, topicMeta) {
  const questions = []
  const quesMatch = html.match(/<ol class="ques[^"]*">([\s\S]*?)(?:<\/ol>\s*(?:<div|<p class="disclaimer"|<script|$))/i)
  if (!quesMatch) return questions

  const items = quesMatch[1].split(/<li>\s*<h4>/i).filter(s => s.trim().length > 20)

  items.forEach((item, idx) => {
    const qNum = idx + 1
    const pMatches = item.match(/<p>([\s\S]*?)<\/p>/gi)
    let questionText = ''
    if (pMatches) questionText = pMatches.map(p => stripTags(p)).join(' ').trim()

    const choiceMatch = item.match(/<ol class="choice[^"]*">([\s\S]*?)<\/ol>/i)
    let options = []
    if (choiceMatch) {
      const optItems = choiceMatch[1].match(/<li>([\s\S]*?)<\/li>/gi)
      if (optItems) options = optItems.map(o => stripTags(o).trim())
    }

    const answerMatch = item.match(/<b>\s*Choice\s+([A-D])\s*<\/b>/i)
    let correctAnswer = answerMatch ? answerMatch[1].toUpperCase() : ''

    const solnMatch = item.match(/href=([^\s>]+\.shtml)/i)
    const solnSlug = solnMatch ? solnMatch[1] : null

    if (questionText.length > 10) {
      questions.push({
        id: '2iim_' + topicMeta.topic.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '_' + qNum,
        section: topicMeta.section,
        question_type: options.length >= 4 ? 'MCQ' : 'TITA',
        passage: null,
        passage_id: null,
        question_text: questionText,
        option_a: options[0] || null,
        option_b: options[1] || null,
        option_c: options[2] || null,
        option_d: options[3] || null,
        correct_answer: correctAnswer,
        solution: '',
        solution_url: solnSlug ? BASE + topicMeta.url + solnSlug : null,
        concept_tag: topicMeta.concept,
        topic: topicMeta.topic,
        difficulty: 'Medium',
      })
    }
  })
  return questions
}

async function main() {
  const outDir = path.join(__dirname, '..', 'Questions', 'extracted', '2iim')
  fs.mkdirSync(outDir, { recursive: true })

  const allQuestions = []
  for (let i = 0; i < TOPICS.length; i++) {
    const topic = TOPICS[i]
    process.stdout.write('[' + (i+1) + '/' + TOPICS.length + '] ' + topic.topic + '... ')
    try {
      const html = await fetchPage(BASE + topic.url)
      const questions = extractQuestions(html, topic)
      allQuestions.push(...questions)
      console.log(questions.length + ' questions')
    } catch (e) {
      console.log('ERROR: ' + e.message)
    }
    await sleep(DELAY)
  }

  const outPath = path.join(outDir, '2iim-question-bank.json')
  fs.writeFileSync(outPath, JSON.stringify({
    source: '2IIM CAT Question Bank',
    total_questions: allQuestions.length,
    extracted_at: new Date().toISOString(),
    questions: allQuestions,
  }, null, 2))

  console.log('\nTotal: ' + allQuestions.length + ' questions -> ' + outPath)
}

main().catch(e => { console.error(e); process.exit(1) })
