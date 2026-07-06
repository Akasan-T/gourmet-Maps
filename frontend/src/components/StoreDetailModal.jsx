import Modal from './Modal'
import { deriveTag, formatRelativeTime, participantNames, positiveTags } from '../data/visits'

function StoreDetailModal({ store, onClose }) {
  return (
    <Modal title={store.name} onClose={onClose}>
      <p className="visit-card__menu">{store.visits.length}件の記録</p>

      {store.visits.map((visit) => {
        const tag = deriveTag(visit)
        const names = participantNames(visit)
        return (
          <article key={visit.id} className="visit-card">
            <div className="visit-card__header">
              <span className="visit-card__thumb" style={{ background: store.gradient }} aria-hidden="true">
                {store.emoji}
              </span>
              <div className="visit-card__title">
                <h3>{visit.genre}</h3>
                <p className="visit-card__menu">{names.length > 0 ? names.join('・') : '記録者不明'}</p>
              </div>
              <span className="visit-card__time">{formatRelativeTime(new Date(visit.visitDate))}</span>
            </div>

            <div className="visit-card__scores" aria-label="Scores">
              <span>味 {visit.tasteRating.toFixed(1)}</span>
              <span>再訪 {visit.repeatRating.toFixed(1)}</span>
              <span>量 {visit.volumeRating.toFixed(1)}</span>
            </div>

            <p className="visit-card__memo">{visit.memo}</p>

            <div className="visit-card__footer">
              <span className={`visit-card__tag${positiveTags.has(tag) ? ' visit-card__tag--positive' : ''}`}>
                {tag}
              </span>
            </div>
          </article>
        )
      })}
    </Modal>
  )
}

export default StoreDetailModal
