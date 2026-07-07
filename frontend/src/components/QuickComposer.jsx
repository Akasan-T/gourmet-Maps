import { useEffect, useState } from 'react'
import RatingSelector from './RatingSelector'
import { createGourmetEntry, fetchMembers } from '../api/client'

const overpassUrl = 'https://overpass-api.de/api/interpreter'
const nearbySearchRadiusMeters = 600

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const earthRadiusMeters = 6371000
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a))
}

async function fetchNearbyPlaces(latitude, longitude) {
  const query = `[out:json][timeout:15];`
    + `(node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream)$"]`
    + `(around:${nearbySearchRadiusMeters},${latitude},${longitude}););`
    + `out center 20;`

  const response = await fetch(overpassUrl, {
    method: 'POST',
    body: query,
  })

  if (!response.ok) {
    throw new Error(`overpass-failed-${response.status}`)
  }

  const result = await response.json()

  return result.elements
    .filter((element) => element.tags?.name)
    .map((element) => {
      const lat = element.lat ?? element.center?.lat
      const lon = element.lon ?? element.center?.lon

      return {
        id: element.id,
        name: element.tags.name,
        genre: element.tags.cuisine ?? element.tags.amenity,
        latitude: lat,
        longitude: lon,
        distance: distanceInMeters(latitude, longitude, lat, lon),
      }
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8)
}

function QuickComposer({ quickTags, visitTypes, onSaved }) {
  const [restaurantName, setRestaurantName] = useState('らぁ麺 すぎ本')
  const [menuName, setMenuName] = useState('特製塩らぁ麺')
  const [selectedVisitType, setSelectedVisitType] = useState(visitTypes[0])
  const [selectedTag, setSelectedTag] = useState(quickTags[0])
  const [tasteScore, setTasteScore] = useState('4.5')
  const [repeatScore, setRepeatScore] = useState('4.0')
  const [memo, setMemo] = useState('スープが軽くて、退店後すぐにもう一杯いけそう。')
  const [submitState, setSubmitState] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [nearbyPlaces, setNearbyPlaces] = useState([])
  const [nearbySearchState, setNearbySearchState] = useState('idle')
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [members, setMembers] = useState([])
  const [participantIds, setParticipantIds] = useState([])
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    fetchMembers()
      .then(setMembers)
      .catch(() => setMembers([]))
  }, [])

  useEffect(() => {
    handleSearchNearby()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleParticipant(memberId) {
    setParticipantIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    )
  }

  async function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('geolocation-unavailable'))
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    })
  }

  function handleRestaurantNameChange(event) {
    setRestaurantName(event.target.value)
    setSelectedPlace(null)
  }

  function handleSelectPlace(place) {
    setRestaurantName(place.name)
    setSelectedPlace(place)
  }

  async function handleSearchNearby() {
    setNearbySearchState('loading')
    setSelectedPlace(null)

    try {
      const position = await getCurrentPosition()
      const places = await fetchNearbyPlaces(position.coords.latitude, position.coords.longitude)

      setNearbyPlaces(places)
      setNearbySearchState(places.length > 0 ? 'success' : 'empty')
    } catch (error) {
      setNearbyPlaces([])
      if (error?.code === 1) {
        setNearbySearchState('permission-denied')
        return
      }
      setNearbySearchState('error')
    }
  }

  async function handleSubmit() {
    if (!restaurantName.trim()) {
      setSubmitState('error')
      setStatusMessage('お店の名前を入力してください。')
      return
    }

    setSubmitState('saving')

    try {
      let latitude
      let longitude

      if (selectedPlace) {
        latitude = selectedPlace.latitude
        longitude = selectedPlace.longitude
      } else {
        setStatusMessage('現在地を取得しています。')
        const position = await getCurrentPosition()
        latitude = position.coords.latitude
        longitude = position.coords.longitude
      }

      const taste = Number(tasteScore)
      const repeat = Number(repeatScore)
      const memoLines = [
        menuName.trim() ? `メニュー: ${menuName.trim()}` : '',
        `訪問タイプ: ${selectedVisitType}`,
        `タグ: ${selectedTag}`,
        memo.trim(),
      ].filter(Boolean)

      setStatusMessage('保存しています。')

      await createGourmetEntry({
        name: restaurantName.trim(),
        genre: selectedTag,
        overallRating: Number(((taste + repeat) / 2).toFixed(1)),
        tasteRating: taste,
        repeatRating: repeat,
        memo: memoLines.join('\n'),
        latitude,
        longitude,
        participantUserIds: participantIds,
      })

      setSubmitState('success')
      setStatusMessage('保存しました。地図のピンを更新しています。')
      setParticipantIds([])
      onSaved?.()
    } catch (error) {
      setSubmitState('error')
      if (error?.code === 1) {
        setStatusMessage('位置情報の利用が拒否されました。ブラウザで許可してください。')
        return
      }
      if (error?.code === 2 || error?.code === 3) {
        setStatusMessage('現在地の取得に失敗しました。通信状況を確認してください。')
        return
      }
      setStatusMessage('保存に失敗しました。backend が起動しているか確認してください。')
    }
  }

  return (
    <section className="composer-card" aria-labelledby="composer-title">
      <div className="composer-card__header">
        <div>
          <p className="eyebrow">One-hand entry</p>
          <h2 id="composer-title">来店直後に記録</h2>
        </div>
        <button type="button" className="ghost-button">
          下書き保存
        </button>
      </div>

      <div className="composer-card__fields">
        <label className="field">
          <div className="field__heading">
            <span className="field__label">お店</span>
            <button
              type="button"
              className="text-button"
              onClick={handleSearchNearby}
              disabled={nearbySearchState === 'loading'}
            >
              {nearbySearchState === 'loading' ? '検索中…' : '近くのお店を検索'}
            </button>
          </div>
          <input value={restaurantName} onChange={handleRestaurantNameChange} />
        </label>

        {nearbySearchState === 'success' && (
          <div className="composer-card__nearby-list" role="list">
            {nearbyPlaces.map((place) => (
              <button
                key={place.id}
                type="button"
                className={`composer-card__nearby-item${selectedPlace?.id === place.id ? ' composer-card__nearby-item--active' : ''}`}
                onClick={() => handleSelectPlace(place)}
              >
                <span className="composer-card__nearby-name">{place.name}</span>
                <span className="composer-card__nearby-meta">
                  {place.genre || 'ジャンル未設定'} ・ {Math.round(place.distance)}m
                </span>
              </button>
            ))}
          </div>
        )}
        {nearbySearchState === 'empty' && (
          <p className="composer-card__nearby-status">近くにお店が見つかりませんでした。</p>
        )}
        {nearbySearchState === 'permission-denied' && (
          <p className="composer-card__nearby-status">位置情報の利用が拒否されました。ブラウザで許可してください。</p>
        )}
        {nearbySearchState === 'error' && (
          <p className="composer-card__nearby-status">近くのお店を検索できませんでした。通信状況を確認してください。</p>
        )}

        <RatingSelector
          label="味"
          helper="最初に残したい評価"
          value={tasteScore}
          onChange={setTasteScore}
          options={['5.0', '4.5', '4.0', '3.5', '3.0']}
        />

        <button
          type="button"
          className="text-button composer-card__details-toggle"
          onClick={() => setShowDetails((current) => !current)}
        >
          {showDetails ? '詳細を閉じる' : '詳細を追加'}
        </button>

        {showDetails && (
          <>
            <label className="field">
              <span className="field__label">メニュー</span>
              <input value={menuName} onChange={(event) => setMenuName(event.target.value)} />
            </label>

            <div className="field">
              <span className="field__label">訪問タイプ</span>
              <div className="chip-row" role="list">
                {visitTypes.map((visitType) => (
                  <button
                    key={visitType}
                    type="button"
                    className={`chip${visitType === selectedVisitType ? ' chip--active' : ''}`}
                    onClick={() => setSelectedVisitType(visitType)}
                  >
                    {visitType}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field__label">ひとことタグ</span>
              <div className="chip-row" role="list">
                {quickTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`chip${tag === selectedTag ? ' chip--active' : ''}`}
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field__label">誰と行った?</span>
              <div className="chip-row" role="list">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`chip${participantIds.includes(member.id) ? ' chip--active' : ''}`}
                    onClick={() => toggleParticipant(member.id)}
                  >
                    {member.displayName}
                  </button>
                ))}
                {members.length === 0 && <span className="composer-card__nearby-status">メンバーを読み込み中…</span>}
              </div>
            </div>

            <RatingSelector
              label="再訪したさ"
              helper="次も行きたいか"
              value={repeatScore}
              onChange={setRepeatScore}
              options={['5.0', '4.5', '4.0', '3.5', '3.0']}
            />

            <label className="field">
              <span className="field__label">メモ</span>
              <textarea rows="3" value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </>
        )}
      </div>

      <div className="composer-card__footer">
        <div>
          <p className="composer-card__hint">
            {selectedPlace ? `${selectedPlace.name} の位置でピンを立てます。` : '保存時に現在地を使って地図へピンを立てます。'}
          </p>
          {statusMessage && (
            <p className={`composer-card__status composer-card__status--${submitState}`}>{statusMessage}</p>
          )}
        </div>
        <button type="button" className="primary-button" onClick={handleSubmit} disabled={submitState === 'saving'}>
          この内容で保存
        </button>
      </div>
    </section>
  )
}

export default QuickComposer