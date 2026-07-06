import { useMemo, useState } from 'react'

const medals = ['🥇', '🥈', '🥉']

const criteria = [
  { key: 'taste', label: '味' },
  { key: 'repeat', label: '再訪したさ' },
  { key: 'volume', label: '量' },
  { key: 'popularity', label: '人気(来店数)' },
]

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formatScore(row, criterionKey) {
  if (criterionKey === 'popularity') return `${row.popularity}件`
  return row[criterionKey].toFixed(1)
}

function RankView({ stores }) {
  const [criterion, setCriterion] = useState('taste')

  const rows = useMemo(() => {
    return stores
      .map((store) => ({
        name: store.name,
        menu: store.visits[0].menu,
        emoji: store.emoji,
        gradient: store.gradient,
        taste: average(store.visits.map((visit) => visit.taste)),
        repeat: average(store.visits.map((visit) => visit.repeat)),
        volume: average(store.visits.map((visit) => visit.volume)),
        popularity: store.visits.length,
      }))
      .sort((a, b) => b[criterion] - a[criterion])
  }, [stores, criterion])

  const activeLabel = criteria.find((item) => item.key === criterion)?.label

  return (
    <section className="recent-section" aria-labelledby="rank-title">
      <div className="recent-section__header">
        <div>
          <p className="eyebrow">Rankings</p>
          <h2 id="rank-title">{activeLabel}の順位</h2>
        </div>
      </div>

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
        {rows.map((row, index) => (
          <article key={row.name} className="rank-item">
            <span className="rank-item__medal" aria-hidden="true">
              {medals[index] ?? `${index + 1}`}
            </span>
            <span className="rank-item__thumb" style={{ background: row.gradient }}>
              {row.emoji}
            </span>
            <div className="rank-item__body">
              <h3>{row.name}</h3>
              <p className="visit-card__menu">{row.menu}</p>
            </div>
            <span className="rank-item__score">{formatScore(row, criterion)}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

export default RankView
