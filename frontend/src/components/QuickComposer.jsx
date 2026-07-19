import { useEffect, useMemo, useRef, useState } from 'react'
import RatingSelector from './RatingSelector'
import { createGourmetEntry, fetchGooglePlaces, fetchMembers, fetchStores } from '../api/client'

const overpassUrl = 'https://overpass-api.de/api/interpreter'
const nearbySearchRadiusMeters = 600
// 店名で検索するときは、ただの周辺検索より広く探す
const nameSearchRadiusMeters = 3000
const nameSearchDebounceMs = 400

const ratingOptions = ['5', '4', '3', '2', '1']

// 下書きの自動保存: 手動ボタンではなく、無操作が続いた場合とページ離脱時に保存する
const draftStorageKey = 'tabemap.quickComposerDraft'
const draftInactivityMs = 10000

// 5段階の評価基準（ブレ防止のためツールチップ/補足で表示）
const ratingAxes = [
  {
    key: 'taste',
    label: '味',
    helper: 'シンプルに美味しかったか',
    descriptions: {
      5: '絶品、また絶対行きたい',
      4: '美味しい、人にすすめたい',
      3: '普通に美味しい、可もなく不可もなく',
      2: '普通以下、リピートはなし',
      1: '微妙、正直おすすめしない',
    },
  },
  {
    key: 'cost',
    label: 'コスパ',
    helper: '値段に対する満足度',
    descriptions: {
      5: '価格以上、また払いたい',
      4: '値段に見合っていて満足',
      3: '相応、可もなく不可もなく',
      2: 'やや割高に感じた',
      1: '価格に見合わない',
    },
  },
  {
    key: 'atmosphere',
    label: '雰囲気・内装',
    helper: '居心地、用途との相性',
    descriptions: {
      5: '最高に居心地がよい',
      4: '快適で用途に合っている',
      3: '普通、特に気にならない',
      2: 'やや落ち着かない',
      1: '居心地が悪い',
    },
  },
  {
    key: 'service',
    label: '接客',
    helper: 'スタッフ対応',
    descriptions: {
      5: '感動的な接客',
      4: '丁寧で気持ちよかった',
      3: '普通の対応',
      2: 'やや不満が残った',
      1: '対応が悪かった',
    },
  },
  {
    key: 'repeat',
    label: 'また行きたいか',
    helper: '総合スコアの基準',
    descriptions: {
      5: '絶対にまた行きたい',
      4: 'また行きたい',
      3: '機会があれば',
      2: 'あまり行きたくない',
      1: 'もう行かない',
    },
  },
]

const genreOptions = ['ラーメン', '焼肉', 'カフェ', '居酒屋', '定食', '寿司', 'イタリアン', 'その他']
const sceneTags = ['デート向き', '家族向き', '飲み会向き', 'ひとり向き', '接待向き']
const priceRanges = ['〜1,000円', '1,000〜3,000円', '3,000〜5,000円', '5,000円〜']

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

function formatDistance(distance) {
  if (typeof distance !== 'number') return null
  if (distance < 1000) return `${Math.round(distance)}m`
  return `${(distance / 1000).toFixed(1)}km`
}

// Overpass QL の正規表現リテラルに埋め込むための最低限のエスケープ
function escapeOverpassRegex(text) {
  return text.replace(/["\\]/g, '\\$&').replace(/[.*+?^${}()|[\]]/g, '\\$&')
}

async function fetchNearbyPlaces(latitude, longitude, options = {}) {
  const { radiusMeters = nearbySearchRadiusMeters, nameFilter } = options
  const nameClause = nameFilter ? `["name"~"${escapeOverpassRegex(nameFilter)}",i]` : ''
  const query = `[out:json][timeout:15];`
    + `(node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream)$"]${nameClause}`
    + `(around:${radiusMeters},${latitude},${longitude}););`
    + `out center 30;`

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
        source: 'overpass',
        externalPlaceId: `osm:${element.type}:${element.id}`,
        storeId: null,
        name: element.tags.name,
        genre: element.tags.cuisine ?? element.tags.amenity,
        latitude: lat,
        longitude: lon,
        distance: distanceInMeters(latitude, longitude, lat, lon),
        address: null,
      }
    })
    .sort((a, b) => a.distance - b.distance)
}

// 画像を縮小して data URL 化する（自店完結・ストレージ不要のため）
function readAndCompressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read-failed'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('decode-failed'))
      image.onload = () => {
        const maxSize = 1024
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// 前回保存された下書きを読み込む（初期状態の遅延初期化で1度だけ呼ばれる）
function loadStoredDraft() {
  try {
    const saved = localStorage.getItem(draftStorageKey)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function QuickComposer({ quickTags, visitTypes, onSaved }) {
  const [initialDraft] = useState(loadStoredDraft)
  const [restaurantName, setRestaurantName] = useState(() => initialDraft?.restaurantName ?? '')
  const [menuName, setMenuName] = useState(() => initialDraft?.menuName ?? '')
  const [genre, setGenre] = useState(() => initialDraft?.genre ?? genreOptions[0])
  const [selectedVisitType, setSelectedVisitType] = useState(() => initialDraft?.selectedVisitType ?? visitTypes[0])
  const [selectedTag, setSelectedTag] = useState(() => initialDraft?.selectedTag ?? quickTags[0])
  const [sceneTag, setSceneTag] = useState(() => initialDraft?.sceneTag ?? '')
  const [priceRange, setPriceRange] = useState(() => initialDraft?.priceRange ?? '')
  const [scores, setScores] = useState(
    () => initialDraft?.scores ?? { taste: '4', cost: '4', atmosphere: '4', service: '4', repeat: '4' },
  )
  const [memo, setMemo] = useState(() => initialDraft?.memo ?? '')
  const [photoDataUrl, setPhotoDataUrl] = useState(() => initialDraft?.photoDataUrl ?? '')
  const [submitState, setSubmitState] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [position, setPosition] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [nearbySearchState, setNearbySearchState] = useState('idle')
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [isListOpen, setIsListOpen] = useState(false)
  const [members, setMembers] = useState([])
  const [participantIds, setParticipantIds] = useState(() => initialDraft?.participantIds ?? [])
  const [showDetails, setShowDetails] = useState(() => Boolean(initialDraft?.showDetails))
  const [draftStatus, setDraftStatus] = useState(initialDraft ? 'restored' : 'idle') // idle | restored | saved
  const fileInputRef = useRef(null)
  const draftTimeoutRef = useRef(null)
  const submittedDraftSnapshotRef = useRef(null)
  const positionRef = useRef(null)
  positionRef.current = position
  const isFirstKeywordRunRef = useRef(true)

  // 直近の入力内容を常に最新化しておく（アンマウント/離脱時のクロージャ問題を避けるため）
  const draftFieldsRef = useRef(null)
  draftFieldsRef.current = {
    restaurantName,
    menuName,
    genre,
    selectedVisitType,
    selectedTag,
    sceneTag,
    priceRange,
    scores,
    memo,
    photoDataUrl,
    participantIds,
    showDetails,
  }

  function persistDraft(fields) {
    if (!fields || !fields.restaurantName.trim()) {
      return
    }
    const snapshot = JSON.stringify(fields)
    if (snapshot === submittedDraftSnapshotRef.current) {
      return
    }
    try {
      localStorage.setItem(draftStorageKey, snapshot)
      setDraftStatus('saved')
    } catch {
      // 保存容量オーバー等は下書き機能が補助的なため無視する
    }
  }

  // 10秒操作がなければ自動で下書き保存する
  useEffect(() => {
    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)
    draftTimeoutRef.current = setTimeout(() => {
      persistDraft(draftFieldsRef.current)
    }, draftInactivityMs)
    return () => clearTimeout(draftTimeoutRef.current)
  }, [
    restaurantName,
    menuName,
    genre,
    selectedVisitType,
    selectedTag,
    sceneTag,
    priceRange,
    scores,
    memo,
    photoDataUrl,
    participantIds,
    showDetails,
  ])

  // ページ離脱 (タブ切替・リロード・ブラウザを閉じる) 時にも即座に保存する
  useEffect(() => {
    function handleLeave() {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)
      persistDraft(draftFieldsRef.current)
    }

    window.addEventListener('beforeunload', handleLeave)
    window.addEventListener('pagehide', handleLeave)

    return () => {
      window.removeEventListener('beforeunload', handleLeave)
      window.removeEventListener('pagehide', handleLeave)
      handleLeave() // SPA内でタブを切り替えてアンマウントされる場合もここで保存する
    }
  }, [])

  // 保存済みの下書き表示は少し経ったら消す
  useEffect(() => {
    if (draftStatus !== 'saved') return
    const timer = setTimeout(() => setDraftStatus('idle'), 4000)
    return () => clearTimeout(timer)
  }, [draftStatus])

  useEffect(() => {
    fetchMembers()
      .then(setMembers)
      .catch(() => setMembers([]))
  }, [])

  useEffect(() => {
    handleSearchNearby()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setScore(key, value) {
    setScores((current) => ({ ...current, [key]: value }))
  }

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
    setIsListOpen(true)
  }

  function handleSelectPlace(place) {
    setRestaurantName(place.name)
    setSelectedPlace(place)
    setIsListOpen(false)
    if (place.genre && genreOptions.includes(place.genre)) {
      setGenre(place.genre)
    }
  }

  // 自店DB + 現在地周辺(Overpass) をマージして候補を作る。
  // keyword があれば店名で絞り込み、より広い範囲まで探す。
  async function runSearch(coords, keyword) {
    setNearbySearchState('loading')

    const trimmedKeyword = keyword.trim()
    const radiusMeters = trimmedKeyword ? nameSearchRadiusMeters : nearbySearchRadiusMeters

    try {
      const [savedStores, nearbyPlaces, googlePlaces] = await Promise.all([
        fetchStores({ lat: coords.latitude, lng: coords.longitude, q: trimmedKeyword || undefined }).catch(() => []),
        fetchNearbyPlaces(coords.latitude, coords.longitude, {
          radiusMeters,
          nameFilter: trimmedKeyword || undefined,
        }).catch(() => []),
        fetchGooglePlaces({
          lat: coords.latitude,
          lng: coords.longitude,
          q: trimmedKeyword || undefined,
          radiusMeters,
        }).catch(() => []),
      ])

      const merged = mergeCandidates(
        savedStores.map(toSavedCandidate),
        nearbyPlaces,
        googlePlaces.map(toGoogleCandidate),
      )
      setCandidates(merged)
      setNearbySearchState(merged.length > 0 ? 'success' : 'empty')
      setIsListOpen(merged.length > 0)
    } catch {
      setCandidates([])
      setNearbySearchState('error')
    }
  }

  // 現在地を取得して検索する（初回マウント・「近くのお店を検索」ボタン用）
  async function handleSearchNearby() {
    setNearbySearchState('loading')
    setSelectedPlace(null)

    let coords
    try {
      const currentPosition = await getCurrentPosition()
      coords = { latitude: currentPosition.coords.latitude, longitude: currentPosition.coords.longitude }
      setPosition(coords)
    } catch (error) {
      // 位置情報が取れなくても自店DBだけは(入力中の店名があればそれで)読み込む
      try {
        const savedStores = await fetchStores({ q: restaurantName.trim() || undefined })
        setCandidates(mergeCandidates(savedStores.map(toSavedCandidate), []))
      } catch {
        setCandidates([])
      }
      setNearbySearchState(error?.code === 1 ? 'permission-denied' : 'error')
      return
    }

    await runSearch(coords, restaurantName)
  }

  // 店名を入力したら、その文字で近くのお店を再検索する（デバウンス）
  useEffect(() => {
    if (isFirstKeywordRunRef.current) {
      // 初回マウント時の検索は handleSearchNearby 側にまかせる
      isFirstKeywordRunRef.current = false
      return
    }

    const coords = positionRef.current
    if (!coords) return

    const timer = setTimeout(() => {
      runSearch(coords, restaurantName)
    }, nameSearchDebounceMs)

    return () => clearTimeout(timer)
  }, [restaurantName])

  const filteredCandidates = useMemo(() => {
    const keyword = restaurantName.trim().toLowerCase()
    const base = keyword
      ? candidates.filter((candidate) => candidate.name.toLowerCase().includes(keyword))
      : candidates
    return base.slice(0, 8)
  }, [candidates, restaurantName])

  // 手入力名と一致する登録済み店舗（重複登録の抑止サジェスト）
  const duplicateHint = useMemo(() => {
    const keyword = restaurantName.trim().toLowerCase()
    if (!keyword || selectedPlace) return null
    return candidates.find(
      (candidate) => candidate.source === 'saved' && candidate.name.toLowerCase() === keyword,
    ) ?? null
  }, [candidates, restaurantName, selectedPlace])

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readAndCompressImage(file)
      setPhotoDataUrl(dataUrl)
    } catch {
      setStatusMessage('写真の読み込みに失敗しました。')
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
        // 位置検索で選んだ店はその緯度経度を使う
        latitude = selectedPlace.latitude
        longitude = selectedPlace.longitude
      } else if (position) {
        latitude = position.latitude
        longitude = position.longitude
      } else {
        // 手入力かつ未取得なら登録地点として現在地を取得する
        setStatusMessage('現在地を取得しています。')
        const currentPosition = await getCurrentPosition()
        latitude = currentPosition.coords.latitude
        longitude = currentPosition.coords.longitude
      }

      const memoLines = [
        menuName.trim() ? `メニュー: ${menuName.trim()}` : '',
        `訪問タイプ: ${selectedVisitType}`,
        `タグ: ${selectedTag}`,
        memo.trim(),
      ].filter(Boolean)

      setStatusMessage('保存しています。')

      await createGourmetEntry({
        name: restaurantName.trim(),
        genre: selectedPlace?.genre && genreOptions.includes(selectedPlace.genre) ? selectedPlace.genre : genre,
        tasteRating: Number(scores.taste),
        costRating: Number(scores.cost),
        atmosphereRating: Number(scores.atmosphere),
        serviceRating: Number(scores.service),
        repeatRating: Number(scores.repeat),
        memo: memoLines.join('\n'),
        sceneTag: sceneTag || null,
        priceRange: priceRange || null,
        photoUrl: photoDataUrl || null,
        latitude,
        longitude,
        storeId: selectedPlace?.storeId ?? null,
        externalPlaceId: selectedPlace?.externalPlaceId ?? null,
        participantUserIds: participantIds,
      })

      setSubmitState('success')
      setStatusMessage('保存しました。地図のピンを更新しています。')
      setParticipantIds([])
      setPhotoDataUrl('')

      // 保存済みの内容を「送信済みスナップショット」として記録し、下書きとして再保存されないようにする
      submittedDraftSnapshotRef.current = JSON.stringify({
        ...draftFieldsRef.current,
        participantIds: [],
        photoDataUrl: '',
      })
      try {
        localStorage.removeItem(draftStorageKey)
      } catch {
        // 無視する
      }
      setDraftStatus('idle')

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
        {draftStatus === 'saved' && (
          <span className="composer-card__draft-status">下書きを自動保存しました</span>
        )}
        {draftStatus === 'restored' && (
          <span className="composer-card__draft-status">前回の下書きを復元しました</span>
        )}
      </div>

      <div className="composer-card__fields">
        <label className="field composer-card__store-field">
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
          <input
            value={restaurantName}
            onChange={handleRestaurantNameChange}
            onFocus={() => candidates.length > 0 && setIsListOpen(true)}
            placeholder="店名を入力、または一覧から選択"
            autoComplete="off"
          />

          {isListOpen && filteredCandidates.length > 0 && (
            <div className="composer-card__nearby-list composer-card__autocomplete" role="listbox">
              {filteredCandidates.map((place) => (
                <button
                  key={place.key}
                  type="button"
                  className={`composer-card__nearby-item${selectedPlace?.key === place.key ? ' composer-card__nearby-item--active' : ''}`}
                  onClick={() => handleSelectPlace(place)}
                >
                  <span className="composer-card__nearby-name">
                    {place.name}
                    {place.source === 'saved' && <span className="composer-card__badge">登録済み</span>}
                  </span>
                  <span className="composer-card__nearby-meta">
                    {place.genre || 'ジャンル未設定'}
                    {formatDistance(place.distance) ? ` ・ ${formatDistance(place.distance)}` : ''}
                  </span>
                  {place.address && (
                    <span className="composer-card__nearby-address">{place.address}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </label>

        {duplicateHint && (
          <p className="composer-card__nearby-status composer-card__dup-hint">
            「{duplicateHint.name}」は登録済みです。同じ店舗として記録を追加できます。
          </p>
        )}
        {nearbySearchState === 'empty' && (
          <p className="composer-card__nearby-status">近くにお店が見つかりませんでした。手入力で登録できます。</p>
        )}
        {nearbySearchState === 'permission-denied' && (
          <p className="composer-card__nearby-status">位置情報が拒否されました。手入力で登録するとその地点に登録されます。</p>
        )}
        {nearbySearchState === 'error' && (
          <p className="composer-card__nearby-status">近くのお店を検索できませんでした。手入力で登録できます。</p>
        )}

        <div className="field">
          <span className="field__label">ジャンル</span>
          <div className="chip-row" role="list">
            {genreOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip${genre === option ? ' chip--active' : ''}`}
                onClick={() => setGenre(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {ratingAxes.map((axis) => (
          <RatingSelector
            key={axis.key}
            label={axis.label}
            helper={axis.helper}
            value={scores[axis.key]}
            onChange={(value) => setScore(axis.key, value)}
            options={ratingOptions}
            descriptions={axis.descriptions}
          />
        ))}

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
              <span className="field__label">シーンタグ</span>
              <div className="chip-row" role="list">
                {sceneTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`chip${tag === sceneTag ? ' chip--active' : ''}`}
                    onClick={() => setSceneTag((current) => (current === tag ? '' : tag))}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field__label">価格帯</span>
              <div className="chip-row" role="list">
                {priceRanges.map((range) => (
                  <button
                    key={range}
                    type="button"
                    className={`chip${range === priceRange ? ' chip--active' : ''}`}
                    onClick={() => setPriceRange((current) => (current === range ? '' : range))}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

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

            <div className="field">
              <span className="field__label">写真（任意）</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
              {photoDataUrl ? (
                <div className="composer-card__photo">
                  <img src={photoDataUrl} alt="添付写真のプレビュー" />
                  <button type="button" className="text-button" onClick={() => setPhotoDataUrl('')}>
                    写真を削除
                  </button>
                </div>
              ) : (
                <button type="button" className="text-button" onClick={() => fileInputRef.current?.click()}>
                  写真を追加
                </button>
              )}
            </div>

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
            {selectedPlace
              ? `${selectedPlace.name} の位置でピンを立てます。`
              : '投稿時に現在地を使って地図へピンを立てます。'}
          </p>
          {statusMessage && (
            <p className={`composer-card__status composer-card__status--${submitState}`}>{statusMessage}</p>
          )}
        </div>
        <button type="button" className="primary-button" onClick={handleSubmit} disabled={submitState === 'saving'}>
          投稿
        </button>
      </div>
    </section>
  )
}

// 自店DBの店舗を候補形式に変換
function toSavedCandidate(store) {
  return {
    source: 'saved',
    key: `saved:${store.id}`,
    storeId: store.id,
    externalPlaceId: store.externalPlaceId ?? null,
    name: store.name,
    genre: store.genre,
    latitude: store.latitude,
    longitude: store.longitude,
    distance: typeof store.distance === 'number' ? store.distance : null,
    address: store.address ?? null,
  }
}

// Google Places の候補を候補形式に変換
function toGoogleCandidate(place) {
  return {
    source: 'google',
    storeId: null,
    externalPlaceId: place.externalPlaceId,
    name: place.name,
    genre: place.genre,
    latitude: place.latitude,
    longitude: place.longitude,
    distance: typeof place.distance === 'number' ? place.distance : null,
    address: place.address ?? null,
  }
}

// 自店DB・OSM(Overpass)・Google Places の候補を、店名一致で重複排除（自店DB優先）してマージ
function mergeCandidates(savedCandidates, overpassPlaces, googlePlaces = []) {
  const seen = new Set(savedCandidates.map((candidate) => candidate.name.toLowerCase()))

  const externalCandidates = [...overpassPlaces, ...googlePlaces]
    .filter((place) => {
      const key = place.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((place) => ({ ...place, key: place.externalPlaceId }))

  return [...savedCandidates, ...externalCandidates].sort((a, b) => {
    if (a.distance == null) return 1
    if (b.distance == null) return -1
    return a.distance - b.distance
  })
}

export default QuickComposer
