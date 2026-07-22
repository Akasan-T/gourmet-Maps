import { useState } from 'react'
import Modal from './Modal'
import { deleteGourmetEntry } from '../api/client'
import { deriveTag, formatRelativeTime, positiveTags } from '../data/visits'

function StoreDetailModal({ store, onClose, onDeleted }) {
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')

  async function handleDelete(visit) {
    if (!window.confirm(`「${store.name}」のこの記録を削除しますか？`)) return

    setDeletingId(visit.id)
    setError('')
    try {
      await deleteGourmetEntry(visit.id)
      // データ再取得後は store が古くなるため、モーダルを閉じてから反映する
      onClose()
      onDeleted?.()
    } catch {
      setError('削除に失敗しました。もう一度お試しください。')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Modal title={store.name} onClose={onClose}>
      <p className="visit-card__menu">{store.visits.length}件の記録</p>
      {error && <p className="map-view__empty">{error}</p>}

      {store.visits.map((visit) => {
        const tag = visit.tag || deriveTag(visit)
        return (
          <article key={visit.id} className="visit-card">
            <div className="visit-card__header">
              <span className="visit-card__thumb" style={{ background: store.gradient }} aria-hidden="true">
                {store.emoji}
              </span>
              <div className="visit-card__title">
                <h3>{visit.genre}</h3>
                <p className="visit-card__menu">{visit.recordedByDisplayName ?? '記録者不明'}</p>
              </div>
              <span className="visit-card__time">{formatRelativeTime(new Date(visit.visitDate))}</span>
            </div>

            <div className="visit-card__scores" aria-label="Scores">
              <span>味 {Math.round(visit.tasteRating)}</span>
              <span>コスパ {Math.round(visit.costPerformanceRating)}</span>
              <span>雰囲気 {Math.round(visit.appearanceRating)}</span>
              <span>接客 {Math.round(visit.serviceRating ?? visit.repeatRating)}</span>
              <span>また行きたい {Math.round(visit.repeatRating)}</span>
            </div>

            {visit.photoUrl && (
              <img className="visit-card__photo" src={visit.photoUrl} alt={`${store.name}の写真`} />
            )}

            <p className="visit-card__memo">{visit.memo}</p>

            <div className="visit-card__footer">
              <span className={`visit-card__tag${positiveTags.has(tag) ? ' visit-card__tag--positive' : ''}`}>
                {tag}
              </span>
              {visit.visitType && <span className="visit-card__tag">{visit.visitType}</span>}
              {visit.sceneTag && <span className="visit-card__tag">{visit.sceneTag}</span>}
              {visit.priceRange && <span className="visit-card__tag">{visit.priceRange}</span>}
              {visit.canDelete && (
                <button
                  type="button"
                  className="text-button visit-card__delete"
                  onClick={() => handleDelete(visit)}
                  disabled={deletingId === visit.id}
                >
                  {deletingId === visit.id ? '削除中…' : '削除'}
                </button>
              )}
            </div>
          </article>
        )
      })}
    </Modal>
  )
}

export default StoreDetailModal
