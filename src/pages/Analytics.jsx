import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getUserAnalytics, getTests, getUnlocks, getCompletedTests } from '../utils/storage'
import './Analytics.css'

function accuracyClass(pct) {
  if (pct >= 70) return 'high'
  if (pct >= 40) return 'mid'
  return 'low'
}

export default function Analytics() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [analytics, setAnalytics] = useState([])
  const [tests, setTests] = useState([])
  const [unlocks, setUnlocks] = useState([])
  const [completed, setCompleted] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [data, testList, unlockList, completedList] = await Promise.all([
        getUserAnalytics(),
        getTests(),
        getUnlocks(),
        getCompletedTests(),
      ])
      setAnalytics(data || [])
      setTests(testList)
      setUnlocks(unlockList)
      setCompleted(completedList)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="analytics">
        <p style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading analytics...</p>
      </div>
    )
  }

  if (!analytics || analytics.length === 0) {
    return (
      <div className="analytics">
        <header className="analytics-header">
          <Link to="/" className="home-logo">
            <span className="logo-cat">CAT</span>
            <span className="logo-wala">Wala</span>
          </Link>
          <div className="analytics-header-right">
            <Link to="/">Home</Link>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>{user?.email}</span>
            <button onClick={signOut} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              Logout
            </button>
          </div>
        </header>
        <div className="analytics-empty">
          <h2>No analytics yet</h2>
          <p>Complete at least one test to see your performance analytics.</p>
          <button className="rec-btn" onClick={() => navigate('/')}>Go to Tests</button>
        </div>
      </div>
    )
  }

  // --- Compute analytics ---
  const sections = ['VARC', 'DILR', 'QA']

  const totalAttempted = analytics.filter(r => r.is_attempted).length
  const totalCorrect = analytics.filter(r => r.is_correct === true).length
  const totalQuestions = analytics.length
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0
  const avgTimePerQ = totalAttempted > 0
    ? Math.round(analytics.filter(r => r.is_attempted).reduce((s, r) => s + (r.time_spent_seconds || 0), 0) / totalAttempted)
    : 0

  // Section-wise stats
  const sectionData = {}
  for (const sec of sections) {
    const rows = analytics.filter(r => r.section === sec)
    const attempted = rows.filter(r => r.is_attempted).length
    const correct = rows.filter(r => r.is_correct === true).length
    const wrong = rows.filter(r => r.is_attempted && r.is_correct === false).length
    const unattempted = rows.filter(r => !r.is_attempted).length
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
    sectionData[sec] = { total: rows.length, attempted, correct, wrong, unattempted, accuracy }
  }

  // Strongest / Weakest section
  const sectionAccuracies = sections
    .filter(s => sectionData[s].attempted > 0)
    .map(s => ({ section: s, accuracy: sectionData[s].accuracy }))
  sectionAccuracies.sort((a, b) => b.accuracy - a.accuracy)
  const strongest = sectionAccuracies.length > 0 ? sectionAccuracies[0].section : '--'
  const weakest = sectionAccuracies.length > 1 ? sectionAccuracies[sectionAccuracies.length - 1].section : (sectionAccuracies.length === 1 ? sectionAccuracies[0].section : '--')

  // Topic-wise stats
  const topicMap = {}
  for (const row of analytics) {
    const topic = row.topic || 'General'
    if (!topicMap[topic]) {
      topicMap[topic] = { topic, section: row.section, attempted: 0, correct: 0, total: 0, timeSum: 0 }
    }
    topicMap[topic].total += 1
    if (row.is_attempted) {
      topicMap[topic].attempted += 1
      topicMap[topic].timeSum += (row.time_spent_seconds || 0)
      if (row.is_correct) topicMap[topic].correct += 1
    }
  }
  const topicList = Object.values(topicMap).map(t => ({
    ...t,
    accuracy: t.attempted > 0 ? Math.round((t.correct / t.attempted) * 100) : 0,
    avgTime: t.attempted > 0 ? Math.round(t.timeSum / t.attempted) : 0,
  }))
  topicList.sort((a, b) => a.accuracy - b.accuracy)

  // Weak areas (<50% accuracy, at least 1 attempted)
  const weakAreas = topicList.filter(t => t.accuracy < 50 && t.attempted > 0)

  // Recommendations
  const isUnlocked = (n) => n === 1 || unlocks.includes(n - 1)
  const nextTest = tests.find(t => isUnlocked(t.id) && !completed.includes(t.id))

  const weakSections = sectionAccuracies.filter(s => s.accuracy < 60)
  const weakSectionNames = weakSections.map(s => s.section).join(' and ')
  const weakTopicNames = weakAreas.slice(0, 3).map(t => t.topic).join(', ')

  return (
    <div className="analytics">
      <header className="analytics-header">
        <Link to="/" className="home-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </Link>
        <div className="analytics-header-right">
          <Link to="/">Home</Link>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>{user?.email}</span>
          <button onClick={signOut} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            Logout
          </button>
        </div>
      </header>

      <div className="analytics-main">
        <h1 className="analytics-page-title">Performance Analytics</h1>
        <p className="analytics-page-subtitle">Track your progress across sections and topics</p>

        {/* Summary Cards */}
        <div className="analytics-summary">
          <div className="summary-card">
            <span className="summary-card-label">Questions Attempted</span>
            <span className="summary-card-value primary">{totalAttempted}</span>
            <span className="summary-card-sub">out of {totalQuestions} total</span>
          </div>
          <div className="summary-card">
            <span className="summary-card-label">Overall Accuracy</span>
            <span className={`summary-card-value ${overallAccuracy >= 60 ? 'green' : 'red'}`}>{overallAccuracy}%</span>
            <span className="summary-card-sub">{totalCorrect} correct answers</span>
          </div>
          <div className="summary-card">
            <span className="summary-card-label">Avg Time / Question</span>
            <span className="summary-card-value">{avgTimePerQ}s</span>
            <span className="summary-card-sub">across all attempts</span>
          </div>
          <div className="summary-card">
            <span className="summary-card-label">Strongest Section</span>
            <span className="summary-card-value green">{strongest}</span>
            <span className="summary-card-sub">{strongest !== '--' ? `${sectionData[strongest]?.accuracy}% accuracy` : ''}</span>
          </div>
          <div className="summary-card">
            <span className="summary-card-label">Weakest Section</span>
            <span className="summary-card-value red">{weakest}</span>
            <span className="summary-card-sub">{weakest !== '--' ? `${sectionData[weakest]?.accuracy}% accuracy` : ''}</span>
          </div>
        </div>

        {/* Section Breakdown */}
        <h2 className="analytics-section-title">Section-wise Breakdown</h2>
        <div className="section-cards">
          {sections.map(sec => {
            const d = sectionData[sec]
            const cls = accuracyClass(d.accuracy)
            return (
              <div key={sec} className="section-card">
                <div className="section-card-header">
                  <span className="section-card-name">{sec}</span>
                  <span className={`section-card-accuracy ${cls}`}>
                    {d.accuracy}% accuracy
                  </span>
                </div>
                <div className="section-stats-row">
                  <div className="section-stat">
                    <div className="section-stat-val correct">{d.correct}</div>
                    <div className="section-stat-label">Correct</div>
                  </div>
                  <div className="section-stat">
                    <div className="section-stat-val wrong">{d.wrong}</div>
                    <div className="section-stat-label">Wrong</div>
                  </div>
                  <div className="section-stat">
                    <div className="section-stat-val unattempted">{d.unattempted}</div>
                    <div className="section-stat-label">Unattempted</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {d.attempted} / {d.total} attempted
                </div>
                <div className="accuracy-bar-container">
                  <div
                    className={`accuracy-bar-fill ${cls}`}
                    style={{ width: `${d.accuracy}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Topic-wise Performance */}
        <h2 className="analytics-section-title">Topic-wise Performance</h2>
        <div className="topic-table-container">
          <table className="topic-table">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Section</th>
                <th>Attempted</th>
                <th>Accuracy</th>
                <th>Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {topicList.map(t => (
                <tr key={t.topic}>
                  <td style={{ fontWeight: 600 }}>{t.topic}</td>
                  <td><span className="section-tag">{t.section}</span></td>
                  <td>{t.attempted} / {t.total}</td>
                  <td>
                    <span className={`topic-accuracy-badge ${accuracyClass(t.accuracy)}`}>
                      {t.accuracy}%
                    </span>
                  </td>
                  <td>{t.avgTime}s</td>
                </tr>
              ))}
              {topicList.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No topic data available</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Weak Areas */}
        {weakAreas.length > 0 && (
          <>
            <h2 className="analytics-section-title">Weak Areas</h2>
            <div className="weak-areas">
              <div className="weak-areas-title">Focus on these topics</div>
              <div className="weak-area-list">
                {weakAreas.map(t => (
                  <div key={t.topic} className="weak-area-item">
                    <div className="weak-area-info">
                      <span className="weak-area-topic">{t.topic}</span>
                      <span className="weak-area-suggestion">
                        {t.accuracy === 0
                          ? 'No correct answers yet -- review fundamentals'
                          : `Only ${t.accuracy}% accuracy -- practice more problems in this area`}
                      </span>
                    </div>
                    <span className="weak-area-pct">{t.accuracy}%</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Recommendations */}
        <h2 className="analytics-section-title">Recommendations</h2>
        <div className="recommendations">
          <div className="rec-card next-test">
            <div className="rec-card-title">Recommended Next Test</div>
            <div className="rec-card-body">
              {nextTest ? (
                <>
                  <strong>{nextTest.title}</strong> is ready for you.
                  {weakSectionNames && (
                    <> Focus on <strong>{weakSectionNames}</strong> topics before your next test.</>
                  )}
                </>
              ) : (
                <>You have completed all available tests. Great work!</>
              )}
            </div>
            {nextTest && (
              <button
                className="rec-btn"
                onClick={() => navigate(`/instructions/${nextTest.id}`)}
              >
                Start Test
              </button>
            )}
          </div>

          <div className="rec-card">
            <div className="rec-card-title">Study Suggestion</div>
            <div className="rec-card-body">
              {weakTopicNames ? (
                <>
                  Practice <strong>{weakTopicNames}</strong> before attempting more tests.
                  These topics have the lowest accuracy and need the most attention.
                </>
              ) : (
                <>
                  Your performance is strong across all topics.
                  Keep practicing to maintain consistency and aim for higher accuracy.
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
