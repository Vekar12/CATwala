import { useState, useRef } from 'react'
import './Calculator.css'

export default function Calculator({ onClose }) {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState(null)
  const [op, setOp] = useState(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)
  const [memory, setMemory] = useState(0)

  // Dragging support
  const dragRef = useRef(null)
  const initialX = Math.max(0, window.innerWidth - 280)
  const posRef = useRef({ x: initialX, y: 80 })
  const [pos, setPos] = useState({ x: initialX, y: 80 })

  function startDrag(e) {
    if (e.target.tagName === 'BUTTON') return
    const startX = e.clientX - posRef.current.x
    const startY = e.clientY - posRef.current.y
    function onMove(ev) {
      const el = dragRef.current
      const w = el ? el.offsetWidth : 260
      const h = el ? el.offsetHeight : 340
      const nx = Math.min(Math.max(0, ev.clientX - startX), window.innerWidth - w)
      const ny = Math.min(Math.max(0, ev.clientY - startY), window.innerHeight - h)
      posRef.current = { x: nx, y: ny }
      setPos({ x: nx, y: ny })
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function handleDigit(d) {
    if (waitingForOperand) {
      setDisplay(String(d))
      setWaitingForOperand(false)
    } else {
      setDisplay(display === '0' ? String(d) : display + d)
    }
  }

  function handleDecimal() {
    if (waitingForOperand) { setDisplay('0.'); setWaitingForOperand(false); return }
    if (!display.includes('.')) setDisplay(display + '.')
  }

  function handleOperator(nextOp) {
    const val = parseFloat(display)
    if (prev !== null && !waitingForOperand) {
      const result = calculate(prev, val, op)
      const res = typeof result === 'number' && !isNaN(result) ? result : 'Error'
      setDisplay(String(res))
      setPrev(typeof res === 'number' ? res : null)
    } else {
      setPrev(val)
    }
    setOp(nextOp)
    setWaitingForOperand(true)
  }

  function calculate(a, b, o) {
    switch (o) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/': return b !== 0 ? a / b : 'Error'
      default: return b
    }
  }

  function handleEquals() {
    if (op === null || prev === null) return
    const val = parseFloat(display)
    const result = calculate(prev, val, op)
    const res = typeof result === 'number' && !isNaN(result) ? result : 'Error'
    setDisplay(String(res))
    setPrev(null)
    setOp(null)
    setWaitingForOperand(true)
  }

  function handleClear() {
    setDisplay('0')
    setPrev(null)
    setOp(null)
    setWaitingForOperand(false)
  }

  function readDisplay() {
    const v = Number(display)
    return Number.isFinite(v) ? v : null
  }

  function handleBackspace() {
    if (readDisplay() === null) { setDisplay('0'); setWaitingForOperand(false); return }
    if (display.length > 1) setDisplay(display.slice(0, -1))
    else setDisplay('0')
  }

  function handleSign() {
    const v = readDisplay()
    if (v !== null) setDisplay(String(-v))
  }

  function handleSqrt() {
    const v = readDisplay()
    if (v === null) return
    setDisplay(v >= 0 ? String(Math.sqrt(v)) : 'Error')
    setWaitingForOperand(true)
  }

  function handlePercent() {
    const v = readDisplay()
    if (v === null) return
    setDisplay(String(v / 100))
    setWaitingForOperand(true)
  }

  function handleReciprocal() {
    const v = readDisplay()
    if (v === null) return
    setDisplay(v !== 0 ? String(1 / v) : 'Error')
    setWaitingForOperand(true)
  }

  // Memory functions
  const mc  = () => setMemory(0)
  const mr  = () => { setDisplay(String(memory)); setWaitingForOperand(false) }
  const ms  = () => { const v = readDisplay(); if (v !== null) setMemory(v) }
  const mpl = () => { const v = readDisplay(); if (v !== null) setMemory((m) => m + v) }
  const mmi = () => { const v = readDisplay(); if (v !== null) setMemory((m) => m - v) }

  const btnClass = (type) => `calc-btn calc-btn-${type}`

  return (
    <div
      className="calc-window"
      style={{ left: pos.x, top: pos.y }}
      ref={dragRef}
    >
      {/* Title bar */}
      <div className="calc-titlebar" onMouseDown={startDrag}>
        <span className="calc-title-text">Normal Calculator</span>
        <div className="calc-title-btns">
          <button className="calc-win-btn" disabled aria-hidden="true" tabIndex={-1} title="Minimize">_</button>
          <button className="calc-win-btn calc-win-close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      {/* Display */}
      <div className="calc-display">{display}</div>

      {/* Buttons */}
      <div className="calc-buttons">

        {/* Memory row */}
        <div className="calc-row">
          <button className={btnClass('mem')} onClick={mc}>MC</button>
          <button className={btnClass('mem')} onClick={mr}>MR</button>
          <button className={btnClass('mem')} onClick={ms}>MS</button>
          <button className={btnClass('mem')} onClick={mpl}>M+</button>
          <button className={btnClass('mem')} onClick={mmi}>M-</button>
        </div>

        {/* Backspace / Clear / Sign / Sqrt */}
        <div className="calc-row">
          <button className={btnClass('fn')} onClick={handleBackspace}>⌫</button>
          <button className={btnClass('fn')} onClick={handleClear}>C</button>
          <button className={btnClass('fn')} onClick={handleSign}>±</button>
          <button className={btnClass('fn')} onClick={handleSqrt}>√</button>
        </div>

        {/* Row 7 8 9 / % */}
        <div className="calc-row">
          <button className={btnClass('num')} onClick={() => handleDigit('7')}>7</button>
          <button className={btnClass('num')} onClick={() => handleDigit('8')}>8</button>
          <button className={btnClass('num')} onClick={() => handleDigit('9')}>9</button>
          <button className={btnClass('op')} onClick={() => handleOperator('/')}>/</button>
          <button className={btnClass('fn')} onClick={handlePercent}>%</button>
        </div>

        {/* Row 4 5 6 * 1/x */}
        <div className="calc-row">
          <button className={btnClass('num')} onClick={() => handleDigit('4')}>4</button>
          <button className={btnClass('num')} onClick={() => handleDigit('5')}>5</button>
          <button className={btnClass('num')} onClick={() => handleDigit('6')}>6</button>
          <button className={btnClass('op')} onClick={() => handleOperator('*')}>*</button>
          <button className={btnClass('fn')} onClick={handleReciprocal}>1/x</button>
        </div>

        {/* Row 1 2 3 - */}
        <div className="calc-row">
          <button className={btnClass('num')} onClick={() => handleDigit('1')}>1</button>
          <button className={btnClass('num')} onClick={() => handleDigit('2')}>2</button>
          <button className={btnClass('num')} onClick={() => handleDigit('3')}>3</button>
          <button className={btnClass('op')} onClick={() => handleOperator('-')}>-</button>
          <div className="calc-spacer" />
        </div>

        {/* Row 0 . + = */}
        <div className="calc-row">
          <button className={`${btnClass('num')} calc-btn-zero`} onClick={() => handleDigit('0')}>0</button>
          <button className={btnClass('num')} onClick={handleDecimal}>.</button>
          <button className={btnClass('op')} onClick={() => handleOperator('+')}>+</button>
          <button className={`${btnClass('eq')}`} onClick={handleEquals}>=</button>
        </div>

      </div>
    </div>
  )
}
