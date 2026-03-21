import './QuestionPalette.css'

const PENTAGON = 'polygon(0% 0%, 100% 0%, 100% 68%, 50% 100%, 0% 68%)'

const STATUS = {
  answered:        { bg: '#3a8a3a', shape: 'pentagon', color: '#fff', border: 'none',              label: 'Answered' },
  not_answered:    { bg: '#d84040', shape: 'pentagon', color: '#fff', border: 'none',              label: 'Not Answered' },
  not_visited:     { bg: '#fff',    shape: 'square',   color: '#333', border: '1px solid #9aa0aa', label: 'Not Visited' },
  marked:          { bg: '#7b3fa0', shape: 'circle',   color: '#fff', border: 'none',              label: 'Marked for Review' },
  answered_marked: { bg: '#7b3fa0', shape: 'circle',   color: '#fff', border: '2px solid #e07b00', outline: '#e07b00', label: 'Answered & Marked for Review (will also be evaluated)' },
}

function getStatus(qId, answers) {
  const ans = answers[qId]
  if (!ans) return 'not_visited'
  if (ans.status === 'answered_marked') return 'answered_marked'
  if (ans.status === 'marked') return 'marked'
  if (ans.status === 'answered') return 'answered'
  return 'not_answered'
}

function StatusDot({ status, size = 20 }) {
  const s = STATUS[status]
  return (
    <span
      className="pal-dot"
      style={{
        background: s.bg,
        borderRadius: s.shape === 'circle' ? '50%' : s.shape === 'pentagon' ? '0' : '3px',
        clipPath: s.shape === 'pentagon' ? PENTAGON : 'none',
        width: size,
        height: size,
        border: s.shape === 'pentagon' ? 'none' : s.border,
        outline: s.outline ? `2px solid ${s.outline}` : 'none',
        outlineOffset: s.outline ? '1px' : '0',
      }}
    />
  )
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
  const counts = { answered: 0, not_answered: 0, not_visited: 0, marked: 0, answered_marked: 0 }
  questions.forEach((q) => { counts[getStatus(q.id, answers)]++ })

  return (
    <div className="palette">

      {/* Legend: 2-column grid */}
      <div className="pal-legend">
        {/* Row 1 */}
        <div className="pal-legend-cell">
          <StatusDot status="answered" />
          <span className="pal-count">{counts.answered}</span>
          <span className="pal-lbl">Answered</span>
        </div>
        <div className="pal-legend-cell">
          <StatusDot status="not_answered" />
          <span className="pal-count">{counts.not_answered}</span>
          <span className="pal-lbl">Not Answered</span>
        </div>
        {/* Row 2 */}
        <div className="pal-legend-cell">
          <StatusDot status="not_visited" />
          <span className="pal-count">{counts.not_visited}</span>
          <span className="pal-lbl">Not Visited</span>
        </div>
        <div className="pal-legend-cell">
          <StatusDot status="marked" />
          <span className="pal-count">{counts.marked}</span>
          <span className="pal-lbl">Marked for Review</span>
        </div>
        {/* Row 3: full width */}
        <div className="pal-legend-cell pal-legend-full">
          <StatusDot status="answered_marked" />
          <span className="pal-count">{counts.answered_marked}</span>
          <span className="pal-lbl">Answered &amp; Marked for Review (will also be evaluated)</span>
        </div>
      </div>

      {/* Section header */}
      <div className="pal-section-bar">{sectionName}</div>

      {/* Choose a Question */}
      <div className="pal-choose-label">Choose a Question</div>

      {/* 4-column question grid */}
      <div className="pal-grid">
        {questions.map((q, i) => {
          const status = getStatus(q.id, answers)
          const s = STATUS[status]
          const isActive = i === currentIndex
          return (
            <button
              key={q.id}
              className="pal-qbtn"
              style={{
                background: s.bg,
                borderRadius: s.shape === 'circle' ? '50%' : s.shape === 'pentagon' ? '0' : '4px',
                clipPath: s.shape === 'pentagon' ? PENTAGON : 'none',
                border: isActive ? '2px solid #e0a000' : (s.shape === 'pentagon' ? 'none' : s.border),
                outline: isActive ? '2px solid #e0a000' : (s.outline ? `2px solid ${s.outline}` : 'none'),
                outlineOffset: isActive ? '2px' : '0',
                color: s.color,
              }}
              onClick={() => onNavigate(i)}
              title={`Q${i + 1}: ${s.label}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      {/* Submit */}
      <button
        className={`pal-submit${timeExpired ? ' pal-submit-urgent' : ''}`}
        onClick={onSubmit}
      >
        Submit
      </button>
    </div>
  )
}
