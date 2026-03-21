import { useRef } from 'react'
import './QuestionCard.css'

/* ── Numeric on-screen keypad for TITA ── */
function TitaKeypad({ value, onChange }) {
  function press(char) {
    if (char === 'BS') {
      onChange(value.slice(0, -1))
    } else if (char === '.') {
      if (!value.includes('.')) onChange(value + '.')
    } else if (char === '-') {
      onChange(value.startsWith('-') ? value.slice(1) : '-' + value)
    } else {
      onChange(value + char)
    }
  }
  return (
    <div className="tita-keypad">
      <input
        className="tita-display"
        value={value}
        readOnly
        placeholder=""
      />
      <div className="tita-keypad-grid">
        <button className="tk-btn tk-wide" onClick={() => press('BS')}>Backspace</button>
        {['7','8','9','4','5','6','1','2','3','-','0','.'].map((k) => (
          <button key={k} className="tk-btn" onClick={() => press(k)}>{k}</button>
        ))}
      </div>
    </div>
  )
}

export default function QuestionCard({
  question,
  questionNumber,
  selectedOption,
  onAnswerChange,
}) {
  const isTITA = question.question_type === 'TITA'
  const isRC = !!question.passage
  const negMark = isTITA ? '0' : '1'

  const qPanelRef = useRef(null)
  const passPanelRef = useRef(null)

  function scrollDown() {
    if (qPanelRef.current) qPanelRef.current.scrollTop += 200
    if (passPanelRef.current) passPanelRef.current.scrollTop += 200
  }
  function scrollUp() {
    if (qPanelRef.current) qPanelRef.current.scrollTop -= 200
    if (passPanelRef.current) passPanelRef.current.scrollTop -= 200
  }

  const options = [
    { key: 'A', text: question.option_a },
    { key: 'B', text: question.option_b },
    { key: 'C', text: question.option_c },
    { key: 'D', text: question.option_d },
  ].filter((o) => o.text)

  return (
    <div className="qcard">
      {/* Marks bar — full width, right aligned */}
      <div className="qcard-marks-bar">
        <span>
          Marks for correct answer:{' '}
          <span className="marks-pos">3</span>
          {' | '}
          Negative Marks:{' '}
          <span className="marks-neg">{negMark}</span>
        </span>
      </div>

      {/* Scroll buttons */}
      <div className="qcard-scroll-btns">
        <button className="scroll-arrow-btn" onClick={scrollUp} title="Scroll Up">▲</button>
        <button className="scroll-arrow-btn" onClick={scrollDown} title="Scroll Down">▼</button>
      </div>

      {/* Content panels */}
      <div className={`qcard-panels${isRC ? ' qcard-panels-rc' : ''}`}>

        {/* Passage panel — RC only */}
        {isRC && (
          <div className="qcard-passage-panel" ref={passPanelRef}>
            <div className="passage-body">{question.passage}</div>
          </div>
        )}

        {/* Question panel */}
        <div className="qcard-q-panel" ref={qPanelRef}>
          <div className="qnum-heading">Question No. {questionNumber}</div>
          <div className="q-text">{question.question_text}</div>

          {/* MCQ options */}
          {!isTITA && (
            <div className="q-options">
              {options.map(({ key, text }) => (
                <label
                  key={key}
                  className={`q-option${selectedOption === key ? ' q-option-sel' : ''}`}
                >
                  <input
                    type="radio"
                    name={`q_${question.id}`}
                    value={key}
                    checked={selectedOption === key}
                    onChange={() => onAnswerChange(key)}
                    className="q-radio"
                  />
                  <span className="q-opt-text">{text}</span>
                </label>
              ))}
            </div>
          )}

          {/* TITA: on-screen numeric keypad */}
          {isTITA && (
            <TitaKeypad
              value={selectedOption || ''}
              onChange={onAnswerChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}
