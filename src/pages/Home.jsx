import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getUnlocks, getTests } from '../utils/storage'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [tests, setTests] = useState([])
  const [unlocks, setUnlocks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [testList, unlockList] = await Promise.all([
        getTests(),
        getUnlocks(),
      ])
      setTests(testList)
      setUnlocks(unlockList)
      setLoading(false)
    }
    load()
  }, [])

  const isCompleted = (n) => unlocks.includes(n)
  const isUnlocked = (n) => n === 1 || unlocks.includes(n - 1)

  if (loading) {
    return <div className="home"><p style={{ textAlign: 'center', padding: '2rem' }}>Loading tests...</p></div>
  }

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <p className="home-tagline">India's most realistic CAT mock test</p>
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>{user?.email}</span>
          <button onClick={signOut} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      <main className="home-main">
        <h2 className="home-section-title">Mock Tests</h2>
        <div className="test-grid">
          {tests.map((t) => {
            const n = t.id
            const completed = isCompleted(n)
            const unlocked = isUnlocked(n)

            return (
              <div
                key={n}
                className={`test-card ${!unlocked ? 'locked' : ''} ${completed ? 'completed' : ''}`}
              >
                <div className="test-card-header">
                  <h3>{t.title}</h3>
                  {!unlocked && <span className="lock-icon">🔒</span>}
                  {completed && <span className="status-badge completed-badge">Completed</span>}
                  {unlocked && !completed && <span className="status-badge available-badge">Available</span>}
                </div>
                <div className="test-card-meta">
                  <span>{t.total_questions} Questions</span>
                  <span>·</span>
                  <span>{t.duration_minutes} Minutes</span>
                </div>
                {!unlocked && (
                  <p className="locked-hint">Complete Test {n - 1} to unlock</p>
                )}
                {unlocked && !completed && (
                  <button
                    className="btn-start"
                    onClick={() => navigate(`/instructions/${n}`)}
                  >
                    Start Test
                  </button>
                )}
                {completed && (
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
      </main>
    </div>
  )
}
