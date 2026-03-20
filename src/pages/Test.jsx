import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QuestionCard from '../components/QuestionCard'
import QuestionPalette from '../components/QuestionPalette'
import SectionTabs from '../components/SectionTabs'
import Timer from '../components/Timer'
import Calculator from '../components/Calculator'
import { loadSession, saveSession, saveResult } from '../utils/storage'
import { calculateScore } from '../utils/scoring'
import testData from '../data/test1.json'
import './Test.css'

const SECTIONS = ['VARC', 'DILR', 'QA']
const SECTION_TIME = 2400 // 40 minutes in seconds

function getAllQuestions(data) {
  const all = []
  SECTIONS.forEach((s) => {
    const qs = data.sections[s]?.questions || []
    all.push(...qs)
  })
  return all
}

function getSectionQuestions(data, section) {
  return data.sections[section]?.questions || []
}

export default function Test() {
  const { testId } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(() => {
    const saved = loadSession(testId)
    return saved || {
      testId: Number(testId),
      currentSection: 'VARC',
      currentQuestionIndex: 0,
      varc_time_remaining: SECTION_TIME,
      dilr_time_remaining: SECTION_TIME,
      qa_time_remaining: SECTION_TIME,
      answers: {},
    }
  })

  const [showCalc, setShowCalc] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const timerRef = useRef(null)

  const currentSection = session.currentSection
  const currentIndex = session.currentQuestionIndex
  const answers = session.answers

  const sectionQuestions = getSectionQuestions(testData, currentSection)
  const currentQuestion = sectionQuestions[currentIndex]

  const timeKey = `${currentSection.toLowerCase()}_time_remaining`
  const timeLeft = session[timeKey] ?? SECTION_TIME

  const completedSections = SECTIONS.filter((s) => {
    const idx = SECTIONS.indexOf(s)
    const curIdx = SECTIONS.indexOf(currentSection)
    return idx < curIdx
  })

  // Save session to localStorage periodically
  const saveRef = useRef(session)
  saveRef.current = session

  useEffect(() => {
    const interval = setInterval(() => {
      saveSession(testId, saveRef.current)
    }, 10000)
    return () => clearInterval(interval)
  }, [testId])

  // Tick timer every second
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSession((prev) => {
        const key = `${prev.currentSection.toLowerCase()}_time_remaining`
        const newTime = Math.max(0, (prev[key] ?? SECTION_TIME) - 1)
        return { ...prev, [key]: newTime }
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const handleSectionExpire = useCallback(() => {
    const curIdx = SECTIONS.indexOf(currentSection)
    if (curIdx < SECTIONS.length - 1) {
      const nextSection = SECTIONS[curIdx + 1]
      setSession((prev) => {
        const updated = { ...prev, currentSection: nextSection, currentQuestionIndex: 0 }
        saveSession(testId, updated)
        return updated
      })
    } else {
      handleSubmitTest()
    }
  }, [currentSection, testId])

  function updateSession(updates) {
    setSession((prev) => {
      const updated = { ...prev, ...updates }
      return updated
    })
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
        saveSession(testId, updated)
        return updated
      })
      setConfirmSubmit(false)
    } else {
      handleSubmitTest()
    }
  }

  function handleSubmitTest() {
    clearInterval(timerRef.current)
    const allQuestions = getAllQuestions(testData)
    const finalSession = saveRef.current
    const score = calculateScore(finalSession.answers, allQuestions)
    const result = {
      testId: Number(testId),
      submittedAt: Date.now(),
      score,
      answers: finalSession.answers,
      timings: {
        varc: SECTION_TIME - (finalSession.varc_time_remaining ?? 0),
        dilr: SECTION_TIME - (finalSession.dilr_time_remaining ?? 0),
        qa: SECTION_TIME - (finalSession.qa_time_remaining ?? 0),
      },
    }
    saveResult(testId, result)
    navigate(`/results/${testId}`)
  }

  if (!currentQuestion) {
    return <div className="test-loading">Loading test...</div>
  }

  return (
    <div className="test-page">
      {/* Top bar */}
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

      {/* Main content */}
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
