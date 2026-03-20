import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadResult, getUserAnalytics } from '../utils/storage'
import { supabase } from '../lib/supabase'
import './Review.css'

const SECTIONS = ['VARC', 'DILR', 'QA']

// Ideal time per question by difficulty (seconds)
const IDEAL_TIME = { Easy: 90, Medium: 150, Hard: 210 }

function fmtTime(seconds) {
  if (!seconds || seconds === 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function Review() {
  const { testId } = useParams()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState([])
  const [analytics, setAnalytics] = useState({})
  const [loading, setLoading] = useState(true)
  const [sectionFilter, setSectionFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [expandedSolutions, setExpandedSolutions] = useState({})

  useEffect(() => {
    async function load() {
      const result = await loadResult(testId)
      if (!result) {
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login')
        return
      }
      const [reviewResp, analyticsData] = await Promise.all([
        supabase.functions.invoke('get-review', {
          body: { attemptId: result.attemptId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        getUserAnalytics(),
      ])

      if (reviewResp.error) {
        console.error('Failed to load review:', reviewResp.error)
        setLoading(false)
        return
      }

      setQuestions(reviewResp.data.questions || [])

      // Build analytics lookup by question_id (filter to this test's attempt)
      const analyticsMap = {}
      for (const a of (analyticsData || [])) {
        if (a.attempt_id === result.attemptId) {
          analyticsMap[a.question_id] = a
        }
      }
      setAnalytics(analyticsMap)
      setLoading(false)
    }
    load()
  }, [testId])

  function getQuestionStatus(q) {
    const resp = q.userResponse
    const userAnswer = resp?.selected_option || resp?.tita_answer || ''
    if (!userAnswer || userAnswer === '') return 'Unattempted'
    const correct = userAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
    return correct ? 'Correct' : 'Wrong'
  }

  let filtered = questions
  if (sectionFilter !== 'All') filtered = filtered.filter((q) => q.section === sectionFilter)
  if (statusFilter !== 'All') filtered = filtered.filter((q) => getQuestionStatus(q) === statusFilter)

  function toggleSolution(qId) {
    setExpandedSolutions((prev) => ({ ...prev, [qId]: !prev[qId] }))
  }

  if (loading) {
    return <div className="review-empty"><p>Loading review...</p></div>
  }

  if (questions.length === 0) {
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
            <button key={s} className={`filter-btn ${sectionFilter === s ? 'active' : ''}`} onClick={() => setSectionFilter(s)}>{s}</button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Status:</span>
          {['All', 'Correct', 'Wrong', 'Unattempted'].map((s) => (
            <button key={s} className={`filter-btn filter-status ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="review-body">
        {filtered.length === 0 && (
          <div className="review-empty-state">No questions match the selected filters.</div>
        )}
        {filtered.map((q, idx) => {
          const resp = q.userResponse
          const userAnswer = resp?.selected_option || resp?.tita_answer || ''
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
                    <span className={`diff-badge diff-${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
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
                    <span className={userAnswer ? (status === 'Correct' ? 'correct' : 'wrong') : 'unattempted'}>{userAnswer || '—'}</span>
                  </div>
                  <div className="tita-row">
                    <span>Correct answer:</span>
                    <span className="correct">{q.correct_answer}</span>
                  </div>
                </div>
              )}

              {/* Per-question analytics bar */}
              {(() => {
                const a = analytics[q.id]
                const idealSec = IDEAL_TIME[q.difficulty] || IDEAL_TIME.Medium
                const timeSpent = a?.time_spent_seconds || 0
                const timeRatio = timeSpent > 0 ? timeSpent / idealSec : 0
                const timeStatus = timeSpent === 0 ? 'none' : timeRatio <= 1 ? 'fast' : timeRatio <= 1.5 ? 'ok' : 'slow'

                return (
                  <div className="qa-analytics-bar">
                    <div className="qa-analytics-item">
                      <span className="qa-analytics-label">Time Spent</span>
                      <span className={`qa-analytics-value ${timeStatus}`}>{fmtTime(timeSpent)}</span>
                    </div>
                    <div className="qa-analytics-divider" />
                    <div className="qa-analytics-item">
                      <span className="qa-analytics-label">Ideal Time</span>
                      <span className="qa-analytics-value ideal">{fmtTime(idealSec)}</span>
                    </div>
                    <div className="qa-analytics-divider" />
                    <div className="qa-analytics-item">
                      <span className="qa-analytics-label">Difficulty</span>
                      <span className={`qa-analytics-value diff-${(q.difficulty || 'Medium').toLowerCase()}`}>{q.difficulty || 'Medium'}</span>
                    </div>
                    <div className="qa-analytics-divider" />
                    <div className="qa-analytics-item">
                      <span className="qa-analytics-label">Marks</span>
                      <span className={`qa-analytics-value ${status === 'Correct' ? 'fast' : status === 'Wrong' ? 'slow' : 'none'}`}>
                        {status === 'Correct' ? '+3' : status === 'Wrong' ? (q.question_type === 'TITA' ? '0' : '-1') : '0'}
                      </span>
                    </div>
                    {timeSpent > 0 && timeRatio > 1.5 && (
                      <div className="qa-analytics-tip">You spent {Math.round((timeRatio - 1) * 100)}% more time than ideal. Practice similar questions to improve speed.</div>
                    )}
                  </div>
                )
              })()}

              <button className="btn-solution-toggle" onClick={() => toggleSolution(q.id)}>
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
