import Modal from './Modal'
import { formatRelativeTime, positiveTags } from '../data/visits'

function StoreDetailModal({ store, onClose }) {
  return (
    <Modal title={store.name} onClose={onClose}>
      <p className="visit-card__menu">{store.visits.length}件の記録</p>

      {store.visits.map((visit) => (
        <article key={visit.id} className="visit-card">
          <div className="visit-card__header">
            <span className="visit-card__thumb" style={{ background: store.gradient }} aria-hidden="true">
              {store.emoji}
            </span>
            <div className="visit-card__title">
              <h3>{visit.menu}</h3>
              <p className="visit-card__menu">{visit.member.name}</p>
            </div>
            <span className="visit-card__time">{formatRelativeTime(visit.visitedAt)}</span>
          </div>

          <div className="visit-card__scores" aria-label="Scores">
            <span>味 {visit.taste.toFixed(1)}</span>
            <span>再訪 {visit.repeat.toFixed(1)}</span>
            <span>量 {visit.volume.toFixed(1)}</span>
          </div>

          <p className="visit-card__memo">{visit.memo}</p>

          <div className="visit-card__footer">
            <span className={`visit-card__tag${positiveTags.has(visit.tag) ? ' visit-card__tag--positive' : ''}`}>
              {visit.tag}
            </span>
          </div>
        </article>
      ))}
    </Modal>
  )
}

export default StoreDetailModal
