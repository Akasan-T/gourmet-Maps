import { useMemo, useRef, useState } from 'react'
import { AttributionControl, MapContainer, Marker, Popup, TileLayer, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { createCurrentLocationIcon, createPinIcon } from './mapPinIcon'
import StoreDetailModal from './StoreDetailModal'
import Modal from './Modal'

const fallbackCenter = [35.7075, 139.666]
const currentLocationZoom = 16

function MapView({ stores, members }) {
  const [selectedMember, setSelectedMember] = useState('all')
  const [selectedStore, setSelectedStore] = useState(null)
  const [currentPosition, setCurrentPosition] = useState(null)
  const [locateState, setLocateState] = useState('idle')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
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

  const filteredStores = useMemo(() => {
    if (selectedMember === 'all') return stores

    return stores
      .map((store) => ({
        ...store,
        visits: store.visits.filter((visit) =>
          (visit.participants ?? []).some((participant) => participant.id === selectedMember),
        ),
      }))
      .filter((store) => store.visits.length > 0)
  }, [stores, selectedMember])

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
      </div>

      <div className="map-page__controls">
        <button
          type="button"
          className="map-page__control-button"
          onClick={() => setIsFilterOpen(true)}
          aria-label="絞り込み"
          title="絞り込み"
        >
          絞
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
          <div className="chip-row" role="list">
            <button
              type="button"
              className={`chip${selectedMember === 'all' ? ' chip--active' : ''}`}
              onClick={() => setSelectedMember('all')}
            >
              全員
            </button>
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                className={`chip${selectedMember === member.id ? ' chip--active' : ''}`}
                onClick={() => setSelectedMember(member.id)}
              >
                {member.displayName}
              </button>
            ))}
          </div>

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

      {selectedStore && <StoreDetailModal store={selectedStore} onClose={() => setSelectedStore(null)} />}
    </section>
  )
}

export default MapView
