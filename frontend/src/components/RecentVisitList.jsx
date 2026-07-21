import RecentVisitCard from './RecentVisitCard'

function RecentVisitList({ visits, onAppendVisit }) {
  return (
    <section className="recent-section" aria-labelledby="recent-title">
      <div className="recent-section__header">
        <div>
          <p className="eyebrow">Recent visits</p>
          <h2 id="recent-title">直近の記録</h2>
        </div>
        <button type="button" className="text-button">すべて見る</button>
      </div>

      <div className="recent-section__list">
        {visits.map((visit) => (
          <RecentVisitCard key={`${visit.restaurant}-${visit.time}`} visit={visit} onAppend={onAppendVisit} />
        ))}
      </div>
    </section>
  )
}

export default RecentVisitList