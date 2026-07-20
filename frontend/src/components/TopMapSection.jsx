import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { createPinIcon } from './mapPinIcon'
import { storeVisual } from '../data/visits'

const defaultApiBaseUrl = 'http://localhost:5001'
const defaultCenter = [35.6812, 139.7671]

const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

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

function FitToMarkers({ entries, userPosition }) {
  const map = useMap()

  useEffect(() => {
    const points = entries
      .filter((entry) => typeof entry.latitude === 'number' && typeof entry.longitude === 'number')
      .map((entry) => [entry.latitude, entry.longitude])

    if (userPosition) {
      points.push([userPosition.lat, userPosition.lng])
    }

    if (points.length === 0) {
      return
    }

    if (points.length === 1) {
      map.setView(points[0], 16)
      return
    }

    map.fitBounds(points, { padding: [32, 32] })
  }, [entries, userPosition, map])

  return null
}

function TopMapSection({ refreshKey = 0 }) {
  const [entries, setEntries] = useState([])
  const [fetchState, setFetchState] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [userPosition, setUserPosition] = useState(null)
  const [locateState, setLocateState] = useState('idle')
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
      } catch {
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

  function handleLocateMe() {
    if (!navigator.geolocation) {
      setLocateState('error')
      return
    }

    setLocateState('loading')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocateState('success')
      },
      () => {
        setLocateState('error')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const initialCenter = entries[0]
    ? [entries[0].latitude, entries[0].longitude]
    : defaultCenter

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
        <div className="map-card__canvas">
          <MapContainer center={initialCenter} zoom={15} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {entries.map((entry) => (
              typeof entry.latitude === 'number' && typeof entry.longitude === 'number' ? (
                <Marker
                  key={entry.id}
                  position={[entry.latitude, entry.longitude]}
                  icon={createPinIcon(storeVisual(entry.name, entry.genre))}
                >
                  <Popup>
                    <strong>{entry.name}</strong>
                    <br />
                    {entry.genre || 'ジャンル未設定'} ・ {formatVisitDate(entry.visitDate)}
                  </Popup>
                </Marker>
              ) : null
            ))}
            {userPosition && (
              <Marker position={[userPosition.lat, userPosition.lng]} icon={userLocationIcon}>
                <Popup>現在地</Popup>
              </Marker>
            )}
            <FitToMarkers entries={entries} userPosition={userPosition} />
          </MapContainer>
          <button
            type="button"
            className="map-card__locate-button"
            onClick={handleLocateMe}
            disabled={locateState === 'loading'}
          >
            {locateState === 'loading' ? '取得中…' : '現在地'}
          </button>
        </div>
      </div>

      <div className="map-card__status">
        {fetchState === 'loading' && <p>位置情報を読み込み中です。</p>}
        {fetchState === 'error' && <p>{errorMessage}</p>}
        {locateState === 'error' && <p>現在地を取得できませんでした。位置情報の利用を許可してください。</p>}
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
