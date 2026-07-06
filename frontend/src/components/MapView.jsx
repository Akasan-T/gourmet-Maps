import { useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { createPinIcon } from './mapPinIcon'
import StoreDetailModal from './StoreDetailModal'

const fallbackCenter = [35.7075, 139.666]

function MapView({ stores, members }) {
  const [selectedMember, setSelectedMember] = useState('all')
  const [selectedStore, setSelectedStore] = useState(null)

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
    <section className="map-view" aria-labelledby="map-title">
      <div className="map-view__toolbar">
        <p className="eyebrow">All spots</p>
        <h2 id="map-title">みんなが行ったお店</h2>
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
      </div>

      <div className="map-view__canvas">
        <MapContainer center={center} zoom={14} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
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

      <div className="map-view__list">
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
            onClick={() => setSelectedStore(store)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setSelectedStore(store)
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

      {selectedStore && <StoreDetailModal store={selectedStore} onClose={() => setSelectedStore(null)} />}
    </section>
  )
}

export default MapView
