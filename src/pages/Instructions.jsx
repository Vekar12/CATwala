import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createAttempt } from '../utils/storage'
import './Instructions.css'

export default function Instructions() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleBegin() {
    setLoading(true)
    const session = await createAttempt(testId)
    if (session) {
      navigate(`/test/${testId}`)
    } else {
      setLoading(false)
      alert('Failed to create test attempt. Please try again.')
    }
  }

  return (
    <div className="instructions-page">
      <div className="instructions-header">
        <div className="inst-logo">
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <h2>Mock Test {testId} — Instructions</h2>
        <div className="step-indicator">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`step-dot ${step >= s ? 'active' : ''}`} />
          ))}
        </div>
      </div>

      <div className="instructions-body">
        {step === 1 && (
          <div className="inst-screen">
            <h3>General Instructions</h3>
            <ol className="inst-list">
              <li>Total duration is <strong>120 minutes</strong> divided into 3 sections of <strong>40 minutes each</strong>.</li>
              <li>The sections are: <strong>Section I: Verbal Ability &amp; Reading Comprehension (VARC)</strong>, <strong>Section II: Data Interpretation &amp; Logical Reasoning (DILR)</strong>, <strong>Section III: Quantitative Ability (QA)</strong>.</li>
              <li>You <strong>cannot move</strong> to the next section before 40 minutes are up.</li>
              <li>You <strong>cannot go back</strong> to a previous section once time has elapsed.</li>
              <li>Each correct MCQ answer carries <strong>+3 marks</strong>. Each wrong MCQ answer carries <strong>-1 mark</strong>. TITA questions carry <strong>+3 for correct</strong>, <strong>0 for wrong or unattempted</strong>. No negative marking for TITA.</li>
              <li>Total questions: <strong>68</strong>. Maximum marks: <strong>204</strong>.</li>
              <li>Use the <strong>Question Palette</strong> on the right to navigate between questions.</li>
              <li>A built-in <strong>calculator</strong> is available on the top right.</li>
              <li>Do not refresh the page. Your progress is <strong>saved automatically</strong>.</li>
              <li>Once you click <strong>Submit</strong>, the test cannot be resumed.</li>
            </ol>
          </div>
        )}

        {step === 2 && (
          <div className="inst-screen">
            <h3>Understanding the Question Palette</h3>
            <div className="legend-list">
              <div className="legend-item">
                <div className="legend-circle gray" />
                <div><strong>Not Visited</strong><p>You have not visited this question yet</p></div>
              </div>
              <div className="legend-item">
                <div className="legend-circle red" />
                <div><strong>Not Answered</strong><p>You visited but did not answer</p></div>
              </div>
              <div className="legend-item">
                <div className="legend-circle green" />
                <div><strong>Answered</strong><p>You have saved an answer</p></div>
              </div>
              <div className="legend-item">
                <div className="legend-circle purple" />
                <div><strong>Marked for Review</strong><p>Marked but not answered</p></div>
              </div>
              <div className="legend-item">
                <div className="legend-circle orange" />
                <div><strong>Answered &amp; Marked for Review</strong><p>Answered and flagged for review</p></div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="inst-screen">
            <h3>Declaration</h3>
            <div className="declaration-box">
              <p>I have read and understood all instructions. I am aware that attempting to use unfair means will result in disqualification. I confirm that I will not use any external resources during the test.</p>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>I agree to the above declaration</span>
            </label>
          </div>
        )}

        <div className="inst-actions">
          {step > 1 && (
            <button className="btn-prev" onClick={() => setStep(step - 1)}>Previous</button>
          )}
          {step < 3 && (
            <button className="btn-next" onClick={() => setStep(step + 1)}>Next</button>
          )}
          {step === 3 && (
            <button className="btn-begin" disabled={!agreed || loading} onClick={handleBegin}>
              {loading ? 'Starting...' : 'I am ready to begin'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
