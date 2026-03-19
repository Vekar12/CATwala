import { useEffect, useRef } from 'react'
import './Timer.css'

export default function Timer({ secondsLeft, onExpire }) {
  const prevRef = useRef(secondsLeft)

  useEffect(() => {
    if (secondsLeft <= 0 && prevRef.current > 0) {
      onExpire()
    }
    prevRef.current = secondsLeft
  }, [secondsLeft, onExpire])

  const mins = Math.floor(Math.max(0, secondsLeft) / 60)
  const secs = Math.max(0, secondsLeft) % 60
  const isWarning = secondsLeft <= 300

  return (
    <div className={`timer ${isWarning ? 'timer-warning' : ''}`}>
      <span className="timer-label">Time Left:</span>
      <span className="timer-value">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  )
}
