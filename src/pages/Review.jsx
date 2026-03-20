import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadResult } from '../utils/storage'
import testData from '../data/test1.json'
import './Review.css'

const SECTIONS = ['VARC', 'DILR', 'QA']

function getAllQuestions(data) {
  const all = []
  SECTIONS.forEach((s) => {
    const qs = data.sections[s]?.questions || []
    all.push(...qs)
  })
  return all
}

export default function Review() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const result = loadResult(testId)

  const [sectionFilter, setSectionFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [expandedSolutions, setExpandedSolutions] = useState({})

  const allQuestions = getAllQuestions(testData)
  const answers = result?.answers || {}

  function getQuestionStatus(q) {
    const ans = answers[q.id]
    if (!ans || !ans.selected || ans.selected === '') return 'Unattempted'
    const correct = ans.selected.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
    return correct ? 'Correct' : 'Wrong'
  }

  let filtered = allQuestions
  if (sectionFilter !== 'All') filtered = filtered.filter((q) => q.section === sectionFilter)
  if (statusFilter !== 'All') filtered = filtered.filter((q) => getQuestionStatus(q) === statusFilter)

  function toggleSolution(qId) {
    setExpandedSolutions((prev) => ({ ...prev, [qId]: !prev[qId] }))
  }

  if (!result) {
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
            <button
              key={s}
              className={`filter-btn ${sectionFilter === s ? 'active' : ''}`}
              onClick={() => setSectionFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Status:</span>
          {['All', 'Correct', 'Wrong', 'Unattempted'].map((s) => (
            <button
              key={s}
              className={`filter-btn filter-status ${sectionFilter === s ? 'active' : ''} ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="review-body">
        {filtered.length === 0 && (
          <div className="review-empty-state">No questions match the selected filters.</div>
        )}
        {filtered.map((q, idx) => {
          const ans = answers[q.id]
          const userAnswer = ans?.selected || ''
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
                    <span className={`diff-badge diff-${q.difficulty.toLowerCase()}`}>
                      {q.difficulty}
                    </span>
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
                    <span className={userAnswer ? (status === 'Correct' ? 'correct' : 'wrong') : 'unattempted'}>
                      {userAnswer || '—'}
                    </span>
                  </div>
                  <div className="tita-row">
                    <span>Correct answer:</span>
                    <span className="correct">{q.correct_answer}</span>
                  </div>
                </div>
              )}

              <button
                className="btn-solution-toggle"
                onClick={() => toggleSolution(q.id)}
              >
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
