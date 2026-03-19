import './SectionTabs.css'

const SECTIONS = ['VARC', 'DILR', 'QA']

export default function SectionTabs({ currentSection, completedSections }) {
  return (
    <div className="section-tabs">
      {SECTIONS.map((s) => {
        const isActive = s === currentSection
        const isCompleted = completedSections.includes(s)
        const isAccessible = isActive || isCompleted
        return (
          <div
            key={s}
            className={`section-tab ${isActive ? 'active' : ''} ${isCompleted ? 'completed-tab' : ''}`}
          >
            {s}
            {isCompleted && <span className="tab-check"> ✓</span>}
          </div>
        )
      })}
    </div>
  )
}
