import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getProfile, updateProfile, getSyllabusTopics } from '../utils/storage'
import './Profile.css'

const SECTIONS = ['VARC', 'DILR', 'QA']
const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard']

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // Personal info
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [college, setCollege] = useState('')
  const [bio, setBio] = useState('')
  const [prepMonths, setPrepMonths] = useState('')

  // Preferences
  const [difficulty, setDifficulty] = useState('All')
  const [targetPercentile, setTargetPercentile] = useState('')
  const [preferredSection, setPreferredSection] = useState('None')

  // Timeline
  const [catDate, setCatDate] = useState('')
  const [notifyMe, setNotifyMe] = useState(false)

  // Syllabus
  const [syllabusTopics, setSyllabusTopics] = useState([])
  const [syllabusProgress, setSyllabusProgress] = useState({})
  const [activeTab, setActiveTab] = useState('VARC')

  useEffect(() => {
    async function load() {
      const [profile, topics] = await Promise.all([
        getProfile(),
        getSyllabusTopics(),
      ])

      if (profile) {
        setFirstName(profile.first_name || '')
        setLastName(profile.last_name || '')
        setPhone(profile.phone || '')
        setCollege(profile.college || '')
        setBio(profile.bio || '')
        setPrepMonths(profile.prep_months ?? '')
        setDifficulty(profile.difficulty_preference || 'All')
        setTargetPercentile(profile.target_percentile ?? '')
        setPreferredSection(profile.preferred_section || 'None')
        setCatDate(profile.cat_exam_date || '')
        setNotifyMe(profile.notify_me || false)
        setSyllabusProgress(profile.syllabus_progress || {})
      }

      setSyllabusTopics(topics)
      setLoading(false)
    }
    load()
  }, [])

  const daysRemaining = useMemo(() => {
    if (!catDate) return null
    const diff = Math.ceil((new Date(catDate) - new Date()) / (1000 * 60 * 60 * 24))
    return diff >= 0 ? diff : 0
  }, [catDate])

  // Group topics by section, then by sub_section
  const topicsBySection = useMemo(() => {
    const grouped = {}
    for (const s of SECTIONS) {
      grouped[s] = syllabusTopics.filter(t => t.section === s)
    }
    return grouped
  }, [syllabusTopics])

  const subSectionsBySection = useMemo(() => {
    const result = {}
    for (const s of SECTIONS) {
      const topics = topicsBySection[s]
      const subs = {}
      for (const t of topics) {
        const sub = t.sub_section || 'General'
        if (!subs[sub]) subs[sub] = []
        subs[sub].push(t)
      }
      result[s] = subs
    }
    return result
  }, [topicsBySection])

  const sectionProgress = useMemo(() => {
    const progress = {}
    for (const s of SECTIONS) {
      const topics = topicsBySection[s]
      if (!topics.length) {
        progress[s] = 0
        continue
      }
      const done = topics.filter(t => syllabusProgress[t.topic]).length
      progress[s] = Math.round((done / topics.length) * 100)
    }
    return progress
  }, [topicsBySection, syllabusProgress])

  function showToast(type, message) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  function toggleTopic(topicKey) {
    setSyllabusProgress(prev => ({
      ...prev,
      [topicKey]: !prev[topicKey],
    }))
  }

  async function handleSave() {
    setSaving(true)
    const result = await updateProfile({
      first_name: firstName,
      last_name: lastName,
      phone,
      college,
      bio,
      prep_months: prepMonths ? Number(prepMonths) : null,
      difficulty_preference: difficulty,
      target_percentile: targetPercentile ? Number(targetPercentile) : null,
      preferred_section: preferredSection === 'None' ? null : preferredSection,
      cat_exam_date: catDate || null,
      notify_me: notifyMe,
      syllabus_progress: syllabusProgress,
    })

    if (result) {
      showToast('success', 'Profile saved successfully!')
    } else {
      showToast('error', 'Failed to save profile. Please try again.')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="profile-loading">Loading profile...</div>
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="home-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span className="logo-cat">CAT</span>
          <span className="logo-wala">Wala</span>
        </div>
        <button className="profile-back" onClick={() => navigate('/')}>
          &larr; Back to Home
        </button>
      </header>

      <main className="profile-main">
        <h1 className="profile-page-title">Your Profile</h1>

        {/* Personal Info */}
        <div className="profile-card">
          <h2 className="profile-card-title">Personal Information</h2>
          <div className="profile-form-grid">
            <div className="profile-field">
              <label>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="profile-field">
              <label>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
            <div className="profile-field">
              <label>Email</label>
              <input type="email" value={user?.email || ''} disabled />
            </div>
            <div className="profile-field">
              <label>Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="profile-field">
              <label>College</label>
              <input
                type="text"
                value={college}
                onChange={e => setCollege(e.target.value)}
                placeholder="Your college"
              />
            </div>
            <div className="profile-field">
              <label>Preparation (months)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={prepMonths}
                onChange={e => setPrepMonths(e.target.value)}
                placeholder="e.g. 6"
              />
            </div>
            <div className="profile-field full-width">
              <label>Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell us a little about yourself"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="profile-card">
          <h2 className="profile-card-title">Preferences</h2>
          <div className="profile-form-grid">
            <div className="profile-field full-width">
              <label>Difficulty Preference</label>
              <div className="toggle-group">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`toggle-btn ${difficulty === d ? 'active' : ''}`}
                    onClick={() => setDifficulty(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="profile-field">
              <label>Target Percentile</label>
              <input
                type="number"
                min="0"
                max="100"
                value={targetPercentile}
                onChange={e => setTargetPercentile(e.target.value)}
                placeholder="e.g. 99"
              />
            </div>
            <div className="profile-field">
              <label>Preferred Section</label>
              <select
                value={preferredSection}
                onChange={e => setPreferredSection(e.target.value)}
              >
                <option value="None">No preference</option>
                {SECTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* CAT Exam Timeline */}
        <div className="profile-card">
          <h2 className="profile-card-title">CAT Exam Timeline</h2>
          <div className="profile-form-grid">
            <div className="profile-field">
              <label>CAT Exam Date</label>
              <input
                type="date"
                value={catDate}
                onChange={e => setCatDate(e.target.value)}
              />
            </div>
            <div className="profile-field" style={{ justifyContent: 'flex-end' }}>
              <label className="notify-check">
                <input
                  type="checkbox"
                  checked={notifyMe}
                  onChange={e => setNotifyMe(e.target.checked)}
                />
                Notify me with reminders
              </label>
            </div>
          </div>
          {catDate && (
            <div className="timeline-info" style={{ marginTop: 20 }}>
              <div className="days-remaining">
                <span className="days-count">{daysRemaining}</span>
                <span className="days-label">Days Left</span>
              </div>
            </div>
          )}
        </div>

        {/* Syllabus Progress */}
        {syllabusTopics.length > 0 && (
          <div className="profile-card">
            <h2 className="profile-card-title">Syllabus Progress</h2>

            <div className="syllabus-tabs">
              {SECTIONS.map(s => (
                <button
                  key={s}
                  className={`syllabus-tab ${activeTab === s ? 'active' : ''}`}
                  onClick={() => setActiveTab(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="syllabus-progress-bar-wrap">
              <div className="syllabus-progress-label">
                <span>{activeTab} Progress</span>
                <span>{sectionProgress[activeTab]}%</span>
              </div>
              <div className="syllabus-progress-bar">
                <div
                  className="syllabus-progress-fill"
                  style={{ width: `${sectionProgress[activeTab]}%` }}
                />
              </div>
            </div>

            <div className="syllabus-topic-list">
              {Object.entries(subSectionsBySection[activeTab]).map(([subSection, topics]) => (
                <div key={subSection} className="syllabus-sub-section">
                  <div className="syllabus-sub-header">
                    <span className="syllabus-sub-title">{subSection}</span>
                    <span className="syllabus-sub-count">
                      {topics.filter(t => syllabusProgress[t.topic]).length}/{topics.length} done
                    </span>
                  </div>
                  {topics.map(topic => (
                    <div
                      key={topic.id}
                      className={`syllabus-topic-row ${syllabusProgress[topic.topic] ? 'completed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        id={`topic-${topic.id}`}
                        checked={!!syllabusProgress[topic.topic]}
                        onChange={() => toggleTopic(topic.topic)}
                      />
                      <label htmlFor={`topic-${topic.id}`}>{topic.topic}</label>
                    </div>
                  ))}
                </div>
              ))}
              {topicsBySection[activeTab].length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '12px' }}>
                  No topics found for {activeTab}.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Save */}
        <div className="profile-save-wrap">
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </main>

      {toast && (
        <div className={`profile-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
