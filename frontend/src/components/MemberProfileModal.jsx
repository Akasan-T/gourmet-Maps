import { useEffect, useState } from 'react'
import Modal from './Modal'
import { fetchMemberProfile } from '../api/client'
import { deriveTag, formatRelativeTime, groupEntriesByStore, positiveTags } from '../data/visits'

// メンバーのアイコンをタップしたときに開く個別プロフィール。
// その人が登録した店舗(投稿)と、獲得済み称号の状況を表示する。
function MemberProfileModal({ member, onClose }) {
  const [profile, setProfile] = useState(null)
  const [loadState, setLoadState] = useState('loading') // loading | success | error

  useEffect(() => {
    let ignore = false

    fetchMemberProfile(member.id)
      .then((result) => {
        if (ignore) return
        setProfile(result)
        setLoadState('success')
      })
      .catch(() => {
        if (!ignore) setLoadState('error')
      })

    return () => {
      ignore = true
    }
  }, [member.id])

  const stores = profile ? groupEntriesByStore(profile.entries) : []

  return (
    <Modal title={member.displayName} onClose={onClose}>
      <div className="member-profile__header">
        <span className="member-profile__avatar" aria-hidden="true">
          {member.avatarUrl ? (
            <img className="member-profile__avatar-image" src={member.avatarUrl} alt="" />
          ) : (
            member.displayName.charAt(0)
          )}
        </span>
        {profile && (
          <div className="member-profile__stats">
            <span>
              <strong>{profile.storeCount}</strong>店
            </span>
            <span>
              <strong>{profile.entryCount}</strong>件の記録
            </span>
            <span>
              称号 <strong>{profile.earnedTitleCount}</strong>/{profile.totalTitleCount}
            </span>
          </div>
        )}
      </div>

      {loadState === 'loading' && <p className="map-view__empty">読み込み中…</p>}
      {loadState === 'error' && <p className="map-view__empty">プロフィールを取得できませんでした。</p>}

      {loadState === 'success' && profile && (
        <>
          <section className="member-profile__section">
            <h3 className="member-profile__section-title">獲得ずみの称号</h3>
            {profile.titles.length > 0 ? (
              <div className="chip-row" role="list">
                {profile.titles.map((title) => (
                  <span key={title.name} className="chip chip--active" role="listitem">
                    {title.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="profile-empty-hint">まだ獲得した称号はありません。</p>
            )}
          </section>

          <section className="member-profile__section">
            <h3 className="member-profile__section-title">登録した店舗</h3>
            {stores.length === 0 ? (
              <p className="profile-empty-hint">まだ登録した店舗はありません。</p>
            ) : (
              stores.map((store) => (
                <article key={store.name} className="visit-card">
                  <div className="visit-card__header">
                    <span className="visit-card__thumb" style={{ background: store.gradient }} aria-hidden="true">
                      {store.emoji}
                    </span>
                    <div className="visit-card__title">
                      <h3>{store.name}</h3>
                      <p className="visit-card__menu">{store.visits.length}件の記録</p>
                    </div>
                    <span className="visit-card__time">
                      {formatRelativeTime(new Date(store.visits[0].visitDate))}
                    </span>
                  </div>

                  {store.visits.map((visit) => {
                    const tag = deriveTag(visit)
                    return (
                      <div key={visit.id} className="member-profile__visit">
                        <div className="visit-card__scores" aria-label="Scores">
                          <span>味 {Math.round(visit.tasteRating)}</span>
                          <span>コスパ {Math.round(visit.costPerformanceRating)}</span>
                          <span>雰囲気 {Math.round(visit.appearanceRating)}</span>
                          <span>接客 {Math.round(visit.serviceRating ?? visit.repeatRating)}</span>
                          <span>また行きたい {Math.round(visit.repeatRating)}</span>
                        </div>
                        {visit.memo && <p className="visit-card__memo">{visit.memo}</p>}
                        <div className="visit-card__footer">
                          <span
                            className={`visit-card__tag${positiveTags.has(tag) ? ' visit-card__tag--positive' : ''}`}
                          >
                            {tag}
                          </span>
                          {visit.sceneTag && <span className="visit-card__tag">{visit.sceneTag}</span>}
                          {visit.priceRange && <span className="visit-card__tag">{visit.priceRange}</span>}
                        </div>
                      </div>
                    )
                  })}
                </article>
              ))
            )}
          </section>
        </>
      )}
    </Modal>
  )
}

export default MemberProfileModal
