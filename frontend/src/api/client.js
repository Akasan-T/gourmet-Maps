const defaultApiBaseUrl = 'http://localhost:5001'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl

// ログイン状態の目安フラグ。HttpOnly Cookie のトークンは JS から読めないため、
// 起動時の初期判定にのみ使う (実際の認証は Cookie + サーバー側で行う)。
const AUTH_FLAG_KEY = 'tabemap.authenticated'

// 認証切れを呼び出し側で判別できるようにするためのエラー型
export class AuthError extends Error {}

export function isAuthenticated() {
  return localStorage.getItem(AUTH_FLAG_KEY) === '1'
}

function setAuthFlag() {
  localStorage.setItem(AUTH_FLAG_KEY, '1')
}

function clearAuthFlag() {
  localStorage.removeItem(AUTH_FLAG_KEY)
}

// fetch自体が失敗した場合(サーバーに繋がらない等)、ブラウザの生の英語メッセージ
// ("Failed to fetch" 等)が露出してしまうため、日本語のメッセージに変換する。
async function apiFetch(path, options = {}) {
  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: 'include',
    })
  } catch {
    throw new Error('サーバーに接続できませんでした。通信環境を確認し、時間をおいて再度お試しください。')
  }
}

// リフレッシュの多重実行を防ぐための in-flight プロミス
let refreshPromise = null

async function refreshTokens() {
  if (!refreshPromise) {
    refreshPromise = apiFetch('/api/auth/refresh', {
      method: 'POST',
    })
      .then(async (response) => {
        if (!response.ok) throw new AuthError('refresh-failed')
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

// 認証付き fetch。Cookie が自動送信されるため Authorization ヘッダは不要。
// 401 の場合は 1 度だけリフレッシュして再試行する。
async function authFetch(path, options = {}, retry = true) {
  const response = await apiFetch(path, options)

  if (response.status === 401) {
    if (retry) {
      try {
        await refreshTokens()
      } catch {
        clearAuthFlag()
        throw new AuthError('unauthorized')
      }
      return authFetch(path, options, false)
    }
    clearAuthFlag()
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
  const response = await apiFetch('/api/auth/login', {
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

  setAuthFlag()
}

export async function register(email, password, inviteCode) {
  const response = await apiFetch('/api/auth/register', {
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

export async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } catch {
    /* サーバーに繋がらなくてもローカルのフラグは消す */
  }
  clearAuthFlag()
}

export async function forgotPassword(email) {
  const response = await apiFetch('/api/auth/forgotPassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    throw new Error('リセットコードの発行に失敗しました。')
  }
}

export async function resetPassword(email, resetCode, newPassword) {
  const response = await apiFetch('/api/auth/resetPassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, resetCode, newPassword }),
  })

  if (!response.ok) {
    let message = 'パスワードのリセットに失敗しました。コードを確認してください。'
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

export function fetchMe() {
  return getJson('/api/account/me')
}

// --- ワンタイム招待コード (「初代食べる王」称号保有者のみ) ---

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

export async function updateAvatar(avatarUrl) {
  const response = await authFetch('/api/account/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarUrl: avatarUrl ?? '' }),
  })

  if (!response.ok) {
    throw new Error('アイコン画像の更新に失敗しました。')
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

// メンバー個別プロフィール(登録店舗・獲得称号)を取得する
export function fetchMemberProfile(memberId) {
  return getJson(`/api/Members/${memberId}`)
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

export function fetchEntryPhoto(entryId) {
  return getJson(`/api/GourmetEntries/${entryId}/photo`)
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
