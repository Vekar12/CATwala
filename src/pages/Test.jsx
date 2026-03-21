import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QuestionCard from '../components/QuestionCard'
import QuestionPalette from '../components/QuestionPalette'
import SectionTabs from '../components/SectionTabs'
import Timer from '../components/Timer'
import Calculator from '../components/Calculator'
import { loadSession, saveSession } from '../utils/storage'
import { supabase } from '../lib/supabase'
import './Test.css'

const SECTIONS = ['VARC', 'DILR', 'QA']
const SECTION_TIME = 2400

function getSectionQuestions(testData, section) {
  return testData?.sections?.[section]?.questions || []
}

export default function Test() {
  const { testId } = useParams()
  const navigate = useNavigate()

  const [testData, setTestData] = useState(null)
  const [session, setSession] = useState(null)
  const [showCalc, setShowCalc] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
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

      let testDataResult

      // Check if this is a random test
      if (testId === 'random') {
        const stored = sessionStorage.getItem('randomTest')
        if (!stored) {
          navigate('/')
          return
        }
        testDataResult = JSON.parse(stored)
      } else {
        const resp = await supabase.functions.invoke('get-questions', {
          body: { testId: Number(testId) },
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        })

        if (resp.error) {
          console.error('Failed to load questions:', resp.error)
          navigate('/')
          return
        }

        testDataResult = resp.data
      }

      setTestData(testDataResult)

      // Build question -> section lookup
      const qSections = {}
      for (const sec of SECTIONS) {
        const qs = testDataResult?.sections?.[sec]?.questions || []
        for (const q of qs) {
          qSections[q.id] = sec
        }
      }
      questionSectionsRef.current = qSections

      // For random tests, create a local session (no DB)
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

  // Keep saveRef in sync
  useEffect(() => {
    if (session) {
      saveRef.current = { ...session, _questionSections: questionSectionsRef.current }
    }
  }, [session])

  // Auto-save every 10 seconds (skip for random tests)
  useEffect(() => {
    if (!session || session.isRandom) return
    autoSaveRef.current = setInterval(() => {
      if (saveRef.current) saveSession(testId, saveRef.current)
    }, 10000)
    return () => clearInterval(autoSaveRef.current)
  }, [testId, session?.attemptId])

  // Warn before closing tab
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
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

  const completedSections = SECTIONS.filter((s) => {
    return SECTIONS.indexOf(s) < SECTIONS.indexOf(currentSection)
  })

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

  function handleAnswerChange(value) {
    const qId = currentQuestion.id
    const existing = answers[qId] || {}
    const newAnswers = {
      ...answers,
      [qId]: { ...existing, selected: value, status: existing.status === 'marked' ? 'answered_marked' : 'answered' },
    }
    updateSession({ answers: newAnswers })
  }

  function handleSaveNext() {
    const qId = currentQuestion.id
    const existing = answers[qId] || {}
    const hasAnswer = existing.selected && existing.selected !== ''
    const newStatus = existing.marked_for_review ? 'answered_marked' : (hasAnswer ? 'answered' : 'not_answered')
    const newAnswers = {
      ...answers,
      [qId]: { ...existing, status: hasAnswer ? newStatus : 'not_answered' },
    }
    const nextIndex = Math.min(currentIndex + 1, sectionQuestions.length - 1)
    const nextQId = sectionQuestions[nextIndex].id
    if (!newAnswers[nextQId]) {
      newAnswers[nextQId] = { status: 'not_answered' }
    }
    updateSession({ answers: newAnswers, currentQuestionIndex: nextIndex })
  }

  function handleMarkReview() {
    const qId = currentQuestion.id
    const existing = answers[qId] || {}
    const hasAnswer = existing.selected && existing.selected !== ''
    const newStatus = hasAnswer ? 'answered_marked' : 'marked'
    const newAnswers = {
      ...answers,
      [qId]: { ...existing, status: newStatus, marked_for_review: true },
    }
    const nextIndex = Math.min(currentIndex + 1, sectionQuestions.length - 1)
    const nextQId = sectionQuestions[nextIndex].id
    if (!newAnswers[nextQId]) {
      newAnswers[nextQId] = { status: 'not_answered' }
    }
    updateSession({ answers: newAnswers, currentQuestionIndex: nextIndex })
  }

  function handleClearResponse() {
    const qId = currentQuestion.id
    const existing = answers[qId] || {}
    const newAnswers = {
      ...answers,
      [qId]: { ...existing, selected: '', status: 'not_answered', marked_for_review: false },
    }
    updateSession({ answers: newAnswers })
  }

  function handlePaletteNavigate(index) {
    const qId = sectionQuestions[index].id
    const newAnswers = { ...answers }
    if (!newAnswers[qId]) {
      newAnswers[qId] = { status: 'not_answered' }
    }
    updateSession({ answers: newAnswers, currentQuestionIndex: index })
  }

  function handleSectionSubmit() {
    const curIdx = SECTIONS.indexOf(currentSection)
    if (curIdx < SECTIONS.length - 1) {
      if (!confirmSubmit) {
        setConfirmSubmit(true)
        return
      }
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

    // For random tests, just go back to home (no DB submission)
    if (saveRef.current?.isRandom) {
      alert('Practice test completed! Your answers have been recorded locally.')
      sessionStorage.removeItem('randomTest')
      navigate('/')
      return
    }

    // Save final state first
    if (saveRef.current) {
      await saveSession(testId, saveRef.current)
    }

    // Call submit-test Edge Function
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession) {
      navigate('/login')
      return
    }
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

  return (
    <div className="test-page">
      <div className="test-topbar">
        <div className="topbar-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <SectionTabs currentSection={currentSection} completedSections={completedSections} />
        <div className="topbar-right">
          <button className="calc-toggle" onClick={() => setShowCalc(!showCalc)}>
            🔢 Calculator
          </button>
          <Timer secondsLeft={timeLeft} onExpire={handleSectionExpire} />
        </div>
      </div>

      <div className="test-main">
        <div className="test-left">
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={sectionQuestions.length}
            section={currentSection}
            answer={answers[currentQuestion.id]}
            onAnswerChange={handleAnswerChange}
          />
          <div className="test-action-bar">
            <div className="action-left">
              <button className="btn-action btn-mark" onClick={handleMarkReview}>
                Mark for Review & Next
              </button>
              <button className="btn-action btn-clear" onClick={handleClearResponse}>
                Clear Response
              </button>
            </div>
            <button className="btn-action btn-save" onClick={handleSaveNext}>
              Save & Next
            </button>
          </div>
        </div>

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

      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}

      {confirmSubmit && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>Submit Section?</h3>
            <p>Are you sure you want to submit the current section and move to the next? You cannot return to this section.</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmSubmit(false)}>Cancel</button>
              <button className="btn-confirm" onClick={handleSectionSubmit}>Yes, Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
