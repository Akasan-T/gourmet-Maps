const defaultApiBaseUrl = 'http://localhost:5001'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl

const ACCESS_TOKEN_KEY = 'tabemap.accessToken'
const REFRESH_TOKEN_KEY = 'tabemap.refreshToken'

// 認証切れを呼び出し側で判別できるようにするためのエラー型
export class AuthError extends Error {}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// リフレッシュの多重実行を防ぐための in-flight プロミス
let refreshPromise = null

async function refreshTokens() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new AuthError('no-refresh-token')

  if (!refreshPromise) {
    refreshPromise = fetch(`${apiBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) throw new AuthError('refresh-failed')
        const data = await response.json()
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
        return data.accessToken
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

// 認証付き fetch。アクセストークンを付与し、401 の場合は 1 度だけリフレッシュして再試行する。
async function authFetch(path, options = {}, retry = true) {
  const token = getAccessToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers })

  if (response.status === 401) {
    if (retry) {
      try {
        await refreshTokens()
      } catch {
        clearTokens()
        throw new AuthError('unauthorized')
      }
      return authFetch(path, options, false)
    }
    clearTokens()
    throw new AuthError('unauthorized')
  }

  return response
}

async function getJson(path) {
  const response = await authFetch(path)

  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`)
  }

  return response.json()
}

// --- 認証エンドポイント ---

export async function login(email, password) {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      detail = (await response.json())?.detail ?? ''
    } catch {
      /* レスポンス本文が空の場合は無視 */
    }
    if (detail.includes('NotAllowed')) {
      throw new Error('メールアドレスの確認が完了していません。確認メール内のリンクを開いてください。')
    }
    throw new Error('メールアドレスまたはパスワードが正しくありません。')
  }

  const data = await response.json()
  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
  return data
}

export async function register(email, password, inviteCode) {
  const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, inviteCode }),
  })

  if (!response.ok) {
    let message = '登録に失敗しました。入力内容を確認してください。'
    try {
      const problem = await response.json()
      if (problem?.errors) {
        message = Object.values(problem.errors).flat().join(' ')
      } else if (problem?.detail) {
        message = problem.detail
      }
    } catch {
      /* レスポンス本文が空の場合は既定メッセージを使う */
    }
    throw new Error(message)
  }
}

export function logout() {
  clearTokens()
}

export function fetchMe() {
  return getJson('/api/account/me')
}

// --- ワンタイム招待コード (「初代タベマップ」称号保有者のみ) ---

export async function issueInvite() {
  const response = await authFetch('/api/invites', { method: 'POST' })

  if (response.status === 403) {
    throw new Error('招待コードを発行する権限がありません。')
  }
  if (!response.ok) {
    throw new Error('招待コードの発行に失敗しました。')
  }

  return response.json()
}

export function fetchInvites() {
  return getJson('/api/invites')
}

// --- 称号図鑑 ---

export function fetchTitles() {
  return getJson('/api/titles')
}

export async function updateDisplayName(displayName) {
  const response = await authFetch('/api/account/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  })

  if (!response.ok) {
    throw new Error('表示名の更新に失敗しました。')
  }

  return response.json()
}

// --- アプリケーションデータ ---

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

// Google Places API (New) 経由の周辺・キーワード検索 (バックエンドが代理でGoogleに問い合わせる)
export function fetchGooglePlaces({ lat, lng, q, radiusMeters } = {}) {
  const params = new URLSearchParams()
  if (typeof lat === 'number') params.set('lat', lat)
  if (typeof lng === 'number') params.set('lng', lng)
  if (q) params.set('q', q)
  if (typeof radiusMeters === 'number') params.set('radiusMeters', radiusMeters)
  return getJson(`/api/places/search?${params.toString()}`)
}

// 位置検索での選択 or 手入力から店舗を登録し、店舗マスタのレコードを得る
export async function registerStore(payload) {
  const response = await authFetch(`/api/Stores`, {
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

export async function deleteGourmetEntry(id) {
  const response = await authFetch(`/api/GourmetEntries/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(`delete-failed-${response.status}`)
  }
}

export async function createGourmetEntry(payload) {
  const response = await authFetch(`/api/GourmetEntries`, {
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
