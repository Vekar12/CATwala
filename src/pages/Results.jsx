import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadResult, markTestComplete } from '../utils/storage'
import { getPercentile } from '../utils/percentile'
import './Results.css'

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default function Results() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const result = loadResult(testId)

  useEffect(() => {
    if (result) {
      markTestComplete(testId)
    }
  }, [testId, result])

  if (!result) {
    return (
      <div className="results-empty">
        <p>No result found for this test.</p>
        <button onClick={() => navigate('/')}>Back to Home</button>
      </div>
    )
  }

  const { score, timings } = result
  const percentile = getPercentile(score.total)

  const sections = [
    {
      name: 'VARC',
      score: score.varc,
      stats: score.varcStats,
      time: timings?.varc || 0,
    },
    {
      name: 'DILR',
      score: score.dilr,
      stats: score.dilrStats,
      time: timings?.dilr || 0,
    },
    {
      name: 'QA',
      score: score.qa,
      stats: score.qaStats,
      time: timings?.qa || 0,
    },
  ]

  const totalAttempted = score.correct + score.wrong
  const accuracy = totalAttempted > 0 ? ((score.correct / totalAttempted) * 100).toFixed(1) : 0

  return (
    <div className="results-page">
      <div className="results-header">
        <div className="logo-small">
          <span className="logo-cat">CAT</span><span className="logo-wala">Wala</span>
        </div>
        <h1>Test Completed — CATWala Mock Test {testId}</h1>
      </div>

      <div className="results-body">
        <div className="score-card">
          <div className="score-main">
            <div className="score-total">
              <div className="score-value">{score.total}</div>
              <div className="score-max">/ 204</div>
            </div>
            <div className="score-label">Total Score</div>
          </div>
          <div className="score-divider" />
          <div className="percentile-block">
            <div className="percentile-value">{percentile}%</div>
            <div className="percentile-label">Estimated Percentile</div>
          </div>
        </div>

        <div className="section-cards">
          {sections.map((sec) => (
            <div key={sec.name} className="section-result-card">
              <div className="sec-name">{sec.name}</div>
              <div className="sec-score">{sec.score} pts</div>
              <div className="sec-stats">
                <div className="stat-row">
                  <span>Correct</span>
                  <span className="stat-val correct">{sec.stats?.correct || 0}</span>
                </div>
                <div className="stat-row">
                  <span>Wrong</span>
                  <span className="stat-val wrong">{sec.stats?.wrong || 0}</span>
                </div>
                <div className="stat-row">
                  <span>Unattempted</span>
                  <span className="stat-val">{sec.stats?.unattempted || 0}</span>
                </div>
                <div className="stat-row">
                  <span>Time Used</span>
                  <span className="stat-val">{fmtTime(sec.time)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="overall-stats">
          <div className="stat-box">
            <div className="stat-box-val">{totalAttempted}</div>
            <div className="stat-box-label">Total Attempted</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-val correct">{score.correct}</div>
            <div className="stat-box-label">Correct</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-val wrong">{score.wrong}</div>
            <div className="stat-box-label">Wrong</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-val">{score.unattempted}</div>
            <div className="stat-box-label">Unattempted</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-val">{accuracy}%</div>
            <div className="stat-box-label">Accuracy</div>
          </div>
        </div>

        <div className="results-actions">
          <button className="btn-review" onClick={() => navigate(`/review/${testId}`)}>
            Review Answers
          </button>
          <button className="btn-home" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
