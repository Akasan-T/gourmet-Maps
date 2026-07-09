import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { fetchTitles } from '../api/client'

// 19カテゴリの表示名と並び順（titles.json の category に対応）
const CATEGORY_ORDER = [
  ['post_count', '投稿数'],
  ['review_count', 'レビュー数'],
  ['genre_explore', 'ジャンル別探訪'],
  ['genre_diversity', 'ジャンル制覇'],
  ['area_conquest', 'エリア制覇'],
  ['prefecture_conquest', '都道府県制覇'],
  ['high_rating_count', '高評価（★5）'],
  ['low_rating_count', '辛口評価（★1〜2）'],
  ['rating_tendency', '評価傾向'],
  ['photo_count', '写真投稿'],
  ['budget_low', 'コスパ'],
  ['budget_high', '高級店'],
  ['time_day_humor', '時間帯・曜日'],
  ['season_weather_humor', '天候・季節'],
  ['repeat_visit', 'リピート・常連'],
  ['travel_distance', '遠征・移動'],
  ['social', 'ソーシャル'],
  ['special_day', '記念日'],
  ['legendary_complete', 'レジェンド'],
]

function TitlesModal({ onClose }) {
  const [titles, setTitles] = useState([])
  const [state, setState] = useState('loading') // loading | success | error

  useEffect(() => {
    let ignore = false
    fetchTitles()
      .then((data) => {
        if (ignore) return
        setTitles(data)
        setState('success')
      })
      .catch(() => {
        if (!ignore) setState('error')
      })
    return () => {
      ignore = true
    }
  }, [])

  const earnedCount = useMemo(() => titles.filter((title) => title.earned).length, [titles])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const title of titles) {
      if (!map.has(title.category)) map.set(title.category, [])
      map.get(title.category).push(title)
    }
    for (const list of map.values()) list.sort((a, b) => a.tier - b.tier)
    return map
  }, [titles])

  const progressPercent = titles.length ? Math.round((earnedCount / titles.length) * 100) : 0

  return (
    <Modal title="称号図鑑" onClose={onClose}>
      {state === 'loading' && <p className="map-view__empty">読み込み中…</p>}
      {state === 'error' && <p className="map-view__empty">称号一覧を取得できませんでした。</p>}
      {state === 'success' && (
        <div className="titles-collection">
          <div className="titles-progress">
            <div className="titles-progress__headline">
              <span className="titles-progress__count">
                {earnedCount}
                <span className="titles-progress__total"> / {titles.length}</span>
              </span>
              <span className="titles-progress__label">称号を獲得</span>
            </div>
            <div className="titles-progress__bar" aria-hidden="true">
              <div className="titles-progress__fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          {CATEGORY_ORDER.map(([key, label]) => {
            const list = grouped.get(key)
            if (!list || list.length === 0) return null
            const gained = list.filter((title) => title.earned).length
            return (
              <section key={key} className="titles-category">
                <div className="titles-category__head">
                  <h3 className="titles-category__label">{label}</h3>
                  <span className="titles-category__count">
                    {gained}/{list.length}
                  </span>
                </div>
                <ul className="titles-category__list">
                  {list.map((title) => (
                    <li
                      key={title.id}
                      className={`title-card ${title.earned ? 'title-card--earned' : 'title-card--locked'}`}
                    >
                      <div className="title-card__top">
                        <span className="title-card__name">
                          <span className="title-card__mark" aria-hidden="true">
                            {title.earned ? '🏅' : '🔒'}
                          </span>
                          {title.name}
                        </span>
                        <span className="title-card__badges">
                          {title.humor && (
                            <span className="title-humor" title="ユーモア枠">🎭</span>
                          )}
                          <span className="title-tier">Lv.{title.tier}</span>
                        </span>
                      </div>
                      <p className="title-card__desc">{title.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export default TitlesModal
