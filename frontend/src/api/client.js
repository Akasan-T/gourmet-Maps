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
