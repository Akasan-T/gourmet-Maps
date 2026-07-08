import { useMemo, useRef, useState } from 'react'
import { AttributionControl, MapContainer, Marker, Popup, TileLayer, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { createCurrentLocationIcon, createPinIcon } from './mapPinIcon'
import StoreDetailModal from './StoreDetailModal'
import Modal from './Modal'
import { extractVisitType } from '../data/visits'

const fallbackCenter = [35.7075, 139.666]
const currentLocationZoom = 16
const ratingOptions = ['5', '4', '3', '2', '1']

function MapView({ stores, onDataChange }) {
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [selectedVisitType, setSelectedVisitType] = useState('all')
  const [minTasteRating, setMinTasteRating] = useState('all')
  const [selectedStore, setSelectedStore] = useState(null)
  const [currentPosition, setCurrentPosition] = useState(null)
  const [locateState, setLocateState] = useState('idle')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const mapRef = useRef(null)

  const genreOptions = useMemo(
    () => [...new Set(stores.flatMap((store) => store.visits.map((visit) => visit.genre).filter(Boolean)))].sort(),
    [stores],
  )

  const visitTypeOptions = useMemo(
    () => [
      ...new Set(
        stores.flatMap((store) => store.visits.map((visit) => extractVisitType(visit.memo)).filter(Boolean)),
      ),
    ].sort(),
    [stores],
  )

  function handleLocate() {
    if (!navigator.geolocation) {
      setLocateState('error')
      return
    }

    setLocateState('locating')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPosition = [position.coords.latitude, position.coords.longitude]
        setCurrentPosition(nextPosition)
        setLocateState('idle')
        mapRef.current?.flyTo(nextPosition, currentLocationZoom)
      },
      () => setLocateState('error'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const filteredStores = useMemo(() => {
    if (selectedGenre === 'all' && selectedVisitType === 'all' && minTasteRating === 'all') return stores

    const minTaste = minTasteRating === 'all' ? null : Number(minTasteRating)

    return stores
      .map((store) => ({
        ...store,
        visits: store.visits.filter((visit) => {
          if (selectedGenre !== 'all' && visit.genre !== selectedGenre) return false
          if (selectedVisitType !== 'all' && extractVisitType(visit.memo) !== selectedVisitType) return false
          if (minTaste !== null && visit.tasteRating < minTaste) return false
          return true
        }),
      }))
      .filter((store) => store.visits.length > 0)
  }, [stores, selectedGenre, selectedVisitType, minTasteRating])

  const locatedStores = useMemo(
    () => filteredStores.filter((store) => typeof store.lat === 'number' && typeof store.lng === 'number'),
    [filteredStores],
  )

  const center = locatedStores.length
    ? [
        locatedStores.reduce((sum, store) => sum + store.lat, 0) / locatedStores.length,
        locatedStores.reduce((sum, store) => sum + store.lng, 0) / locatedStores.length,
      ]
    : fallbackCenter

  return (
    <section className="map-page" aria-label="地図">
      <div className="map-page__canvas">
        <MapContainer
          ref={mapRef}
          center={center}
          zoom={14}
          scrollWheelZoom={false}
          zoomControl={false}
          attributionControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <ZoomControl position="bottomleft" />
          <AttributionControl position="bottomright" prefix={false} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {currentPosition && (
            <Marker position={currentPosition} icon={createCurrentLocationIcon()}>
              <Popup>現在地</Popup>
            </Marker>
          )}
          {locatedStores.map((store) => (
            <Marker key={store.name} position={[store.lat, store.lng]} icon={createPinIcon(store.color)}>
              <Popup>
                <div className="map-popup">
                  <span className="map-popup__thumb" style={{ background: store.gradient }}>
                    {store.emoji}
                  </span>
                  <div>
                    <strong>{store.name}</strong>
                    <p>
                      味 {Math.round(store.visits[0].tasteRating)}
                      {store.visits.length > 1 ? ` ・${store.visits.length}件の記録` : ''}
                    </p>
                  </div>
                </div>
                <button type="button" className="map-popup__button" onClick={() => setSelectedStore(store)}>
                  詳細を見る
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="map-page__controls">
        <button
          type="button"
          className="map-page__control-button"
          onClick={() => setIsFilterOpen(true)}
          aria-label="絞り込み"
          title="絞り込み"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
            <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
            <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
            <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button
          type="button"
          className="map-page__control-button"
          onClick={handleLocate}
          disabled={locateState === 'locating'}
          aria-label="現在地を表示"
          title="現在地を表示"
        >
          {locateState === 'locating' ? '…' : '📍'}
        </button>
        {locateState === 'error' && (
          <p className="map-page__control-error">現在地を取得できませんでした</p>
        )}
      </div>

      {isFilterOpen && (
        <Modal title="絞り込み" onClose={() => setIsFilterOpen(false)}>
          {genreOptions.length > 0 && (
            <div className="field">
              <span className="field__label">ジャンル</span>
              <div className="chip-row" role="list">
                <button
                  type="button"
                  className={`chip${selectedGenre === 'all' ? ' chip--active' : ''}`}
                  onClick={() => setSelectedGenre('all')}
                >
                  すべて
                </button>
                {genreOptions.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    className={`chip${selectedGenre === genre ? ' chip--active' : ''}`}
                    onClick={() => setSelectedGenre(genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <span className="field__label">味の評価（この値以上）</span>
            <div className="chip-row" role="list">
              <button
                type="button"
                className={`chip${minTasteRating === 'all' ? ' chip--active' : ''}`}
                onClick={() => setMinTasteRating('all')}
              >
                すべて
              </button>
              {ratingOptions.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={`chip${minTasteRating === rating ? ' chip--active' : ''}`}
                  onClick={() => setMinTasteRating(rating)}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>

          {visitTypeOptions.length > 0 && (
            <div className="field">
              <span className="field__label">訪問タイプ</span>
              <div className="chip-row" role="list">
                <button
                  type="button"
                  className={`chip${selectedVisitType === 'all' ? ' chip--active' : ''}`}
                  onClick={() => setSelectedVisitType('all')}
                >
                  すべて
                </button>
                {visitTypeOptions.map((visitType) => (
                  <button
                    key={visitType}
                    type="button"
                    className={`chip${selectedVisitType === visitType ? ' chip--active' : ''}`}
                    onClick={() => setSelectedVisitType(visitType)}
                  >
                    {visitType}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="map-filter-list">
            <div className="recent-section__header">
              <div>
                <p className="eyebrow">Saved spots</p>
                <h2>保存したお店</h2>
              </div>
            </div>
            {filteredStores.map((store) => (
              <article
                key={store.name}
                className="map-spot"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedStore(store)
                  setIsFilterOpen(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setSelectedStore(store)
                    setIsFilterOpen(false)
                  }
                }}
              >
                <span className="map-spot__dot" style={{ background: store.color }}></span>
                <div>
                  <h3>{store.name}</h3>
                  <p className="visit-card__menu">{store.visits.length}件の記録</p>
                </div>
              </article>
            ))}
            {filteredStores.length === 0 && <p className="map-view__empty">該当するお店がありません。</p>}
          </div>
        </Modal>
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

export default MapView
