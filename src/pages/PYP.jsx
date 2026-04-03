import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getPaperById } from '../data/pypIndex'
import './PYP.css'

const SECTIONS = ['VARC', 'DILR', 'QA']
const SECTION_LABELS = { VARC: 'Verbal Ability', DILR: 'DI & LR', QA: 'Quantitative' }
const SLOT_LABELS = ['I', 'II', 'III']

async function loadPaper(paperId) {
  const base = import.meta.env.BASE_URL || '/'
  const url = `${base}data/pyp/${paperId}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${paperId}`)
  return res.json()
}

export default function PYP() {
  const { paperId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [paper, setPaper] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const initSection = searchParams.get('section') || 'VARC'
  const initQ = parseInt(searchParams.get('q') || '0', 10)

  const [activeSection, setActiveSection] = useState(initSection)
  const [activeIndex, setActiveIndex] = useState(initQ)
  const [revealed, setRevealed] = useState({})   // { "qid": true }
  const [userAnswers, setUserAnswers] = useState({}) // { "qid": "A" }

  useEffect(() => {
    setLoading(true)
    setError(null)
    loadPaper(paperId)
      .then(setPaper)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [paperId])

  const questions = paper?.sections?.[activeSection]?.questions || []
  const currentQ = questions[activeIndex] || null

  const switchSection = (sec) => {
    setActiveSection(sec)
    setActiveIndex(0)
    setSearchParams({ section: sec, q: 0 })
  }

  const goToQuestion = (idx) => {
    setActiveIndex(idx)
    setSearchParams({ section: activeSection, q: idx })
  }

  const revealAnswer = () => {
    if (!currentQ) return
    setRevealed(r => ({ ...r, [currentQ.id]: true }))
  }

  const selectAnswer = (opt) => {
    if (!currentQ) return
    setUserAnswers(a => ({ ...a, [currentQ.id]: opt }))
  }

  const isRevealed = currentQ ? revealed[currentQ.id] : false
  const userAnswer = currentQ ? userAnswers[currentQ.id] : null

  const sectionStats = (sec) => {
    if (!paper) return { total: 0, answered: 0, correct: 0 }
    const qs = paper.sections[sec]?.questions || []
    const answered = qs.filter(q => userAnswers[q.id]).length
    const correct = qs.filter(q => revealed[q.id] && userAnswers[q.id] === q.correct_answer).length
    return { total: qs.length, answered, correct }
  }

  if (loading) {
    return (
      <div className="pyp-loading">
        <div className="pyp-spinner" />
        <p>Loading paper...</p>
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="pyp-error">
        <p>Could not load paper. {error}</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    )
  }

  const meta = getPaperById(paperId)

  return (
    <div className="pyp-page">
      {/* ── Header ── */}
      <header className="pyp-header">
        <button className="pyp-back" onClick={() => navigate('/')}>← Home</button>
        <div className="pyp-header-title">
          <h1>{paper.title}</h1>
          <span className="pyp-badge">{paper.total_questions} Questions</span>
          {paper.has_solutions && <span className="pyp-badge pyp-badge-green">Solutions Included</span>}
        </div>
        <div className="pyp-header-progress">
          {SECTIONS.map(s => {
            const st = sectionStats(s)
            return st.total > 0 ? (
              <div key={s} className="pyp-progress-pill">
                <span className="pyp-progress-label">{s}</span>
                <span className="pyp-progress-val">{st.answered}/{st.total}</span>
              </div>
            ) : null
          })}
        </div>
      </header>

      <div className="pyp-body">
        {/* ── Sidebar: Section tabs + Question list ── */}
        <aside className="pyp-sidebar">
          {/* Section tabs */}
          <div className="pyp-section-tabs">
            {SECTIONS.map(sec => {
              const qs = paper.sections[sec]?.questions || []
              if (qs.length === 0) return null
              return (
                <button
                  key={sec}
                  className={`pyp-tab ${activeSection === sec ? 'active' : ''}`}
                  onClick={() => switchSection(sec)}
                >
                  <span className="pyp-tab-label">{SECTION_LABELS[sec]}</span>
                  <span className="pyp-tab-count">{qs.length}Q</span>
                </button>
              )
            })}
          </div>

          {/* Question palette */}
          <div className="pyp-palette">
            {questions.map((q, idx) => {
              const ans = userAnswers[q.id]
              const rev = revealed[q.id]
              let cls = 'pyp-palette-btn'
              if (ans && rev) cls += q.correct_answer && ans === q.correct_answer ? ' correct' : ' wrong'
              else if (ans) cls += ' attempted'
              if (idx === activeIndex) cls += ' active'
              return (
                <button key={q.id} className={cls} onClick={() => goToQuestion(idx)}>
                  {q.number}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="pyp-legend">
            <span className="legend-dot attempted" />Not revealed
            <span className="legend-dot correct" />Correct
            <span className="legend-dot wrong" />Wrong
          </div>
        </aside>

        {/* ── Main: Question content ── */}
        <main className="pyp-main">
          {currentQ ? (
            <div className="pyp-question-card">
              {/* Question header */}
              <div className="pyp-q-header">
                <span className="pyp-q-number">Q{currentQ.number}</span>
                <span className={`pyp-q-type ${currentQ.type === 'TITA' ? 'tita' : 'mcq'}`}>
                  {currentQ.type}
                </span>
                {currentQ.directions && (
                  <span className="pyp-q-directions">{currentQ.directions.slice(0, 80)}{currentQ.directions.length > 80 ? '…' : ''}</span>
                )}
              </div>

              {/* Passage (if any) */}
              {currentQ.passage && (
                <div className="pyp-passage">
                  <div className="pyp-passage-label">Passage</div>
                  <div className="pyp-passage-text">{currentQ.passage}</div>
                </div>
              )}

              {/* Question text */}
              <div className="pyp-q-text">{currentQ.question}</div>

              {/* Options */}
              {currentQ.type === 'MCQ' && Object.keys(currentQ.options).length > 0 && (
                <div className="pyp-options">
                  {Object.entries(currentQ.options).map(([key, val]) => {
                    let cls = 'pyp-option'
                    if (userAnswer === key) cls += ' selected'
                    if (isRevealed) {
                      if (key === currentQ.correct_answer) cls += ' correct'
                      else if (userAnswer === key) cls += ' wrong'
                    }
                    return (
                      <button key={key} className={cls} onClick={() => !isRevealed && selectAnswer(key)}>
                        <span className="pyp-opt-key">{key}</span>
                        <span className="pyp-opt-val">{val}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* TITA answer area */}
              {currentQ.type === 'TITA' && (
                <div className="pyp-tita">
                  <input
                    type="text"
                    placeholder="Your answer..."
                    value={userAnswer || ''}
                    onChange={e => selectAnswer(e.target.value)}
                    disabled={isRevealed}
                    className="pyp-tita-input"
                  />
                  {isRevealed && currentQ.correct_answer && (
                    <div className="pyp-tita-answer">
                      Correct Answer: <strong>{currentQ.correct_answer}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Reveal button + explanation */}
              <div className="pyp-reveal-area">
                {!isRevealed ? (
                  <button className="pyp-reveal-btn" onClick={revealAnswer}>
                    Reveal Answer & Explanation
                  </button>
                ) : (
                  <div className="pyp-answer-block">
                    {currentQ.type === 'MCQ' && currentQ.correct_answer && (
                      <div className="pyp-correct-answer">
                        Correct Answer: <strong>{currentQ.correct_answer}</strong>
                        {currentQ.options[currentQ.correct_answer] && (
                          <span> — {currentQ.options[currentQ.correct_answer]}</span>
                        )}
                      </div>
                    )}
                    {currentQ.explanation && (
                      <div className="pyp-explanation">
                        <div className="pyp-expl-label">Explanation</div>
                        <div className="pyp-expl-text">{currentQ.explanation}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="pyp-nav">
                <button
                  className="pyp-nav-btn"
                  onClick={() => goToQuestion(activeIndex - 1)}
                  disabled={activeIndex === 0}
                >
                  ← Previous
                </button>
                <span className="pyp-nav-position">{activeIndex + 1} / {questions.length}</span>
                <button
                  className="pyp-nav-btn"
                  onClick={() => goToQuestion(activeIndex + 1)}
                  disabled={activeIndex === questions.length - 1}
                >
                  Next →
                </button>
              </div>
            </div>
          ) : (
            <div className="pyp-empty">Select a question from the sidebar.</div>
          )}
        </main>
      </div>
    </div>
  )
}
