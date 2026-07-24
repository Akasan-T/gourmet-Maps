import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchGenreRanking, fetchLastSupperRanking, fetchOverallRanking, updateLastSupperRanking } from '../api/client'
import { CrownIcon, RankBadge } from './icons'
import './LastSupper.css'
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

  const listRef = useRef(null)
  const rankingRef = useRef(ranking)
  rankingRef.current = ranking
  const dragRef = useRef({
    active: false,
    index: -1,
    target: -1,
    offsetY: 0,
    itemTops: [],
    itemHeight: 0,
    gap: 0,
    timer: null,
    indicatorEl: null,
    items: [],
    rafId: null,
    lastEvent: null,
  })

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
    } finally {
      setSaving(false)
    }
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

  function showIndicator(list, targetIndex, dragIndex) {
    const d = dragRef.current
    if (!d.indicatorEl) {
      d.indicatorEl = document.createElement('div')
      d.indicatorEl.className = 'ls-drop-indicator'
    }
    const items = [...list.querySelectorAll('[data-ls-item]')]
    const listRect = list.getBoundingClientRect()

    let top
    if (targetIndex <= dragIndex) {
      top = items[targetIndex].getBoundingClientRect().top - listRect.top - d.gap / 2
    } else {
      top = items[targetIndex].getBoundingClientRect().bottom - listRect.top + d.gap / 2
    }
    d.indicatorEl.style.top = `${top}px`
    if (!d.indicatorEl.parentElement) list.appendChild(d.indicatorEl)
  }

  function hideIndicator() {
    const d = dragRef.current
    if (d.indicatorEl?.parentElement) d.indicatorEl.remove()
  }

  function handlePointerDown(e, index) {
    if (e.target.closest('button') || saving) return

    const startY = e.clientY
    const startX = e.clientX
    const d = dragRef.current
    d.index = index

    const list = listRef.current
    const items = list ? [...list.querySelectorAll('[data-ls-item]')] : []
    const holdTarget = items[index]

    if (holdTarget) holdTarget.classList.add('ls-rank-item--holding')

    function activate() {
      d.active = true
      if (!list) return

      if (holdTarget) holdTarget.classList.remove('ls-rank-item--holding')

      const listRect = list.getBoundingClientRect()
      const freshItems = [...list.querySelectorAll('[data-ls-item]')]
      d.items = freshItems

      d.itemTops = freshItems.map((el) => el.getBoundingClientRect().top - listRect.top)
      d.itemHeight = freshItems[0]?.offsetHeight ?? 0
      d.gap = freshItems.length > 1
        ? freshItems[1].getBoundingClientRect().top - freshItems[0].getBoundingClientRect().bottom
        : 10
      d.offsetY = startY - freshItems[index].getBoundingClientRect().top
      d.target = index

      for (const el of freshItems) el.style.transition = 'transform 0.2s ease'
      freshItems[d.index].style.transition = ''
      freshItems[index].classList.add('ls-rank-item--dragging')
      list.classList.add('ls-rank-list--active')
      document.body.style.overflow = 'hidden'

      if (navigator.vibrate) navigator.vibrate(30)
    }

    d.timer = setTimeout(activate, 300)

    function applyMove() {
      d.rafId = null
      const ev = d.lastEvent
      if (!d.active || !list || !ev) return

      const listTop = d.listTop

      const dy = ev.clientY - (listTop + d.itemTops[d.index]) - d.offsetY
      d.items[d.index].style.transform = `translateY(${dy}px) scale(1.03)`
      d.items[d.index].style.zIndex = '10'

      const draggedCenter = ev.clientY - d.offsetY + d.itemHeight / 2
      let target = 0
      for (let i = 0; i < d.itemTops.length; i++) {
        if (draggedCenter > listTop + d.itemTops[i] + d.itemHeight / 2) target = i
      }
      d.target = Math.max(0, Math.min(target, d.items.length - 1))

      if (d.target !== d.index) {
        showIndicator(list, d.target, d.index)
      } else {
        hideIndicator()
      }

      const shift = d.itemHeight + d.gap
      for (let i = 0; i < d.items.length; i++) {
        if (i === d.index) continue
        let s = 0
        if (d.index < d.target && i > d.index && i <= d.target) s = -shift
        else if (d.index > d.target && i < d.index && i >= d.target) s = shift
        d.items[i].style.transform = s ? `translateY(${s}px)` : ''
      }
    }

    function onMove(ev) {
      if (!d.active && d.timer) {
        if (Math.abs(ev.clientX - startX) > 8 || Math.abs(ev.clientY - startY) > 8) {
          clearTimeout(d.timer)
          d.timer = null
          if (holdTarget) holdTarget.classList.remove('ls-rank-item--holding')
          teardown()
        }
        return
      }
      if (!d.active) return
      ev.preventDefault()

      if (!list) return
      d.listTop = list.getBoundingClientRect().top
      d.lastEvent = ev
      if (d.rafId == null) d.rafId = requestAnimationFrame(applyMove)
    }

    function onEnd() {
      clearTimeout(d.timer)
      d.timer = null
      if (d.rafId != null) {
        cancelAnimationFrame(d.rafId)
        d.rafId = null
      }

      if (holdTarget) holdTarget.classList.remove('ls-rank-item--holding')
      hideIndicator()

      if (d.active) {
        if (list) {
          const settledItems = [...list.querySelectorAll('[data-ls-item]')]
          for (const el of settledItems) {
            el.style.transition = 'none'
            el.style.transform = ''
            el.style.zIndex = ''
            el.classList.remove('ls-rank-item--dragging')
          }
          list.classList.remove('ls-rank-list--active')
          requestAnimationFrame(() => {
            for (const el of settledItems) el.style.transition = ''
          })
        }
        document.body.style.overflow = ''

        if (d.index !== d.target) {
          const r = rankingRef.current
          const next = [...r]
          const [moved] = next.splice(d.index, 1)
          next.splice(d.target, 0, moved)
          setRanking(next)
          persist(next.map((item) => item.id))
        }
        d.active = false
      }
      teardown()
    }

    function teardown() {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onEnd)
      document.removeEventListener('pointercancel', onEnd)
    }

    document.addEventListener('pointermove', onMove, { passive: false })
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onEnd)
  }

  if (loading) {
    return <p className="map-view__empty">読み込み中…</p>
  }

  return (
    <div className="ls-section">
      <p className="ls-section__tagline">もしこれが人生最後の食事だとしたら、選ぶ{LAST_SUPPER_MAX}皿は？</p>

      {ranking.length > 0 && (
        <div className="ls-rank-list" ref={listRef}>
          {ranking.map((item, index) => {
            const visual = storeVisual(item.name, item.genre)
            const isTop = index === 0
            return (
              <article
                key={item.id}
                data-ls-item
                className={`ls-rank-item${isTop ? ' ls-rank-item--top' : ''}`}
                onPointerDown={(e) => handlePointerDown(e, index)}
              >
                <span className="ls-rank-item__handle" aria-hidden="true">⠿</span>
                {isTop ? (
                  <span className="ls-rank-item__crown"><CrownIcon size={16} /></span>
                ) : (
                  <RankBadge rank={index + 1} />
                )}
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
                  <button type="button" disabled={saving} onClick={() => removeItem(item.id)}>✕</button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {ranking.length === 0 && <p className="map-view__empty">まだ選ばれていません。下の候補から追加しましょう。</p>}

      {ranking.length < LAST_SUPPER_MAX && (
        <>
          <div className="recent-section__header">
            <h3>候補から追加 ({ranking.length}/{LAST_SUPPER_MAX})</h3>
          </div>
          <input
            type="text"
            className="ls-search"
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
                  <button type="button" className="ls-add-btn" disabled={saving} onClick={() => addItem(entry.id)}>
                    + 追加
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
  const [lastSupperOpen, setLastSupperOpen] = useState(false)
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
  const activeModeLabel = lastSupperOpen ? 'あなたの最後の晩餐' : `${modes.find((item) => item.key === mode)?.label}の順位`

  return (
    <section className="recent-section" aria-labelledby="rank-title">
      <div className="recent-section__header">
        <div>
          <p className="eyebrow">{lastSupperOpen ? 'The Last Supper' : 'Rankings'}</p>
          <h2 id="rank-title">{activeModeLabel}</h2>
        </div>
        <button
          type="button"
          className={`ls-toggle-btn${lastSupperOpen ? ' ls-toggle-btn--active' : ''}`}
          onClick={() => setLastSupperOpen((open) => !open)}
        >
          <CrownIcon size={14} />
          最後の晩餐
        </button>
      </div>

      {!lastSupperOpen && (
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
      )}

      {lastSupperOpen && <LastSupperSection entries={entries} />}

      {!lastSupperOpen && mode === 'criteria' && (
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

      {!lastSupperOpen && mode === 'overall' && (
        <StoreRankList
          items={overallRanking}
          emptyMessage="まだ記録がありません。"
          metaLabel={(store) => `${store.genre} ・ ${store.visitCount}件`}
          onSelect={selectStoreByName}
        />
      )}

      {!lastSupperOpen && mode === 'genre' && (
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
