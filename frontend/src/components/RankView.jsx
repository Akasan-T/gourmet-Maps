import { useEffect, useMemo, useState } from 'react'
import { fetchGenreRanking, fetchLastSupperRanking, fetchOverallRanking, updateLastSupperRanking } from '../api/client'
import { RankBadge } from './icons'
import { storeVisual } from '../data/visits'
import StoreDetailModal from './StoreDetailModal'

const LAST_SUPPER_MAX = 10

const criteria = [
  { key: 'taste', label: '味' },
  { key: 'cost', label: 'コスパ' },
  { key: 'atmosphere', label: '雰囲気' },
  { key: 'service', label: '接客' },
  { key: 'repeat', label: 'また行きたいか' },
  { key: 'popularity', label: '人気(来店数)' },
]

const modes = [
  { key: 'overall', label: '総合' },
  { key: 'genre', label: 'ジャンル別' },
  { key: 'criteria', label: '個別基準' },
  { key: 'lastsupper', label: '最後の晩餐' },
]

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formatScore(row, criterionKey) {
  if (criterionKey === 'popularity') return `${row.popularity}件`
  return row[criterionKey].toFixed(1)
}

function StoreRankList({ items, emptyMessage, metaLabel, onSelect }) {
  return (
    <div className="rank-list">
      {items.map((store, index) => {
        const visual = storeVisual(store.name, store.genre)
        return (
          <article
            key={store.name}
            className="rank-item"
            role="button"
            tabIndex={0}
            onClick={() => onSelect(store.name)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSelect(store.name)
            }}
          >
            <RankBadge rank={index + 1} />
            {store.photoUrl ? (
              <img className="rank-item__thumb" src={store.photoUrl} style={{ objectFit: 'cover' }} alt="" />
            ) : (
              <span className="rank-item__thumb" style={{ background: visual.gradient }}>
                {visual.emoji}
              </span>
            )}
            <div className="rank-item__body">
              <h3>{store.name}</h3>
              <p className="visit-card__menu">
                {metaLabel(store)}
                {typeof store.bayesianScore === 'number' ? ` ・ 平均${store.averageOverallRating.toFixed(1)}` : ''}
              </p>
            </div>
            <span className="rank-item__score" title="また行きたいか(Bayesian補正)">
              {(typeof store.bayesianScore === 'number' ? store.bayesianScore : store.averageOverallRating).toFixed(1)}
            </span>
          </article>
        )
      })}
      {items.length === 0 && <p className="map-view__empty">{emptyMessage}</p>}
    </div>
  )
}

function LastSupperSection({ entries }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchLastSupperRanking()
      .then((result) => {
        setRanking(result)
        setLoading(false)
      })
      .catch(() => {
        setRanking([])
        setLoading(false)
      })
  }, [])

  async function persist(orderedIds) {
    setSaving(true)
    try {
      const result = await updateLastSupperRanking(orderedIds)
      setRanking(result)
    } catch {
      // 保存失敗時は次回操作時にリトライされる。表示は現状維持。
    } finally {
      setSaving(false)
    }
  }

  function moveTo(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= ranking.length) return
    const next = [...ranking]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    persist(next.map((item) => item.id))
  }

  function removeItem(id) {
    persist(ranking.filter((item) => item.id !== id).map((item) => item.id))
  }

  function addItem(id) {
    if (ranking.length >= LAST_SUPPER_MAX) return
    persist([...ranking.map((item) => item.id), id])
  }

  const rankedIds = useMemo(() => new Set(ranking.map((item) => item.id)), [ranking])

  const candidates = useMemo(() => {
    const query = search.trim().toLowerCase()
    return entries
      .filter((entry) => !rankedIds.has(entry.id))
      .filter((entry) => {
        if (!query) return true
        return (
          entry.name.toLowerCase().includes(query) ||
          (entry.menuName ?? '').toLowerCase().includes(query)
        )
      })
      .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
      .slice(0, 20)
  }, [entries, rankedIds, search])

  if (loading) {
    return <p className="map-view__empty">読み込み中…</p>
  }

  return (
    <div className="last-supper-section">
      <p className="visit-card__menu">もしこれが最後の食事だとしたら、選ぶ{LAST_SUPPER_MAX}皿は？</p>

      <div className="rank-list rank-list--lastsupper">
      {ranking.map((item, index) => {
        const visual = storeVisual(item.name, item.genre)
        return (
          <article key={item.id} className="rank-item">
            <RankBadge rank={index + 1} />
            {item.photoUrl ? (
              <img className="rank-item__thumb" src={item.photoUrl} style={{ objectFit: 'cover' }} alt="" />
            ) : (
              <span className="rank-item__thumb" style={{ background: visual.gradient }}>
                {visual.emoji}
              </span>
            )}
            <div className="rank-item__body">
              <h3>{item.name}</h3>
              <p className="visit-card__menu">{item.menuName ?? item.genre}</p>
            </div>
            <div className="rank-item__actions">
              <button type="button" disabled={saving || index === 0} onClick={() => moveTo(index, index - 1)}>
                ▲
              </button>
              <button
                type="button"
                disabled={saving || index === ranking.length - 1}
                onClick={() => moveTo(index, index + 1)}
              >
                ▼
              </button>
              <button type="button" disabled={saving} onClick={() => removeItem(item.id)}>
                ✕
              </button>
            </div>
          </article>
        )
      })}
      {ranking.length === 0 && <p className="map-view__empty">まだ選ばれていません。下の候補から追加しましょう。</p>}
      </div>

      {ranking.length < LAST_SUPPER_MAX && (
        <>
          <div className="recent-section__header">
            <h3>候補から追加 ({ranking.length}/{LAST_SUPPER_MAX})</h3>
          </div>
          <input
            type="text"
            className="quick-composer__input"
            placeholder="店名・メニューで検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="rank-list rank-list--candidates">
          {candidates.map((entry) => {
            const visual = storeVisual(entry.name, entry.genre)
            return (
              <article key={entry.id} className="rank-item">
                {entry.photoUrl ? (
                  <img className="rank-item__thumb" src={entry.photoUrl} style={{ objectFit: 'cover' }} alt="" />
                ) : (
                  <span className="rank-item__thumb" style={{ background: visual.gradient }}>
                    {visual.emoji}
                  </span>
                )}
                <div className="rank-item__body">
                  <h3>{entry.name}</h3>
                  <p className="visit-card__menu">{entry.menuName ?? entry.genre}</p>
                </div>
                <button type="button" disabled={saving} onClick={() => addItem(entry.id)}>
                  追加
                </button>
              </article>
            )
          })}
          {candidates.length === 0 && <p className="map-view__empty">該当する記録がありません。</p>}
          </div>
        </>
      )}
    </div>
  )
}

function RankView({ stores, entries, onDataChange }) {
  const [mode, setMode] = useState('overall')
  const [criterion, setCriterion] = useState('taste')
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [selectedStore, setSelectedStore] = useState(null)

  function selectStoreByName(name) {
    const store = stores.find((item) => item.name === name)
    if (store) setSelectedStore(store)
  }

  const [overallRanking, setOverallRanking] = useState([])
  const [genreGroups, setGenreGroups] = useState([])

  useEffect(() => {
    if (mode !== 'overall') return
    fetchOverallRanking()
      .then(setOverallRanking)
      .catch(() => setOverallRanking([]))
  }, [mode])

  useEffect(() => {
    if (mode !== 'genre') return
    fetchGenreRanking()
      .then(setGenreGroups)
      .catch(() => setGenreGroups([]))
  }, [mode])

  const criteriaRows = useMemo(() => {
    return stores
      .map((store) => ({
        name: store.name,
        emoji: store.emoji,
        gradient: store.gradient,
        photoUrl: store.visits[0]?.photoUrl ?? null,
        genre: store.visits[0]?.genre ?? '未設定',
        taste: average(store.visits.map((visit) => visit.tasteRating)),
        cost: average(store.visits.map((visit) => visit.costPerformanceRating)),
        atmosphere: average(store.visits.map((visit) => visit.appearanceRating)),
        service: average(store.visits.map((visit) => visit.serviceRating ?? visit.repeatRating)),
        repeat: average(store.visits.map((visit) => visit.repeatRating)),
        popularity: store.visits.length,
      }))
      .sort((a, b) => b[criterion] - a[criterion])
  }, [stores, criterion])

  const effectiveGenre = selectedGenre ?? genreGroups[0]?.genre ?? null
  const activeGenreGroup = genreGroups.find((group) => group.genre === effectiveGenre)
  const activeModeLabel = modes.find((item) => item.key === mode)?.label

  return (
    <section className="recent-section" aria-labelledby="rank-title">
      <div className="recent-section__header">
        <div>
          <p className="eyebrow">Rankings</p>
          <h2 id="rank-title">{activeModeLabel}の順位</h2>
        </div>
      </div>

      <div className="chip-row" role="list">
        {modes.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`chip${mode === item.key ? ' chip--active' : ''}`}
            onClick={() => setMode(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === 'criteria' && (
        <>
          <div className="chip-row" role="list">
            {criteria.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`chip${criterion === item.key ? ' chip--active' : ''}`}
                onClick={() => setCriterion(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="rank-list">
            {criteriaRows.map((row, index) => (
              <article
                key={row.name}
                className="rank-item"
                role="button"
                tabIndex={0}
                onClick={() => selectStoreByName(row.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') selectStoreByName(row.name)
                }}
              >
                <RankBadge rank={index + 1} />
                {row.photoUrl ? (
                  <img className="rank-item__thumb" src={row.photoUrl} style={{ objectFit: 'cover' }} alt="" />
                ) : (
                  <span className="rank-item__thumb" style={{ background: row.gradient }}>
                    {row.emoji}
                  </span>
                )}
                <div className="rank-item__body">
                  <h3>{row.name}</h3>
                  <p className="visit-card__menu">{row.genre}</p>
                </div>
                <span className="rank-item__score">{formatScore(row, criterion)}</span>
              </article>
            ))}
            {criteriaRows.length === 0 && <p className="map-view__empty">まだ記録がありません。</p>}
          </div>
        </>
      )}

      {mode === 'overall' && (
        <StoreRankList
          items={overallRanking}
          emptyMessage="まだ記録がありません。"
          metaLabel={(store) => `${store.genre} ・ ${store.visitCount}件`}
          onSelect={selectStoreByName}
        />
      )}

      {mode === 'genre' && (
        <>
          <div className="chip-row" role="list">
            {genreGroups.map((group) => (
              <button
                key={group.genre}
                type="button"
                className={`chip${effectiveGenre === group.genre ? ' chip--active' : ''}`}
                onClick={() => setSelectedGenre(group.genre)}
              >
                {group.genre}
              </button>
            ))}
          </div>
          <StoreRankList
            items={activeGenreGroup?.stores ?? []}
            emptyMessage="まだ記録がありません。"
            metaLabel={(store) => `${store.visitCount}件`}
            onSelect={selectStoreByName}
          />
        </>
      )}

      {mode === 'lastsupper' && <LastSupperSection entries={entries} />}

      {selectedStore && (
        <StoreDetailModal
          store={selectedStore}
          onClose={() => setSelectedStore(null)}
          onDeleted={onDataChange}
        />
      )}
    </section>
  )
}

export default RankView
