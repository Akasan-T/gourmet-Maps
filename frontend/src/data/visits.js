const HOUR = 60 * 60 * 1000

const palette = [
  { color: '#eb6b4a', emoji: '🍜', gradient: 'linear-gradient(135deg, #f6a35c, #eb6b4a)' },
  { color: '#6f9c5c', emoji: '🥪', gradient: 'linear-gradient(135deg, #f0cf7a, #d9a441)' },
  { color: '#4f7fb0', emoji: '🍢', gradient: 'linear-gradient(135deg, #9fc98a, #6f9c5c)' },
  { color: '#a15fc4', emoji: '🍛', gradient: 'linear-gradient(135deg, #c98af0, #a15fc4)' },
  { color: '#c48b3f', emoji: '🍱', gradient: 'linear-gradient(135deg, #f0d29a, #c48b3f)' },
]

function hashString(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

export function storeVisual(name) {
  return palette[hashString(name) % palette.length]
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

export function groupEntriesByStore(entries) {
  const map = new Map()

  entries.forEach((entry) => {
    const key = entry.name
    if (!map.has(key)) {
      map.set(key, { name: entry.name, ...storeVisual(entry.name), visits: [] })
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
