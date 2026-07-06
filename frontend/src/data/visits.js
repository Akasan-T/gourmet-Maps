const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export const members = [
  { name: '中野 太郎', initial: '太', role: 'オーナー' },
  { name: '中野 花子', initial: '花', role: 'メンバー' },
  { name: '林田 健', initial: '健', role: 'メンバー' },
]

const stores = {
  hayashida: {
    name: '麺処 はやし田 中野店',
    lat: 35.7075,
    lng: 139.666,
    color: '#eb6b4a',
    emoji: '🍜',
    gradient: 'linear-gradient(135deg, #f6a35c, #eb6b4a)',
  },
  shinbo: {
    name: '喫茶シンボパン',
    lat: 35.709,
    lng: 139.67,
    color: '#6f9c5c',
    emoji: '🥪',
    gradient: 'linear-gradient(135deg, #f0cf7a, #d9a441)',
  },
  torimatsu: {
    name: '焼鳥 とり松',
    lat: 35.7145,
    lng: 139.674,
    color: '#4f7fb0',
    emoji: '🍢',
    gradient: 'linear-gradient(135deg, #9fc98a, #6f9c5c)',
  },
}

export const positiveTags = new Set(['また行く', '写真映え', '接客よい'])

export const allVisits = [
  {
    id: 'v1',
    store: stores.hayashida,
    member: members[0],
    menu: '醤油らぁ麺',
    visitedAt: new Date(Date.now() - 2 * HOUR),
    taste: 4.6,
    repeat: 4.3,
    volume: 3.7,
    memo: '鶏の輪郭がはっきりしていて、麺を食べ切るまで温度が落ちにくい。',
    tag: 'また行く',
  },
  {
    id: 'v2',
    store: stores.shinbo,
    member: members[1],
    menu: '厚焼きたまごサンド',
    visitedAt: new Date(Date.now() - 10 * HOUR),
    taste: 4.2,
    repeat: 4.0,
    volume: 4.1,
    memo: 'パンが軽いので食後の動きに影響しにくい。午後の打ち合わせ前に良さそう。',
    tag: '接客よい',
  },
  {
    id: 'v3',
    store: stores.hayashida,
    member: members[2],
    menu: '味噌らぁ麺',
    visitedAt: new Date(Date.now() - 20 * HOUR),
    taste: 4.4,
    repeat: 4.1,
    volume: 3.9,
    memo: '味噌のコクが強めで満足感がある。替え玉していきたくなる味。',
    tag: '量が多い',
  },
  {
    id: 'v4',
    store: stores.torimatsu,
    member: members[0],
    menu: 'ねぎま塩',
    visitedAt: new Date(Date.now() - 3 * DAY),
    taste: 4.0,
    repeat: 4.2,
    volume: 3.5,
    memo: '塩加減がちょうどよく、ビールに合う。',
    tag: 'また行く',
  },
  {
    id: 'v5',
    store: stores.shinbo,
    member: members[0],
    menu: '厚焼きたまごサンド',
    visitedAt: new Date(Date.now() - 9 * DAY),
    taste: 4.1,
    repeat: 3.9,
    volume: 4.0,
    memo: '前回より卵が厚めで満足感があった。',
    tag: '写真映え',
  },
  {
    id: 'v6',
    store: stores.hayashida,
    member: members[0],
    menu: '塩らぁ麺',
    visitedAt: new Date(Date.now() - 15 * DAY),
    taste: 4.5,
    repeat: 4.4,
    volume: 3.6,
    memo: 'あっさりで胃に優しい。次はランチ利用でも良さそう。',
    tag: 'また行く',
  },
]

export function withinHours(visit, hours) {
  return Date.now() - visit.visitedAt.getTime() <= hours * HOUR
}

export function groupVisitsByStore(visits) {
  const map = new Map()

  visits.forEach((visit) => {
    const key = visit.store.name
    if (!map.has(key)) {
      map.set(key, { ...visit.store, visits: [] })
    }
    map.get(key).visits.push(visit)
  })

  return Array.from(map.values()).map((store) => ({
    ...store,
    visits: [...store.visits].sort((a, b) => b.visitedAt - a.visitedAt),
  }))
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
