import { useState } from 'react'
import './Calculator.css'

export default function Calculator({ onClose }) {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState(null)
  const [op, setOp] = useState(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  function handleDigit(d) {
    if (waitingForOperand) {
      setDisplay(String(d))
      setWaitingForOperand(false)
    } else {
      setDisplay(display === '0' ? String(d) : display + d)
    }
  }

  function handleDecimal() {
    if (waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
      return
    }
    if (!display.includes('.')) {
      setDisplay(display + '.')
    }
  }

  function handleOperator(nextOp) {
    const val = parseFloat(display)
    if (prev !== null && !waitingForOperand) {
      const result = calculate(prev, val, op)
      setDisplay(String(result))
      setPrev(result)
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
      case 'x': return a * b
      case '/': return b !== 0 ? a / b : 'Error'
      default: return b
    }
  }

  function handleEquals() {
    if (op === null || prev === null) return
    const val = parseFloat(display)
    const result = calculate(prev, val, op)
    setDisplay(String(result))
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

  function handleSign() {
    setDisplay(String(-parseFloat(display)))
  }

  function handlePercent() {
    setDisplay(String(parseFloat(display) / 100))
  }

  const buttons = [
    ['C', '+/-', '%', '/'],
    ['7', '8', '9', 'x'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ]

  return (
    <div className="calc-overlay" onClick={onClose}>
      <div className="calc-container" onClick={(e) => e.stopPropagation()}>
        <div className="calc-header">
          <span>Calculator</span>
          <button className="calc-close" onClick={onClose}>x</button>
        </div>
        <div className="calc-display">{display}</div>
        <div className="calc-buttons">
          {buttons.map((row, ri) => (
            <div key={ri} className="calc-row">
              {row.map((btn) => {
                let cls = 'calc-btn'
                if (['/', 'x', '-', '+', '='].includes(btn)) cls += ' calc-op'
                if (['C', '+/-', '%'].includes(btn)) cls += ' calc-fn'
                if (btn === '0') cls += ' calc-zero'
                return (
                  <button
                    key={btn}
                    className={cls}
                    onClick={() => {
                      if (btn === 'C') handleClear()
                      else if (btn === '+/-') handleSign()
                      else if (btn === '%') handlePercent()
                      else if (btn === '=') handleEquals()
                      else if (btn === '.') handleDecimal()
                      else if (['+', '-', 'x', '/'].includes(btn)) handleOperator(btn)
                      else handleDigit(btn)
                    }}
                  >
                    {btn}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
