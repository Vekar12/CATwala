import { useNavigate } from 'react-router-dom'
import { getUnlocks } from '../utils/storage'
import './Home.css'

const TOTAL_TESTS = 12

export default function Home() {
  const navigate = useNavigate()
  const unlocks = getUnlocks()

  const isCompleted = (n) => unlocks.includes(n)
  const isUnlocked = (n) => n === 1 || unlocks.includes(n - 1)

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <p className="home-tagline">India's most realistic CAT mock test</p>
      </header>

      <main className="home-main">
        <h2 className="home-section-title">Mock Tests</h2>
        <div className="test-grid">
          {Array.from({ length: TOTAL_TESTS }, (_, i) => i + 1).map((n) => {
            const completed = isCompleted(n)
            const unlocked = isUnlocked(n)

            return (
              <div
                key={n}
                className={`test-card ${!unlocked ? 'locked' : ''} ${completed ? 'completed' : ''}`}
              >
                <div className="test-card-header">
                  <h3>Mock Test {n}</h3>
                  {!unlocked && <span className="lock-icon">🔒</span>}
                  {completed && <span className="status-badge completed-badge">Completed</span>}
                  {unlocked && !completed && <span className="status-badge available-badge">Available</span>}
                </div>
                <div className="test-card-meta">
                  <span>68 Questions</span>
                  <span>·</span>
                  <span>2 Hours</span>
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
                    <button
                      className="btn-results"
                      onClick={() => navigate(`/results/${n}`)}
                    >
                      View Results
                    </button>
                    <button
                      className="btn-retake"
                      onClick={() => navigate(`/instructions/${n}`)}
                    >
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
