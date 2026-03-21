import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createAttempt } from '../utils/storage'
import { useAuth } from '../hooks/useAuth'
import './Instructions.css'

const IIM_LOGOS = [
  'IIM-A', 'IIM-B', 'IIM-C', 'IIM-L', 'IIM-K', 'IIM-I', 'IIM-Ko',
  'IIM-S', 'IIM-T', 'IIM-R', 'IIM-U', 'IIM-V', 'IIM-Bo', 'IIM-J',
  'IIM-N', 'IIM-Am', 'IIM-Si', 'IIM-Sc',
]

function PaletteSymbol({ type, number }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px', fontWeight: 'bold', fontSize: '0.85rem',
    flexShrink: 0, fontFamily: 'Arial, sans-serif',
  }
  const configs = {
    not_visited:     { ...base, background: '#fff', border: '1px solid #888', borderRadius: '4px', color: '#000' },
    not_answered:    { ...base, background: '#d84040', color: '#fff', clipPath: 'polygon(0% 0%, 100% 0%, 100% 68%, 50% 100%, 0% 68%)' },
    answered:        { ...base, background: '#3a8a3a', color: '#fff', clipPath: 'polygon(0% 0%, 100% 0%, 100% 68%, 50% 100%, 0% 68%)' },
    marked:          { ...base, background: '#7b3fa0', color: '#fff', borderRadius: '50%' },
    answered_marked: { ...base, background: '#9b59c0', color: '#fff', borderRadius: '50%' },
    marked_eval:     { ...base, background: '#4a2070', color: '#fff', borderRadius: '50%' },
  }
  return <span style={configs[type]}>{number}</span>
}

export default function Instructions() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  const candidateName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Candidate'

  async function handleBegin() {
    if (!agreed) return
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
    <div className="inst-page">

      {/* ── Top title bar ── */}
      <div className="inst-top-bar">
        <div className="inst-brand">CATwala Mock CAT</div>
      </div>

      {/* ── IIM logos strip ── */}
      <div className="inst-logos-strip">
        {IIM_LOGOS.map((logo) => (
          <span key={logo} className="inst-logo-badge">{logo}</span>
        ))}
      </div>

      {/* ── Main body ── */}
      <div className="inst-body">

        {/* ── LEFT panel ── */}
        <div className="inst-left">

          {/* Section heading bar — changes per page */}
          <div className="inst-section-bar">
            {page === 1 ? 'Instructions' : 'Other Important Instructions'}
          </div>

          {/* Scrollable content */}
          <div className="inst-content">

            {/* ─── PAGE 1 ─── */}
            {page === 1 && (
              <>
                <p className="inst-please-read">Please read the instructions carefully</p>

                <p className="inst-heading">General Instructions:</p>
                <ol className="inst-ol">
                  <li>Total duration of examination is 120 minutes.</li>
                  <li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time available for you to complete the examination. When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination.</li>
                  <li>
                    The Question Palette displayed on the right side of screen will show the status of each question using one of the following symbols:
                    <div className="inst-palette-legend">
                      <div className="inst-palette-row">
                        <PaletteSymbol type="not_visited" number="1" />
                        <span>You have not visited the question yet.</span>
                      </div>
                      <div className="inst-palette-row">
                        <PaletteSymbol type="not_answered" number="2" />
                        <span>You have not answered the question.</span>
                      </div>
                      <div className="inst-palette-row">
                        <PaletteSymbol type="answered" number="3" />
                        <span>You have answered the question.</span>
                      </div>
                      <div className="inst-palette-row">
                        <PaletteSymbol type="marked" number="4" />
                        <span>You have NOT answered the question, but have marked the question for review.</span>
                      </div>
                      <div className="inst-palette-row">
                        <PaletteSymbol type="answered_marked" number="5" />
                        <span>The question(s) "Answered and Marked for Review" will be considered for evaluation.</span>
                      </div>
                      <div className="inst-palette-row">
                        <PaletteSymbol type="marked_eval" number="6" />
                        <span>The question(s) "Marked for Review" will be not be considered for evaluation. Hence, no marks will be allocated for the same.</span>
                      </div>
                    </div>
                    <p className="inst-note">The Marked for Review status for a question simply indicates that you would like to look at that question again.</p>
                  </li>
                  <li>You can click on the "&gt;" arrow which appears to the left of question palette to collapse the question palette thereby maximizing the question window. To view the question palette again, you can click on "&lt;" which appears on the right side of question window.</li>
                  <li>You can click on your "Profile" image on top right corner of your screen to change the language during the exam for entire question paper. On clicking of Profile image you will get a drop-down to change the question content to the desired language.</li>
                  <li>You can click on <span className="inst-arrow-icon">↓</span> to navigate to the bottom and <span className="inst-arrow-icon">↑</span> to navigate to the top of the question area, without scrolling.</li>
                </ol>

                <p className="inst-heading">Navigating to a Question:</p>
                <ol className="inst-ol" start={7}>
                  <li>
                    To answer a question, do the following:
                    <ol className="inst-ol-alpha">
                      <li>Click on the question number in the Question Palette at the right of your screen to go to that numbered question directly. Note that using this option does NOT save your answer to the current question.</li>
                      <li>Click on <strong>Save &amp; Next</strong> to save your answer for the current question and then go to the next question.</li>
                      <li>Click on <strong>Mark for Review &amp; Next</strong> to save your answer for the current question, mark it for review, and then go to the next question.</li>
                    </ol>
                  </li>
                </ol>

                <p className="inst-heading">Answering a Question :</p>
                <ol className="inst-ol" start={8}>
                  <li>
                    Procedure for answering a multiple choice type question:
                    <ol className="inst-ol-alpha">
                      <li>To select your answer, click on the button of one of the options</li>
                      <li>To deselect your chosen answer, click on the button of the chosen option again or click on the <strong>Clear Response</strong> button</li>
                      <li>To change your chosen answer, click on the button of another option</li>
                      <li>To save your answer, you MUST click on the <strong>Save &amp; Next</strong> button</li>
                      <li>To mark the question for review, click on the <strong>Mark for Review &amp; Next</strong> button.</li>
                    </ol>
                  </li>
                  <li>To change your answer to a question that has already been answered, first select that question for answering and then follow the procedure for answering that type of question.</li>
                </ol>

                <p className="inst-heading">Navigating through sections:</p>
                <ol className="inst-ol" start={10}>
                  <li>Sections in this question paper are displayed on the top bar of the screen. Questions in a section can be viewed by clicking on the section name. The section you are currently viewing is highlighted.</li>
                  <li>After clicking the Save &amp; Next button on the last question for a section, you will automatically be taken to the first question of the next section.</li>
                  <li>You can shuffle between sections and questions anytime during the examination as per your convenience only during the time stipulated.</li>
                  <li>Candidate can view the corresponding section summary as part of the legend that appears in every section above the question palette.</li>
                </ol>
              </>
            )}

            {/* ─── PAGE 2 ─── */}
            {page === 2 && (
              <>
                <ol className="inst-ol">
                  <li>To login, enter your registration number and password following instructions provided to you by the invigilator.</li>
                  <li>Go through the various symbols used in the test and understand their meaning before you start the test.</li>
                  <li>
                    The question paper consists of 3 (three) sections:
                    <table className="inst-section-table">
                      <thead>
                        <tr><th>Section</th><th>Test</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>I</td><td>Verbal Ability and Reading Comprehension (VARC)</td></tr>
                        <tr><td>II</td><td>Data Interpretation and Logical Reasoning (DILR)</td></tr>
                        <tr><td>III</td><td>Quantitative Ability (QA)</td></tr>
                      </tbody>
                    </table>
                  </li>
                  <li>For the Data Interpretation and Logical Reasoning (DILR) section, each situation/scenario consists of a group of four or six questions. Similarly, for Reading Comprehension, each passage consists of a group of 4 questions.</li>
                  <li>For an <strong>MCQ</strong>, a candidate will be given <strong>3 (three) marks for a correct answer, -1 (minus one) mark for a wrong answer and a 0 (zero) mark for an un-attempted question</strong>.</li>
                  <li>For a <strong>Non-MCQ</strong>, a candidate will be given <strong>3 (three) marks for a correct answer, and a 0 (zero) mark for a wrong answer and for an un-attempted question</strong>. There will be <strong>no negative mark for a wrong answer in a Non-MCQ</strong>.</li>
                  <li>An MCQ will have choices out of which only one will be the correct answer. The computer allotted to you at the test center runs on a specialized software that permits you to select only one answer for an MCQ. You will have to choose the correct answer by clicking on the radio button () placed just before the option. For a Non-MCQ, you will have to enter the answer in the space provided on the screen using the on-screen keyboard.</li>
                  <li>Your answers will be updated and saved on a server periodically. The test will end automatically at the end of <strong>120 minutes</strong> (or at the end of <strong>160 minutes</strong> for PwD candidates). The time allotted for each section will be 40 minutes (or 53 minutes and 20 seconds for PwD candidates), after which you will not be allowed to go back to the earlier section(s).</li>
                </ol>

                <p className="inst-decl-heading">Declaration by a Candidate:</p>

                <div className="inst-declaration">
                  <p>"I have read and understood all the above instructions. I have also read and understood clearly the instructions given on the admit card and shall follow the same. I also understand that in case I violate any of these instructions, my candidature is liable to be cancelled. I also confirm that at the start of the test all the computer hardware allotted to me are in proper working condition.</p>
                  <br />
                  <p>I will not disclose, publish, reproduce, transmit, store, or facilitate transmission and storage of the contents of the CAT or any information therein in whole or part thereof in any form or by any means, verbal or written, electronically or mechanically for any purpose. I am aware that this shall be in violation of the Indian Contract Act, 1872 and/or the Copyright Act, 1957 and/or the Information Technology Act, 2000. I am aware that such actions and/or abetment thereof as aforementioned may constitute a cognizable offence punishable with imprisonment for a term up to three years and fine up to Rs. Two Lakhs. I agree to this Non-Disclosure Agreement."</p>
                </div>

                <label className="inst-checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>I have read and understood the instructions. All computer hardware allotted to me are in proper working condition. I declare that I am not in possession of / not wearing / not carrying any prohibited gadget like mobile phone, bluetooth devices etc. /any prohibited material with me into the Examination Hall.I agree that in case of not adhering to the instructions, I shall be liable to be debarred from this Test and/or to disciplinary action, which may include ban from future Tests / Examinations</span>
                </label>
              </>
            )}
          </div>

          {/* ── Navigation buttons ── */}
          <div className="inst-nav">
            {page === 2 && (
              <button className="inst-btn-prev" onClick={() => setPage(1)}>
                &#8249; Previous
              </button>
            )}
            <div className="inst-nav-right">
              {page === 1 && (
                <button className="inst-btn-next" onClick={() => setPage(2)}>
                  Next &#8250;
                </button>
              )}
              {page === 2 && (
                <button
                  className="inst-btn-begin"
                  disabled={!agreed || loading}
                  onClick={handleBegin}
                >
                  {loading ? 'Starting...' : 'I am ready to begin'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Candidate profile ── */}
        <div className="inst-right">
          <div className="inst-candidate-photo">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="inst-avatar-svg">
              <circle cx="50" cy="50" r="50" fill="#c0c8d4"/>
              <circle cx="50" cy="38" r="18" fill="#7a8799"/>
              <ellipse cx="50" cy="85" rx="28" ry="20" fill="#7a8799"/>
            </svg>
          </div>
          <div className="inst-candidate-name">{candidateName}</div>
        </div>
      </div>

      {/* ── Version footer ── */}
      <div className="inst-footer">Version : 17.07.00</div>
    </div>
  )
}
