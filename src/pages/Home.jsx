import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getUnlocks, getTests, getCompletedTests, getProfile, getUserAnalytics } from '../utils/storage'
import './Home.css'

const SECTIONS = ['VARC', 'DILR', 'QA']
const MOTIVATIONAL = [
  "Every mock test brings you closer to your dream IIM.",
  "Consistency beats intensity. Keep showing up.",
  "Your only competition is yesterday's you.",
  "CAT rewards strategy, not just speed.",
  "One section at a time. One question at a time.",
]

function getDaysLeft(catDate) {
  if (!catDate) return null
  const diff = Math.ceil((new Date(catDate) - new Date()) / (1000 * 60 * 60 * 24))
  return diff >= 0 ? diff : 0
}

function getStudyPlan(daysLeft, completedCount, totalTests) {
  if (!daysLeft || daysLeft <= 0) return null
  const testsLeft = totalTests - completedCount
  if (testsLeft <= 0) return { phase: 'Done', message: "You've completed all available tests! Revise weak areas." }

  const testsPerWeek = Math.max(1, Math.ceil(testsLeft / Math.max(1, Math.floor(daysLeft / 7))))

  if (daysLeft > 90) {
    return { phase: 'Foundation', message: `Focus on concepts first. Aim for ${testsPerWeek} test/week. You have plenty of time.`, testsPerWeek }
  } else if (daysLeft > 45) {
    return { phase: 'Practice', message: `Ramp up practice. Take ${testsPerWeek} tests/week and review every mistake.`, testsPerWeek }
  } else if (daysLeft > 14) {
    return { phase: 'Intensive', message: `Full mock test mode. Take ${testsPerWeek} tests/week. Focus on time management.`, testsPerWeek }
  } else {
    return { phase: 'Final Sprint', message: `Last ${daysLeft} days! Take 1 test every 2 days. Review only weak areas. Stay calm.`, testsPerWeek: Math.ceil(daysLeft / 2) }
  }
}

export default function Home() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [tests, setTests] = useState([])
  const [unlocks, setUnlocks] = useState([])
  const [completed, setCompleted] = useState([])
  const [profile, setProfile] = useState(null)
  const [analytics, setAnalytics] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [testList, unlockList, completedList, prof, analyticsData] = await Promise.all([
        getTests(),
        getUnlocks(),
        getCompletedTests(),
        getProfile(),
        getUserAnalytics(),
      ])
      setTests(testList)
      setUnlocks(unlockList)
      setCompleted(completedList)
      setProfile(prof)
      setAnalytics(analyticsData || [])
      setLoading(false)
    }
    load()
  }, [])

  const isCompleted = (n) => completed.includes(n)
  const isUnlocked = (n) => n === 1 || unlocks.includes(n - 1)

  const userName = profile?.first_name || user?.email?.split('@')[0] || 'there'
  const daysLeft = getDaysLeft(profile?.cat_exam_date)
  const motivation = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]
  const completedCount = completed.length
  const nextTest = tests.find(t => isUnlocked(t.id) && !isCompleted(t.id))

  const studyPlan = useMemo(() =>
    getStudyPlan(daysLeft, completedCount, tests.length),
    [daysLeft, completedCount, tests.length]
  )

  // Section-wise accuracy from analytics
  const sectionStats = useMemo(() => {
    const stats = {}
    for (const s of SECTIONS) {
      const sectionData = analytics.filter(a => a.section === s)
      const attempted = sectionData.filter(a => a.is_attempted)
      const correct = attempted.filter(a => a.is_correct)
      stats[s] = {
        total: sectionData.length,
        attempted: attempted.length,
        correct: correct.length,
        accuracy: attempted.length > 0 ? Math.round((correct.length / attempted.length) * 100) : null,
      }
    }
    return stats
  }, [analytics])

  // Weak topics
  const weakTopics = useMemo(() => {
    const topicMap = {}
    for (const a of analytics) {
      if (!a.topic) continue
      if (!topicMap[a.topic]) topicMap[a.topic] = { correct: 0, attempted: 0, section: a.section }
      if (a.is_attempted) {
        topicMap[a.topic].attempted++
        if (a.is_correct) topicMap[a.topic].correct++
      }
    }
    return Object.entries(topicMap)
      .filter(([, v]) => v.attempted >= 2 && (v.correct / v.attempted) < 0.5)
      .sort((a, b) => (a[1].correct / a[1].attempted) - (b[1].correct / b[1].attempted))
      .slice(0, 3)
      .map(([topic, v]) => ({ topic, accuracy: Math.round((v.correct / v.attempted) * 100), section: v.section }))
  }, [analytics])

  if (loading) {
    return <div className="home"><p style={{ textAlign: 'center', padding: '2rem' }}>Loading...</p></div>
  }

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <p className="home-tagline">India's most realistic CAT mock test</p>
        <div className="home-header-right">
          <Link to="/analytics" className="header-link">Analytics</Link>
          <button onClick={() => navigate('/profile')} className="header-btn">Profile</button>
          <button onClick={signOut} className="header-btn">Logout</button>
        </div>
      </header>

      <main className="home-main">

        {/* Greeting + Countdown */}
        <div className="greeting-section">
          <div className="greeting-text">
            <h1 className="greeting-name">Hi, {userName}!</h1>
            <p className="greeting-motivation">{motivation}</p>
          </div>
          {daysLeft !== null && (
            <div className="countdown-card">
              <div className="countdown-number">{daysLeft}</div>
              <div className="countdown-label">Days to CAT</div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {analytics.length > 0 && (
          <div className="quick-stats">
            <div className="quick-stat-card">
              <div className="quick-stat-value">{completedCount}</div>
              <div className="quick-stat-label">Tests Done</div>
            </div>
            {SECTIONS.map(s => (
              <div key={s} className="quick-stat-card">
                <div className={`quick-stat-value ${sectionStats[s].accuracy !== null ? (sectionStats[s].accuracy >= 60 ? 'good' : sectionStats[s].accuracy >= 40 ? 'avg' : 'weak') : ''}`}>
                  {sectionStats[s].accuracy !== null ? `${sectionStats[s].accuracy}%` : '—'}
                </div>
                <div className="quick-stat-label">{s} Accuracy</div>
              </div>
            ))}
          </div>
        )}

        {/* Study Plan (if CAT date set) */}
        {studyPlan && (
          <div className="study-plan-card">
            <div className="study-plan-header">
              <h3>Your Study Plan</h3>
              <span className={`study-phase phase-${studyPlan.phase.toLowerCase().replace(' ', '-')}`}>{studyPlan.phase}</span>
            </div>
            <p className="study-plan-message">{studyPlan.message}</p>
            {nextTest && (
              <div className="study-plan-next">
                <span>Next up: <strong>{nextTest.title}</strong></span>
                <button className="btn-start-small" onClick={() => navigate(`/instructions/${nextTest.id}`)}>Start Now</button>
              </div>
            )}
            {weakTopics.length > 0 && (
              <div className="study-plan-weak">
                <span className="weak-label">Focus areas:</span>
                {weakTopics.map(w => (
                  <span key={w.topic} className="weak-chip">{w.topic} ({w.accuracy}%)</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section-wise Practice */}
        {analytics.length > 0 && (
          <div className="section-practice">
            <h2 className="home-section-title">Section Performance</h2>
            <div className="section-cards-row">
              {SECTIONS.map(s => {
                const st = sectionStats[s]
                const pct = st.accuracy ?? 0
                return (
                  <div key={s} className="section-perf-card">
                    <div className="section-perf-header">
                      <span className="section-perf-name">{s}</span>
                      <span className={`section-perf-pct ${pct >= 60 ? 'good' : pct >= 40 ? 'avg' : 'weak'}`}>{st.accuracy !== null ? `${pct}%` : '—'}</span>
                    </div>
                    <div className="section-perf-bar">
                      <div className="section-perf-fill" style={{ width: `${pct}%`, background: pct >= 60 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)' }} />
                    </div>
                    <div className="section-perf-meta">
                      <span>{st.correct} correct</span>
                      <span>{st.attempted} attempted</span>
                      <span>{st.total} total</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Mock Tests */}
        <h2 className="home-section-title">Mock Tests</h2>
        <div className="test-grid">
          {tests.map((t) => {
            const n = t.id
            const done = isCompleted(n)
            const unlocked = isUnlocked(n)

            return (
              <div
                key={n}
                className={`test-card ${!unlocked ? 'locked' : ''} ${done ? 'completed' : ''}`}
              >
                <div className="test-card-header">
                  <h3>{t.title}</h3>
                  {!unlocked && <span className="lock-icon">🔒</span>}
                  {done && <span className="status-badge completed-badge">Completed</span>}
                  {unlocked && !done && <span className="status-badge available-badge">Available</span>}
                </div>
                <div className="test-card-meta">
                  <span>{t.total_questions} Questions</span>
                  <span>·</span>
                  <span>{t.duration_minutes} Minutes</span>
                </div>
                {!unlocked && (
                  <p className="locked-hint">Complete Test {n - 1} to unlock</p>
                )}
                {unlocked && !done && (
                  <button className="btn-start" onClick={() => navigate(`/instructions/${n}`)}>
                    Start Test
                  </button>
                )}
                {done && (
                  <div className="card-actions">
                    <button className="btn-results" onClick={() => navigate(`/results/${n}`)}>
                      View Results
                    </button>
                    <button className="btn-retake" onClick={() => navigate(`/instructions/${n}`)}>
                      Retake
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* No CAT date prompt */}
        {!profile?.cat_exam_date && (
          <div className="set-date-prompt">
            <p>Set your CAT exam date in your <Link to="/profile">Profile</Link> to get a personalized study plan and test schedule.</p>
          </div>
        )}
      </main>
    </div>
  )
}
