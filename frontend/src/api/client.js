const defaultApiBaseUrl = 'http://localhost:5001'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl

async function getJson(path) {
  const response = await fetch(`${apiBaseUrl}${path}`)

  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`)
  }

  return response.json()
}

export function fetchGourmetEntries() {
  return getJson('/api/GourmetEntries')
}

export function fetchMembers() {
  return getJson('/api/Members')
}

export function fetchOverallRanking() {
  return getJson('/api/GourmetEntries/rankings/overall')
}

export function fetchGenreRanking() {
  return getJson('/api/GourmetEntries/rankings/genres')
}

export function fetchCompanionRanking(memberId) {
  return getJson(`/api/GourmetEntries/rankings/companions/${memberId}`)
}

// 自店DBの登録済み店舗を距離の近い順に取得する
export function fetchStores({ lat, lng, q } = {}) {
  const params = new URLSearchParams()
  if (typeof lat === 'number') params.set('lat', lat)
  if (typeof lng === 'number') params.set('lng', lng)
  if (q) params.set('q', q)
  const query = params.toString()
  return getJson(`/api/Stores${query ? `?${query}` : ''}`)
}

// 手入力の重複を防ぐための類似店舗名サジェスト
export function fetchStoreSuggestions(name) {
  return getJson(`/api/Stores/suggest?name=${encodeURIComponent(name)}`)
}

// 位置検索での選択 or 手入力から店舗を登録し、店舗マスタのレコードを得る
export async function registerStore(payload) {
  const response = await fetch(`${apiBaseUrl}/api/Stores`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`register-store-failed-${response.status}`)
  }

  return response.json()
}

export async function createGourmetEntry(payload) {
  const response = await fetch(`${apiBaseUrl}/api/GourmetEntries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`save-failed-${response.status}`)
  }

  return response.json()
}
