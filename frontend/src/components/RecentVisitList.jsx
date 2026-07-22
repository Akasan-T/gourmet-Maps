import { useState } from 'react'
import RecentVisitCard from './RecentVisitCard'

const collapsedCount = 2

function RecentVisitList({ visits, onAppendVisit }) {
  const [expanded, setExpanded] = useState(false)
  const visibleVisits = expanded ? visits : visits.slice(0, collapsedCount)

  return (
    <section className="recent-section" aria-labelledby="recent-title">
      <div className="recent-section__header">
        <div>
          <p className="eyebrow">Recent visits</p>
          <h2 id="recent-title">直近の記録</h2>
        </div>
        {visits.length > collapsedCount && (
          <button type="button" className="text-button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? '閉じる' : 'すべて見る'}
          </button>
        )}
      </div>

      <div className="recent-section__list">
        {visibleVisits.map((visit) => (
          <RecentVisitCard key={`${visit.restaurant}-${visit.time}`} visit={visit} onAppend={onAppendVisit} />
        ))}
      </div>
    </section>
  )
}

export default RecentVisitList