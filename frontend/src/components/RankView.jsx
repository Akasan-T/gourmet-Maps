import { useEffect, useMemo, useState } from 'react'
import { fetchCompanionRanking, fetchGenreRanking, fetchOverallRanking } from '../api/client'
import { RankBadge } from './icons'
import { storeVisual } from '../data/visits'

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
  { key: 'companions', label: '一緒に行った' },
  { key: 'criteria', label: '個別基準' },
]

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formatScore(row, criterionKey) {
  if (criterionKey === 'popularity') return `${row.popularity}件`
  return row[criterionKey].toFixed(1)
}

function StoreRankList({ items, emptyMessage, metaLabel }) {
  return (
    <div className="rank-list">
      {items.map((store, index) => {
        const visual = storeVisual(store.name)
        return (
          <article key={store.name} className="rank-item">
            <RankBadge rank={index + 1} />
            <span className="rank-item__thumb" style={{ background: visual.gradient }}>
              {visual.emoji}
            </span>
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

function RankView({ stores, members }) {
  const [mode, setMode] = useState('overall')
  const [criterion, setCriterion] = useState('taste')
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [selectedMemberId, setSelectedMemberId] = useState(null)

  const [overallRanking, setOverallRanking] = useState([])
  const [genreGroups, setGenreGroups] = useState([])
  const [companionRanking, setCompanionRanking] = useState([])

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

  const effectiveMemberId = selectedMemberId ?? members[0]?.id ?? null

  useEffect(() => {
    if (mode !== 'companions' || !effectiveMemberId) return
    fetchCompanionRanking(effectiveMemberId)
      .then(setCompanionRanking)
      .catch(() => setCompanionRanking([]))
  }, [mode, effectiveMemberId])

  const criteriaRows = useMemo(() => {
    return stores
      .map((store) => ({
        name: store.name,
        emoji: store.emoji,
        gradient: store.gradient,
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
              <article key={row.name} className="rank-item">
                <RankBadge rank={index + 1} />
                <span className="rank-item__thumb" style={{ background: row.gradient }}>
                  {row.emoji}
                </span>
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
          />
        </>
      )}

      {mode === 'companions' && (
        <>
          <div className="chip-row" role="list">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                className={`chip${effectiveMemberId === member.id ? ' chip--active' : ''}`}
                onClick={() => setSelectedMemberId(member.id)}
              >
                {member.displayName}
              </button>
            ))}
          </div>
          {members.length === 0 ? (
            <p className="map-view__empty">メンバーがいません。</p>
          ) : (
            <StoreRankList
              items={companionRanking}
              emptyMessage="まだ一緒に行ったお店がありません。"
              metaLabel={(store) => `一緒に${store.visitCount}回`}
            />
          )}
        </>
      )}
    </section>
  )
}

export default RankView
