import { positiveTags } from '../data/visits'

function RecentVisitCard({ visit }) {
  return (
    <article className="visit-card">
      <div className="visit-card__header">
        <span className="visit-card__thumb" style={{ background: visit.gradient }} aria-hidden="true">
          {visit.emoji}
        </span>
        <div className="visit-card__title">
          <h3>{visit.restaurant}</h3>
          <p className="visit-card__menu">{visit.menu}</p>
        </div>
        <span className="visit-card__time">{visit.time}</span>
      </div>

      <div className="visit-card__scores" aria-label="Scores">
        <span>味 {visit.taste}</span>
        <span>再訪 {visit.repeat}</span>
        <span>量 {visit.volume}</span>
      </div>

      <p className="visit-card__memo">{visit.memo}</p>

      <div className="visit-card__footer">
        <span className={`visit-card__tag${positiveTags.has(visit.tag) ? ' visit-card__tag--positive' : ''}`}>
          {visit.tag}
        </span>
        <button type="button" className="text-button">追記する</button>
      </div>
    </article>
  )
}

export default RecentVisitCard
