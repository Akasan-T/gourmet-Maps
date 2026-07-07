import { useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { createCurrentLocationIcon, createPinIcon } from './mapPinIcon'
import StoreDetailModal from './StoreDetailModal'
import { participantNames, storeVisual } from '../data/visits'

const medals = ['🥇', '🥈', '🥉']
const fallbackCenter = [35.7075, 139.666]
const currentLocationZoom = 16

function HomeView({ stores, ranking }) {
  const [selectedStore, setSelectedStore] = useState(null)
  const [currentPosition, setCurrentPosition] = useState(null)
  const [locateState, setLocateState] = useState('idle')
  const mapRef = useRef(null)

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

  const locatedStores = stores.filter((store) => typeof store.lat === 'number' && typeof store.lng === 'number')

  const center = locatedStores.length
    ? [
        locatedStores.reduce((sum, store) => sum + store.lat, 0) / locatedStores.length,
        locatedStores.reduce((sum, store) => sum + store.lng, 0) / locatedStores.length,
      ]
    : fallbackCenter

  return (
    <>
      <section className="map-view" aria-labelledby="home-map-title">
        <div className="map-view__toolbar">
          <p className="eyebrow">Last 24 hours</p>
          <h2 id="home-map-title">直近24時間に行ったお店</h2>
        </div>

        <div className="map-view__canvas">
          <MapContainer
            ref={mapRef}
            center={center}
            zoom={14}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
          >
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
                        味 {store.visits[0].tasteRating.toFixed(1)}
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

          <button
            type="button"
            className="map-view__locate-button"
            onClick={handleLocate}
            disabled={locateState === 'locating'}
            aria-label="現在地を表示"
            title="現在地を表示"
          >
            {locateState === 'locating' ? '…' : '📍'}
          </button>
        </div>

        {stores.length === 0 && <p className="map-view__empty">まだ直近24時間の記録がありません。</p>}
        {locateState === 'error' && (
          <p className="map-view__empty">現在地を取得できませんでした。位置情報の利用を許可してください。</p>
        )}
      </section>

      <section className="recent-section" aria-labelledby="home-rank-title">
        <div className="recent-section__header">
          <div>
            <p className="eyebrow">24h ranking</p>
            <h2 id="home-rank-title">直近24時間の評価ランキング</h2>
          </div>
        </div>

        <div className="rank-list">
          {ranking.map((entry, index) => {
            const visual = storeVisual(entry.name)
            const names = participantNames(entry)
            return (
              <article key={entry.id} className="rank-item">
                <span className="rank-item__medal" aria-hidden="true">
                  {medals[index] ?? `${index + 1}`}
                </span>
                <span className="rank-item__thumb" style={{ background: visual.gradient }}>
                  {visual.emoji}
                </span>
                <div className="rank-item__body">
                  <h3>{entry.name}</h3>
                  <p className="visit-card__menu">{names.length > 0 ? names.join('・') : entry.genre}</p>
                </div>
                <span className="rank-item__score">{entry.tasteRating.toFixed(1)}</span>
              </article>
            )
          })}
          {ranking.length === 0 && <p className="map-view__empty">まだ評価がありません。</p>}
        </div>
      </section>

      {selectedStore && <StoreDetailModal store={selectedStore} onClose={() => setSelectedStore(null)} />}
    </>
  )
}

export default HomeView
