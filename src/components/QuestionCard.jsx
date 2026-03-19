import './QuestionCard.css'

export default function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  section,
  answer,
  onAnswerChange,
}) {
  const isTITA = question.question_type === 'TITA'
  const isRC = question.question_type === 'RC' && question.passage

  const options = [
    { key: 'A', text: question.option_a },
    { key: 'B', text: question.option_b },
    { key: 'C', text: question.option_c },
    { key: 'D', text: question.option_d },
  ]

  return (
    <div className="question-card">
      <div className="question-meta">
        <span className="question-num">Question {questionNumber} of {totalQuestions}</span>
        <span className="question-section-label">{section}</span>
        <span className={`question-type-badge ${isTITA ? 'tita-badge' : 'mcq-badge'}`}>
          {isTITA ? 'TITA' : 'MCQ'}
        </span>
        {question.difficulty && (
          <span className={`diff-badge diff-${question.difficulty.toLowerCase()}`}>
            {question.difficulty}
          </span>
        )}
      </div>

      <div className={`question-content ${isRC ? 'rc-layout' : ''}`}>
        {isRC && (
          <div className="rc-passage">
            <div className="passage-label">Passage</div>
            <div className="passage-text">{question.passage}</div>
          </div>
        )}

        <div className="question-right">
          <div className="question-text">{question.question_text}</div>

          {!isTITA && (
            <div className="options-list">
              {options.map(({ key, text }) => (
                <label
                  key={key}
                  className={`option-label ${answer?.selected === key ? 'option-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`q_${question.id}`}
                    value={key}
                    checked={answer?.selected === key}
                    onChange={() => onAnswerChange(key)}
                  />
                  <span className="option-key">{key}</span>
                  <span className="option-text">{text}</span>
                </label>
              ))}
            </div>
          )}

          {isTITA && (
            <div className="tita-container">
              <label className="tita-label">Type your answer:</label>
              <input
                type="text"
                className="tita-input"
                value={answer?.selected || ''}
                onChange={(e) => onAnswerChange(e.target.value)}
                placeholder="Enter your answer here"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
