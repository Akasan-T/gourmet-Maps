import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './useAuth'
import {
  fetchMe,
  isAuthenticated,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  updateAvatar as apiUpdateAvatar,
  updateDisplayName as apiUpdateDisplayName,
} from '../api/client'

// 認証状態:
//   loading       … 起動時にトークンの有効性を確認中
//   authenticated … ログイン済み
//   anonymous     … 未ログイン
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // フラグがあれば loading として /api/account/me で確認、無ければ即 anonymous
  const [status, setStatus] = useState(() => (isAuthenticated() ? 'loading' : 'anonymous'))

  // 起動時: 認証フラグがあればユーザー情報を取得してログイン状態を復元する
  useEffect(() => {
    if (!isAuthenticated()) return undefined

    let ignore = false

    fetchMe()
      .then((me) => {
        if (ignore) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        if (ignore) return
        setUser(null)
        setStatus('anonymous')
      })

    return () => {
      ignore = true
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    await apiLogin(email, password)
    const me = await fetchMe()
    setUser(me)
    setStatus('authenticated')
    return me
  }, [])

  const signUp = useCallback(async (email, password, inviteCode) => {
    await apiRegister(email, password, inviteCode)
  }, [])

  const signOut = useCallback(async () => {
    await apiLogout()
    setUser(null)
    setStatus('anonymous')
  }, [])

  const setDisplayName = useCallback(async (displayName) => {
    const updated = await apiUpdateDisplayName(displayName)
    setUser(updated)
    return updated
  }, [])

  const setAvatar = useCallback(async (avatarUrl) => {
    const updated = await apiUpdateAvatar(avatarUrl)
    setUser(updated)
    return updated
  }, [])

  const value = useMemo(
    () => ({ user, status, signIn, signUp, signOut, setDisplayName, setAvatar }),
    [user, status, signIn, signUp, signOut, setDisplayName, setAvatar],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
