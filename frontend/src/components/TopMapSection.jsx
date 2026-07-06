import { useEffect, useMemo, useRef, useState } from 'react'

const mapKitScriptUrl = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js'
const defaultApiBaseUrl = 'http://localhost:5001'

function normalizeEntry(entry) {
  return {
    id: entry.id ?? entry.Id,
    name: entry.name ?? entry.Name,
    genre: entry.genre ?? entry.Genre,
    visitDate: entry.visitDate ?? entry.VisitDate,
    overallRating: entry.overallRating ?? entry.OverallRating,
    tasteRating: entry.tasteRating ?? entry.TasteRating,
    repeatRating: entry.repeatRating ?? entry.RepeatRating,
    memo: entry.memo ?? entry.Memo,
    latitude: entry.latitude ?? entry.Latitude,
    longitude: entry.longitude ?? entry.Longitude,
  }
}

function formatVisitDate(value) {
  if (!value) {
    return '訪問日未設定'
  }

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value))
}

function loadMapKitScript() {
  if (globalThis.mapkit?.Map) {
    return Promise.resolve(globalThis.mapkit)
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${mapKitScriptUrl}"]`)

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(globalThis.mapkit), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Apple MapKit JS の読み込みに失敗しました。')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = mapKitScriptUrl
    script.async = true
    script.onload = () => resolve(globalThis.mapkit)
    script.onerror = () => reject(new Error('Apple MapKit JS の読み込みに失敗しました。'))
    document.head.appendChild(script)
  })
}

function ensureMapKitInitialized(mapkit, token) {
  if (globalThis.__gourmetMapsMapKitInitialized) {
    return
  }

  mapkit.init({
    authorizationCallback(done) {
      done(token)
    },
    language: 'ja',
  })

  globalThis.__gourmetMapsMapKitInitialized = true
}

function TopMapSection({ refreshKey = 0 }) {
  const [entries, setEntries] = useState([])
  const [fetchState, setFetchState] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const mapContainerRef = useRef(null)
  const appleMapToken = import.meta.env.VITE_APPLE_MAPKIT_TOKEN
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl

  useEffect(() => {
    let isMounted = true

    async function fetchEntries() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/GourmetEntries`)

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }

        const result = await response.json()
        const normalizedEntries = result.map(normalizeEntry)

        if (!isMounted) {
          return
        }

        setEntries(normalizedEntries)
        setFetchState('success')
      } catch (error) {
        if (!isMounted) {
          return
        }

        setFetchState('error')
        setErrorMessage('お店の位置情報を取得できませんでした。')
      }
    }

    fetchEntries()

    return () => {
      isMounted = false
    }
  }, [apiBaseUrl, refreshKey])

  const mapSummary = useMemo(() => {
    return entries.slice(0, 3).map((entry) => ({
      id: entry.id,
      name: entry.name,
      genre: entry.genre,
      visitDate: formatVisitDate(entry.visitDate),
      rating: Number(entry.overallRating ?? 0).toFixed(1),
    }))
  }, [entries])

  useEffect(() => {
    let cancelled = false

    async function renderMap() {
      if (!appleMapToken || !mapContainerRef.current || entries.length === 0) {
        return
      }

      try {
        const mapkit = await loadMapKitScript()

        if (cancelled || !mapkit?.Map) {
          return
        }

        ensureMapKitInitialized(mapkit, appleMapToken)

        mapContainerRef.current.innerHTML = ''

        const firstEntry = entries[0]
        const center = new mapkit.Coordinate(firstEntry.latitude, firstEntry.longitude)
        const map = new mapkit.Map(mapContainerRef.current, {
          center,
          showsCompass: mapkit.FeatureVisibility?.Hidden,
          showsMapTypeControl: false,
          isRotationEnabled: false,
          isScrollEnabled: true,
        })

        const annotations = entries.map((entry) => new mapkit.MarkerAnnotation(
          new mapkit.Coordinate(entry.latitude, entry.longitude),
          {
            title: entry.name,
            subtitle: `${entry.genre || 'ジャンル未設定'} ・ ${formatVisitDate(entry.visitDate)}`,
          },
        ))

        map.addAnnotations(annotations)

        if (typeof map.showItems === 'function') {
          map.showItems(annotations)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage('Apple Map の初期化に失敗しました。トークンを確認してください。')
        }
      }
    }

    renderMap()

    return () => {
      cancelled = true
    }
  }, [appleMapToken, entries])

  return (
    <section className="map-card" aria-labelledby="map-title">
      <div className="map-card__header">
        <div>
          <p className="eyebrow">Map overview</p>
          <h2 id="map-title">投稿したお店をすぐ見る</h2>
        </div>
        <p className="map-card__count">{entries.length} pins</p>
      </div>

      <div className="map-card__surface">
        {appleMapToken ? (
          <div ref={mapContainerRef} className="map-card__canvas" aria-label="Restaurant map"></div>
        ) : (
          <div className="map-card__empty">
            <p className="map-card__empty-title">Apple MapKit トークン待ち</p>
            <p className="map-card__empty-text">frontend の環境変数 VITE_APPLE_MAPKIT_TOKEN を設定すると、ここに投稿済み店舗のピンが表示されます。</p>
          </div>
        )}
      </div>

      <div className="map-card__status">
        {fetchState === 'loading' && <p>位置情報を読み込み中です。</p>}
        {fetchState === 'error' && <p>{errorMessage}</p>}
        {fetchState === 'success' && entries.length === 0 && <p>位置情報付きの投稿がまだありません。</p>}
        {fetchState === 'success' && entries.length > 0 && (
          <div className="map-card__legend">
            {mapSummary.map((entry) => (
              <article key={entry.id} className="map-card__legend-item">
                <p className="map-card__legend-name">{entry.name}</p>
                <p className="map-card__legend-meta">{entry.genre || 'ジャンル未設定'} ・ {entry.visitDate} ・ 総合 {entry.rating}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default TopMapSection