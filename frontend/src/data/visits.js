const HOUR = 60 * 60 * 1000

// ジャンルごとの見た目 (絵文字・ピン色・サムネのグラデーション)。
// 以前は店名のハッシュで絵文字を配っていたため、実際のジャンルと絵文字がちぐはぐだった
// (ラーメン店に🍛が付く等)。ここではジャンルに沿った絵文字を割り当てる。
const genreVisuals = {
  ラーメン: { color: '#e8613c', emoji: '🍜', gradient: 'linear-gradient(135deg, #f6a35c, #e8613c)' },
  焼肉: { color: '#c0453b', emoji: '🍖', gradient: 'linear-gradient(135deg, #e88a5a, #c0453b)' },
  カフェ: { color: '#9c6b3f', emoji: '☕', gradient: 'linear-gradient(135deg, #d4a373, #9c6b3f)' },
  居酒屋: { color: '#d1483f', emoji: '🏮', gradient: 'linear-gradient(135deg, #f0a05a, #d1483f)' },
  定食: { color: '#c98a3c', emoji: '🍱', gradient: 'linear-gradient(135deg, #f0d29a, #c98a3c)' },
  寿司: { color: '#2f8fb0', emoji: '🍣', gradient: 'linear-gradient(135deg, #7fc1d6, #2f8fb0)' },
  イタリアン: { color: '#5a9c5c', emoji: '🍝', gradient: 'linear-gradient(135deg, #9fce7f, #5a9c5c)' },
  カレー: { color: '#c77f2e', emoji: '🍛', gradient: 'linear-gradient(135deg, #e8b25a, #c77f2e)' },
}

// ジャンル未設定・その他・未知ジャンル向けのニュートラルな見た目
const fallbackVisual = { color: '#6b7688', emoji: '🍽️', gradient: 'linear-gradient(135deg, #aab2c0, #6b7688)' }

// 外部由来 (OSM cuisine / 英語表記) や表記ゆれを正規のジャンル名に寄せる
const genreAliases = {
  ramen: 'ラーメン', 中華そば: 'ラーメン', つけ麺: 'ラーメン', 中華: 'ラーメン',
  yakiniku: '焼肉', bbq: '焼肉', ステーキ: '焼肉', steak: '焼肉', 焼き肉: '焼肉',
  cafe: 'カフェ', coffee: 'カフェ', coffee_shop: 'カフェ', 喫茶: 'カフェ', 喫茶店: 'カフェ',
  bar: '居酒屋', pub: '居酒屋', izakaya: '居酒屋', 酒場: '居酒屋',
  sushi: '寿司', 鮨: '寿司', 回転寿司: '寿司',
  italian: 'イタリアン', pizza: 'イタリアン', pizzeria: 'イタリアン', パスタ: 'イタリアン', ピザ: 'イタリアン',
  curry: 'カレー',
  teishoku: '定食', 食堂: '定食',
}

function normalizeGenre(genre) {
  const raw = (genre ?? '').trim()
  if (raw.length === 0) return null
  if (genreVisuals[raw]) return raw
  const lower = raw.toLowerCase()
  if (genreAliases[lower]) return genreAliases[lower]
  if (genreAliases[raw]) return genreAliases[raw]
  return null
}

// 店の見た目を「ジャンル」から決める。ジャンルが無い/未知なら name を使わずニュートラル表示。
export function storeVisual(name, genre) {
  const canonical = normalizeGenre(genre)
  return canonical ? genreVisuals[canonical] : fallbackVisual
}

export function withinHours(entry, hours) {
  return Date.now() - new Date(entry.visitDate).getTime() <= hours * HOUR
}

export function deriveTag(entry) {
  return entry.repeatRating >= 4 ? 'また行く' : '通常評価'
}

export const positiveTags = new Set(['また行く'])

export function participantNames(entry) {
  return (entry.participants ?? []).map((participant) => participant.displayName)
}

export function extractVisitType(memo) {
  const match = (memo ?? '').match(/^訪問タイプ: (.+)$/m)
  return match ? match[1].trim() : null
}

export function groupEntriesByStore(entries) {
  const map = new Map()

  entries.forEach((entry) => {
    const key = entry.name
    if (!map.has(key)) {
      map.set(key, { name: entry.name, ...storeVisual(entry.name, entry.genre), visits: [] })
    }
    map.get(key).visits.push(entry)
  })

  return Array.from(map.values()).map((store) => {
    const visits = [...store.visits].sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
    const located = visits.find((visit) => typeof visit.latitude === 'number' && typeof visit.longitude === 'number')

    return {
      ...store,
      visits,
      lat: located?.latitude ?? null,
      lng: located?.longitude ?? null,
    }
  })
}

export function formatRelativeTime(date) {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'たった今'
  if (diffMin < 60) return `${diffMin}分前`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}時間前`

  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay}日前`
}
