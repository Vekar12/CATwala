import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QuestionCard from '../components/QuestionCard'
import QuestionPalette from '../components/QuestionPalette'
import Calculator from '../components/Calculator'
import { loadSession, saveSession } from '../utils/storage'
import { supabase } from '../lib/supabase'
import './Test.css'

const SECTIONS = ['VARC', 'DILR', 'QA']
const SECTION_TIME = 2400

const IIM_LOGOS = [
  'IIM-A', 'IIM-B', 'IIM-C', 'IIM-L', 'IIM-K', 'IIM-I', 'IIM-Ko',
  'IIM-S', 'IIM-T', 'IIM-R', 'IIM-U', 'IIM-V', 'IIM-Bo', 'IIM-J',
  'IIM-N', 'IIM-Am', 'IIM-Si', 'IIM-Sc',
]

const PALETTE_BASE = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '32px', height: '32px', fontWeight: 'bold', fontSize: '0.85rem',
  flexShrink: 0, fontFamily: 'Arial, sans-serif',
}
const PALETTE_STYLES = {
  not_visited:     { ...PALETTE_BASE, background: '#fff', border: '1px solid #888', borderRadius: '4px', color: '#000' },
  not_answered:    { ...PALETTE_BASE, background: '#d84040', color: '#fff', clipPath: 'polygon(0% 0%, 100% 0%, 100% 68%, 50% 100%, 0% 68%)' },
  answered:        { ...PALETTE_BASE, background: '#3a8a3a', color: '#fff', clipPath: 'polygon(0% 0%, 100% 0%, 100% 68%, 50% 100%, 0% 68%)' },
  marked:          { ...PALETTE_BASE, background: '#7b3fa0', color: '#fff', borderRadius: '50%' },
  answered_marked: { ...PALETTE_BASE, background: '#9b59c0', color: '#fff', borderRadius: '50%' },
  marked_eval:     { ...PALETTE_BASE, background: '#4a2070', color: '#fff', borderRadius: '50%' },
}

function PaletteSymbol({ type, number }) {
  return <span style={PALETTE_STYLES[type]}>{number}</span>
}

function getSectionQuestions(testData, section) {
  return testData?.sections?.[section]?.questions || []
}

function getStatus(qId, answers) {
  const ans = answers[qId]
  if (!ans) return 'not_visited'
  if (ans.status === 'answered_marked') return 'answered_marked'
  if (ans.status === 'marked') return 'marked'
  if (ans.status === 'answered') return 'answered'
  return 'not_answered'
}

/* ─── Instructions Modal ─── */
function InstructionsModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-instructions" onClick={(e) => e.stopPropagation()}>

        {/* Blue header bar */}
        <div className="modal-title-bar">
          <span>Instructions</span>
          <button className="modal-close" onClick={onClose}>Close ✕</button>
        </div>

        {/* Scrollable body */}
        <div className="modal-inst-body">
          <p className="modal-timer-warning">Note that the timer is ticking. Kindly close this window to attend to the questions.</p>
          <p className="modal-inst-sub-heading">Instructions</p>

          <p className="modal-please-read">Please read the instructions carefully</p>

          <p className="modal-section-heading">General Instructions:</p>
          <ol className="modal-inst-ol">
            <li>Total duration of examination is 120 minutes.</li>
            <li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time available for you to complete the examination. When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination.</li>
            <li>
              The Question Palette displayed on the right side of screen will show the status of each question using one of the following symbols:
              <div className="modal-palette-legend">
                <div className="modal-palette-row"><PaletteSymbol type="not_visited" number="1" /><span>You have not visited the question yet.</span></div>
                <div className="modal-palette-row"><PaletteSymbol type="not_answered" number="2" /><span>You have not answered the question.</span></div>
                <div className="modal-palette-row"><PaletteSymbol type="answered" number="3" /><span>You have answered the question.</span></div>
                <div className="modal-palette-row"><PaletteSymbol type="marked" number="4" /><span>You have NOT answered the question, but have marked the question for review.</span></div>
                <div className="modal-palette-row"><PaletteSymbol type="answered_marked" number="5" /><span>The question(s) "Answered and Marked for Review" will be considered for evaluation.</span></div>
                <div className="modal-palette-row"><PaletteSymbol type="marked_eval" number="6" /><span>The question(s) "Marked for Review" will be not be considered for evaluation. Hence, no marks will be allocated for the same.</span></div>
              </div>
              <p className="modal-palette-note">The Marked for Review status for a question simply indicates that you would like to look at that question again.</p>
            </li>
            <li>You can click on the "&gt;" arrow which appears to the left of question palette to collapse the question palette thereby maximizing the question window. To view the question palette again, you can click on "&lt;" which appears on the right side of question window.</li>
            <li>You can click on your "Profile" image on top right corner of your screen to change the language during the exam for entire question paper. On clicking of Profile image you will get a drop-down to change the question content to the desired language.</li>
            <li>You can click on <span className="modal-arrow-icon">↓</span> to navigate to the bottom and <span className="modal-arrow-icon">↑</span> to navigate to the top of the question area, without scrolling.</li>
          </ol>

          <p className="modal-section-heading">Navigating to a Question:</p>
          <ol className="modal-inst-ol" start={7}>
            <li>
              To answer a question, do the following:
              <ol className="modal-inst-ol-alpha">
                <li>Click on the question number in the Question Palette at the right of your screen to go to that numbered question directly. Note that using this option does NOT save your answer to the current question.</li>
                <li>Click on <strong>Save &amp; Next</strong> to save your answer for the current question and then go to the next question.</li>
                <li>Click on <strong>Mark for Review &amp; Next</strong> to save your answer for the current question, mark it for review, and then go to the next question.</li>
              </ol>
            </li>
          </ol>

          <p className="modal-section-heading">Answering a Question :</p>
          <ol className="modal-inst-ol" start={8}>
            <li>
              Procedure for answering a multiple choice type question:
              <ol className="modal-inst-ol-alpha">
                <li>To select your answer, click on the button of one of the options</li>
                <li>To deselect your chosen answer, click on the button of the chosen option again or click on the <strong>Clear Response</strong> button</li>
                <li>To change your chosen answer, click on the button of another option</li>
                <li>To save your answer, you MUST click on the <strong>Save &amp; Next</strong> button</li>
                <li>To mark the question for review, click on the <strong>Mark for Review &amp; Next</strong> button.</li>
              </ol>
            </li>
            <li>To change your answer to a question that has already been answered, first select that question for answering and then follow the procedure for answering that type of question.</li>
          </ol>

          <p className="modal-section-heading">Navigating through sections:</p>
          <ol className="modal-inst-ol" start={10}>
            <li>Sections in this question paper are displayed on the top bar of the screen. Questions in a section can be viewed by clicking on the section name. The section you are currently viewing is highlighted.</li>
            <li>After clicking the Save &amp; Next button on the last question for a section, you will automatically be taken to the first question of the next section.</li>
            <li>You can shuffle between sections and questions anytime during the examination as per your convenience only during the time stipulated.</li>
            <li>Candidate can view the corresponding section summary as part of the legend that appears in every section above the question palette.</li>
          </ol>

          <p className="modal-other-heading">Other Important Instructions</p>

          <ol className="modal-inst-ol">
            <li>To login, enter your registration number and password following instructions provided to you by the invigilator.</li>
            <li>Go through the various symbols used in the test and understand their meaning before you start the test.</li>
            <li>
              The question paper consists of 3 (three) sections:
              <table className="modal-inst-table">
                <thead><tr><th>Section</th><th>Test</th></tr></thead>
                <tbody>
                  <tr><td>I</td><td>Verbal Ability and Reading Comprehension (VARC)</td></tr>
                  <tr><td>II</td><td>Data Interpretation and Logical Reasoning (DILR)</td></tr>
                  <tr><td>III</td><td>Quantitative Ability (QA)</td></tr>
                </tbody>
              </table>
            </li>
            <li>For the Data Interpretation and Logical Reasoning (DILR) section, each situation/scenario consists of a group of four or six questions. Similarly, for Reading Comprehension, each passage consists of a group of 4 questions.</li>
            <li>For an <strong>MCQ</strong>, a candidate will be given <strong>3 (three) marks for a correct answer, -1 (minus one) mark for a wrong answer and a 0 (zero) mark for an un-attempted question</strong>.</li>
            <li>For a <strong>Non-MCQ</strong>, a candidate will be given <strong>3 (three) marks for a correct answer, and a 0 (zero) mark for a wrong answer and for an un-attempted question</strong>. There will be <strong>no negative mark for a wrong answer in a Non-MCQ</strong>.</li>
            <li>An MCQ will have choices out of which only one will be the correct answer. You will have to choose the correct answer by clicking on the radio button placed just before the option. For a Non-MCQ, you will have to enter the answer in the space provided on the screen.</li>
            <li>Your answers will be updated and saved on a server periodically. The test will end automatically at the end of <strong>120 minutes</strong>. The time allotted for each section will be 40 minutes, after which you will not be allowed to go back to the earlier section(s).</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

/* ─── Question Paper Modal ─── */
function QuestionPaperModal({ testData, currentSection, onClose }) {
  const [activeSection, setActiveSection] = useState(currentSection)
  const questions = getSectionQuestions(testData, activeSection)

  // Group RC questions by passage
  const groups = []
  let i = 0
  while (i < questions.length) {
    const q = questions[i]
    if (q.passage) {
      const passage = q.passage
      const group = []
      while (i < questions.length && questions[i].passage === passage) {
        group.push(questions[i])
        i++
      }
      groups.push({ type: 'rc', passage, questions: group })
    } else {
      groups.push({ type: 'single', question: q })
      i++
    }
  }

  let qCounter = 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-qpaper" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title-bar">
          <span>Question Paper</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="qpaper-section-tabs">
          {SECTIONS.map((s) => (
            <button
              key={s}
              className={`qpaper-tab ${s === activeSection ? 'qpaper-tab-active' : ''}`}
              onClick={() => setActiveSection(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="qpaper-body">
          {groups.map((group, gi) => {
            if (group.type === 'rc') {
              return (
                <div key={gi} className="qpaper-rc-group">
                  <div className="qpaper-passage">{group.passage}</div>
                  {group.questions.map((q) => {
                    qCounter++
                    const num = qCounter
                    const isTITA = q.question_type === 'TITA'
                    return (
                      <div key={q.id} className="qpaper-question">
                        <div className="qpaper-q-meta">
                          <span className="qpaper-qnum">Q.{num}</span>
                          <span className="qpaper-marks">
                            <em>
                              Marks for correct answer: <span className="qpaper-marks-pos">3</span> ;{' '}
                              Negative Marks: <span className="qpaper-marks-neg">{isTITA ? '0' : '-1'}</span>
                            </em>
                          </span>
                        </div>
                        <div className="qpaper-qtext">{q.question_text}</div>
                        {!isTITA && (
                          <div className="qpaper-options">
                            {['A','B','C','D'].map((k) => q[`option_${k.toLowerCase()}`] && (
                              <div key={k} className="qpaper-option">
                                <span className="qpaper-opt-key">{k}.</span>
                                <span>{q[`option_${k.toLowerCase()}`]}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            } else {
              qCounter++
              const num = qCounter
              const q = group.question
              const isTITA = q.question_type === 'TITA'
              return (
                <div key={gi} className="qpaper-question">
                  <div className="qpaper-q-meta">
                    <span className="qpaper-qnum">Q.{num}</span>
                    <span className="qpaper-marks">
                      <em>
                        Marks for correct answer: <span className="qpaper-marks-pos">3</span> ;{' '}
                        Negative Marks: <span className="qpaper-marks-neg">{isTITA ? '0' : '-1'}</span>
                      </em>
                    </span>
                  </div>
                  <div className="qpaper-qtext">{q.question_text}</div>
                  {!isTITA && (
                    <div className="qpaper-options">
                      {['A','B','C','D'].map((k) => q[`option_${k.toLowerCase()}`] && (
                        <div key={k} className="qpaper-option">
                          <span className="qpaper-opt-key">{k}.</span>
                          <span>{q[`option_${k.toLowerCase()}`]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── Interruption Warning ─── */
function InterruptWarning({ count, onDismiss }) {
  return (
    <div className="interrupt-overlay">
      <div className="interrupt-dialog">
        <div className="interrupt-icon">⚠</div>
        <h3 className="interrupt-title">Warning!</h3>
        <p className="interrupt-msg">
          The system has recorded that you navigated away from the test window.
          Switching tabs, minimizing the browser, or using keyboard shortcuts like Alt+Tab
          is not permitted during the examination.
        </p>
        <p className="interrupt-count">
          Number of interruptions recorded: <strong>{count}</strong>
        </p>
        <p className="interrupt-note">
          Repeated instances may lead to cancellation of your test. Please close this popup
          and continue with the test without any interruptions.
        </p>
        <button className="interrupt-btn" onClick={onDismiss}>
          Close &amp; Continue
        </button>
      </div>
    </div>
  )
}

export default function Test() {
  const { testId } = useParams()
  const navigate = useNavigate()

  const [testData, setTestData] = useState(null)
  const [session, setSession] = useState(null)
  const [pendingAnswer, setPendingAnswer] = useState('')
  const [showCalc, setShowCalc] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [showQuestionPaper, setShowQuestionPaper] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [showInterruptWarning, setShowInterruptWarning] = useState(false)
  const [interruptCount, setInterruptCount] = useState(0)
  const [candidateName, setCandidateName] = useState('Candidate')

  const timerRef = useRef(null)
  const autoSaveRef = useRef(null)
  const saveRef = useRef(null)
  const questionSectionsRef = useRef({})

  // Load test data and session on mount
  useEffect(() => {
    async function init() {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) {
        navigate('/login')
        return
      }

      // Set candidate name
      const name = authSession.user?.user_metadata?.full_name
        || authSession.user?.email?.split('@')[0]
        || 'Candidate'
      setCandidateName(name)

      let testDataResult

      if (testId === 'random') {
        const stored = sessionStorage.getItem('randomTest')
        if (!stored) { navigate('/'); return }
        testDataResult = JSON.parse(stored)
      } else {
        const resp = await supabase.functions.invoke('get-questions', {
          body: { testId: Number(testId) },
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        })
        if (resp.error) { console.error('Failed to load questions:', resp.error); navigate('/'); return }
        testDataResult = resp.data
      }

      setTestData(testDataResult)

      const qSections = {}
      for (const sec of SECTIONS) {
        const qs = testDataResult?.sections?.[sec]?.questions || []
        for (const q of qs) { qSections[q.id] = sec }
      }
      questionSectionsRef.current = qSections

      if (testId === 'random') {
        setSession({
          attemptId: 'random_' + Date.now(),
          testId: 'random',
          currentSection: 'VARC',
          currentQuestionIndex: 0,
          varc_time_remaining: 2400,
          dilr_time_remaining: 2400,
          qa_time_remaining: 2400,
          answers: {},
          isRandom: true,
        })
        setPageLoading(false)
        return
      }

      const saved = await loadSession(testId)
      if (saved) {
        setSession(saved)
      } else {
        navigate(`/instructions/${testId}`)
        return
      }

      setPageLoading(false)
    }
    init()
  }, [testId, navigate])

  // Interruption detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setInterruptCount((c) => c + 1)
        setShowInterruptWarning(true)
      }
    }
    const handleBlur = () => {
      // Only trigger if no modal is open (avoids triggering on calc/modal focus)
      if (!document.hidden) {
        setInterruptCount((c) => c + 1)
        setShowInterruptWarning(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Keep saveRef in sync
  useEffect(() => {
    if (session) {
      saveRef.current = { ...session, _questionSections: questionSectionsRef.current }
    }
  }, [session])

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!session || session.isRandom) return
    autoSaveRef.current = setInterval(() => {
      if (saveRef.current) saveSession(testId, saveRef.current)
    }, 10000)
    return () => clearInterval(autoSaveRef.current)
  }, [testId, session?.attemptId])

  // Warn before closing tab
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Tick timer every second
  useEffect(() => {
    if (!session) return
    timerRef.current = setInterval(() => {
      setSession((prev) => {
        if (!prev) return prev
        const key = `${prev.currentSection.toLowerCase()}_time_remaining`
        const newTime = Math.max(0, (prev[key] ?? SECTION_TIME) - 1)
        return { ...prev, [key]: newTime }
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [session?.attemptId])

  const currentSection = session?.currentSection || 'VARC'
  const currentIndex = session?.currentQuestionIndex || 0
  const answers = session?.answers || {}

  const sectionQuestions = getSectionQuestions(testData, currentSection)
  const currentQuestion = sectionQuestions[currentIndex]

  const timeKey = `${currentSection.toLowerCase()}_time_remaining`
  const timeLeft = session?.[timeKey] ?? SECTION_TIME

  const mins = String(Math.floor(Math.max(0, timeLeft) / 60)).padStart(2, '0')
  const secs = String(Math.max(0, timeLeft) % 60).padStart(2, '0')
  const isTimerWarning = timeLeft <= 300

  // Reset pendingAnswer when question changes
  useEffect(() => {
    if (currentQuestion) {
      setPendingAnswer(answers[currentQuestion.id]?.selected || '')
    }
  }, [currentQuestion?.id])

  const completedSections = SECTIONS.filter((s) =>
    SECTIONS.indexOf(s) < SECTIONS.indexOf(currentSection)
  )

  const handleSectionExpire = useCallback(() => {
    const curIdx = SECTIONS.indexOf(currentSection)
    if (curIdx < SECTIONS.length - 1) {
      const nextSection = SECTIONS[curIdx + 1]
      setSession((prev) => {
        const updated = { ...prev, currentSection: nextSection, currentQuestionIndex: 0 }
        saveSession(testId, { ...updated, _questionSections: questionSectionsRef.current })
        return updated
      })
    } else {
      handleSubmitTest()
    }
  }, [currentSection, testId])

  function updateSession(updates) {
    setSession((prev) => ({ ...prev, ...updates }))
  }

  // Answer change only updates PENDING — not committed to session yet
  function handleAnswerChange(value) {
    setPendingAnswer(value)
  }

  // Save & Next: commits pendingAnswer to session.answers
  function handleSaveNext() {
    const qId = currentQuestion.id
    const existing = answers[qId] || {}
    const hasAnswer = pendingAnswer !== '' && pendingAnswer !== null && pendingAnswer !== undefined
    const isMarked = existing.marked_for_review
    const newStatus = hasAnswer
      ? (isMarked ? 'answered_marked' : 'answered')
      : 'not_answered'
    const newAnswers = {
      ...answers,
      [qId]: { ...existing, selected: hasAnswer ? pendingAnswer : '', status: newStatus },
    }
    const nextIndex = Math.min(currentIndex + 1, sectionQuestions.length - 1)
    const nextQId = sectionQuestions[nextIndex].id
    if (!newAnswers[nextQId]) newAnswers[nextQId] = { status: 'not_answered' }
    updateSession({ answers: newAnswers, currentQuestionIndex: nextIndex })
  }

  // Mark for Review & Next: commits pendingAnswer + marks
  function handleMarkReview() {
    const qId = currentQuestion.id
    const existing = answers[qId] || {}
    const hasAnswer = pendingAnswer !== '' && pendingAnswer !== null && pendingAnswer !== undefined
    const newStatus = hasAnswer ? 'answered_marked' : 'marked'
    const newAnswers = {
      ...answers,
      [qId]: { ...existing, selected: hasAnswer ? pendingAnswer : (existing.selected || ''), status: newStatus, marked_for_review: true },
    }
    const nextIndex = Math.min(currentIndex + 1, sectionQuestions.length - 1)
    const nextQId = sectionQuestions[nextIndex].id
    if (!newAnswers[nextQId]) newAnswers[nextQId] = { status: 'not_answered' }
    updateSession({ answers: newAnswers, currentQuestionIndex: nextIndex })
  }

  // Clear Response: clears pending selection only (not committed until Save & Next)
  function handleClearResponse() {
    setPendingAnswer('')
  }

  // Palette navigate: discards pending, jumps to question
  function handlePaletteNavigate(index) {
    const qId = sectionQuestions[index].id
    const newAnswers = { ...answers }
    if (!newAnswers[qId]) newAnswers[qId] = { status: 'not_answered' }
    updateSession({ answers: newAnswers, currentQuestionIndex: index })
    // pendingAnswer will reset via useEffect on currentQuestion.id change
  }

  function handleSectionSubmit() {
    const curIdx = SECTIONS.indexOf(currentSection)
    if (curIdx < SECTIONS.length - 1) {
      if (!confirmSubmit) { setConfirmSubmit(true); return }
      const nextSection = SECTIONS[curIdx + 1]
      setSession((prev) => {
        const updated = { ...prev, currentSection: nextSection, currentQuestionIndex: 0 }
        saveSession(testId, { ...updated, _questionSections: questionSectionsRef.current })
        return updated
      })
      setConfirmSubmit(false)
    } else {
      handleSubmitTest()
    }
  }

  async function handleSubmitTest() {
    clearInterval(timerRef.current)
    clearInterval(autoSaveRef.current)

    if (saveRef.current?.isRandom) {
      alert('Practice test completed! Your answers have been recorded locally.')
      sessionStorage.removeItem('randomTest')
      navigate('/')
      return
    }

    if (saveRef.current) await saveSession(testId, saveRef.current)

    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession) { navigate('/login'); return }

    const { error } = await supabase.functions.invoke('submit-test', {
      body: { attemptId: saveRef.current.attemptId },
      headers: { Authorization: `Bearer ${authSession.access_token}` },
    })

    if (error) {
      console.error('Submit error:', error)
      alert('Failed to submit test. Please try again.')
      return
    }

    navigate(`/results/${testId}`)
  }

  if (pageLoading || !currentQuestion) {
    return <div className="test-loading">Loading test...</div>
  }

  const isLastSection = SECTIONS.indexOf(currentSection) === SECTIONS.length - 1

  return (
    <div className="test-page">

      {/* ── White brand bar ── */}
      <div className="test-brand-bar">
        <div className="test-brand-text">{testData?.name || 'CATwala Mock CAT'}</div>
      </div>

      {/* ── IIM logos strip ── */}
      <div className="test-logos-strip">
        {IIM_LOGOS.map((logo) => (
          <span key={logo} className="test-logo-badge">{logo}</span>
        ))}
      </div>

      {/* ── Dark info bar: test name LEFT | buttons RIGHT ── */}
      <div className="test-info-bar">
        <div className="test-info-exam-name">{testData?.name || 'CATwala Mock CAT'}</div>
        <div className="test-info-btns">
          <button className="test-info-btn" onClick={() => setShowInstructions(true)}>
            <span className="info-btn-icon">ℹ</span> Instructions
          </button>
          <button className="test-info-btn test-info-btn-green" onClick={() => setShowQuestionPaper(true)}>
            <span className="info-btn-icon">▣</span> Question Paper
          </button>
        </div>
      </div>

      {/* ── Section tabs row: ‹ tabs › | calc | big avatar | name ── */}
      <div className="test-tabs-row">
        <div className="test-tabs-left">
          <button className="tabs-arrow">‹</button>
          {SECTIONS.map((s) => {
            const isActive = s === currentSection
            const isCompleted = completedSections.includes(s)
            return (
              <div
                key={s}
                className={`test-section-tab${isActive ? ' test-tab-active' : ''}${isCompleted ? ' test-tab-completed' : ''}`}
              >
                <span className="tab-label">{s}</span>
                <span className="tab-info" onClick={() => setShowInstructions(true)} title="Instructions">ℹ</span>
              </div>
            )
          })}
          <button className="tabs-arrow">›</button>
        </div>
        <div className="test-tabs-right">
          <button className="test-calc-btn" onClick={() => setShowCalc(!showCalc)} title="Calculator">
            🖩
          </button>
          <div className="test-avatar-large">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="64" height="64">
              <circle cx="50" cy="50" r="50" fill="#c0c8d4"/>
              <circle cx="50" cy="38" r="18" fill="#7a8799"/>
              <ellipse cx="50" cy="85" rx="28" ry="20" fill="#7a8799"/>
            </svg>
          </div>
          <span className="test-tabs-name">{candidateName}</span>
        </div>
      </div>

      {/* ── Sections row: "Sections" left | "Time Left : MM:SS" right ── */}
      <div className="test-sections-row">
        <span className="sections-lbl">Sections</span>
        <div className={`test-timer-inline${isTimerWarning ? ' test-timer-warning' : ''}`}>
          <span className="timer-lbl">Time Left :</span>
          <span className="timer-val">{mins}:{secs}</span>
        </div>
      </div>

      {/* ── Sub-section row: ‹ [VARC ⓘ] › ── */}
      <div className="test-subsection-row">
        <button className="subsec-arrow">‹</button>
        <div className="subsec-tab">
          <span>{currentSection}</span>
          <span className="subsec-info" onClick={() => setShowInstructions(true)}>ℹ</span>
        </div>
        <button className="subsec-arrow">›</button>
      </div>

      {/* ── Main body ── */}
      <div className="test-main">

        {/* Left: question */}
        <div className="test-left">
          <div className="test-question-area">
            <QuestionCard
              question={currentQuestion}
              questionNumber={currentIndex + 1}
              selectedOption={pendingAnswer}
              onAnswerChange={handleAnswerChange}
            />
          </div>

          {/* Action bar */}
          <div className="test-action-bar">
            <div className="action-left-btns">
              <button className="btn-mark-review" onClick={handleMarkReview}>
                Mark for Review &amp; Next
              </button>
              <button className="btn-clear-resp" onClick={handleClearResponse}>
                Clear Response
              </button>
            </div>
            <div className="action-right-btns">
              <button
                className="btn-previous"
                onClick={() => currentIndex > 0 && handlePaletteNavigate(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                Previous
              </button>
              <button className="btn-save-next" onClick={handleSaveNext}>
                Save &amp; Next
              </button>
              <button className="btn-submit-section" onClick={handleSectionSubmit}>
                Submit
              </button>
            </div>
          </div>
        </div>

        {/* Right: palette */}
        <div className="test-right">
          <QuestionPalette
            questions={sectionQuestions}
            sectionName={currentSection}
            answers={answers}
            currentIndex={currentIndex}
            onNavigate={handlePaletteNavigate}
            onSubmit={handleSectionSubmit}
            timeExpired={timeLeft === 0}
          />
        </div>
      </div>

      {/* ── Modals & Overlays ── */}
      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}

      {showInstructions && (
        <InstructionsModal onClose={() => setShowInstructions(false)} />
      )}

      {showQuestionPaper && testData && (
        <QuestionPaperModal
          testData={testData}
          currentSection={currentSection}
          onClose={() => setShowQuestionPaper(false)}
        />
      )}

      {showInterruptWarning && (
        <InterruptWarning
          count={interruptCount}
          onDismiss={() => setShowInterruptWarning(false)}
        />
      )}

      {confirmSubmit && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>Submit Section?</h3>
            <p>
              Are you sure you want to submit the current section and move to the next?
              You cannot return to this section.
            </p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmSubmit(false)}>Cancel</button>
              <button className="btn-confirm" onClick={handleSectionSubmit}>Yes, Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Version footer */}
      <div className="test-footer">Version : 1.0.0</div>
    </div>
  )
}
