import './QuestionPalette.css'

const STATUS_COLORS = {
  not_visited: '#9e9e9e',
  not_answered: '#f44336',
  answered: '#4caf50',
  marked: '#9c27b0',
  answered_marked: '#ff9800',
}

function getStatus(qId, answers) {
  const ans = answers[qId]
  if (!ans) return 'not_visited'
  if (ans.status === 'answered_marked') return 'answered_marked'
  if (ans.status === 'marked') return 'marked'
  if (ans.status === 'answered') return 'answered'
  return 'not_answered'
}

export default function QuestionPalette({
  questions,
  sectionName,
  answers,
  currentIndex,
  onNavigate,
  onSubmit,
  timeExpired,
}) {
  const counts = {
    not_visited: 0,
    not_answered: 0,
    answered: 0,
    marked: 0,
    answered_marked: 0,
  }
  questions.forEach((q) => {
    counts[getStatus(q.id, answers)]++
  })

  return (
    <div className="palette">
      <div className="palette-header">
        <span className="palette-title">Question Palette</span>
        <span className="palette-section">{sectionName} ({questions.length} Questions)</span>
      </div>

      <div className="palette-counts">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className="palette-count-item">
            <span className="palette-count-dot" style={{ background: STATUS_COLORS[status] }} />
            <span>{count}</span>
          </div>
        ))}
      </div>

      <div className="palette-grid">
        {questions.map((q, i) => {
          const status = getStatus(q.id, answers)
          const isActive = i === currentIndex
          return (
            <button
              key={q.id}
              className={`palette-btn ${isActive ? 'palette-btn-active' : ''}`}
              style={{ background: isActive ? STATUS_COLORS[status] : STATUS_COLORS[status] }}
              onClick={() => onNavigate(i)}
              title={`Question ${i + 1}: ${status.replace(/_/g, ' ')}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      <button
        className={`btn-submit-section ${timeExpired ? 'btn-submit-urgent' : ''}`}
        onClick={onSubmit}
      >
        Submit Section
      </button>
    </div>
  )
}
