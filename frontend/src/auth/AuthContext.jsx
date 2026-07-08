import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './useAuth'
import {
  fetchMe,
  getAccessToken,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  updateDisplayName as apiUpdateDisplayName,
} from '../api/client'

// 認証状態:
//   loading       … 起動時にトークンの有効性を確認中
//   authenticated … ログイン済み
//   anonymous     … 未ログイン
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // トークンが無ければ最初から anonymous とし、余計な再レンダーを避ける
  const [status, setStatus] = useState(() => (getAccessToken() ? 'loading' : 'anonymous'))

  // 起動時: 保存済みトークンがあればユーザー情報を取得してログイン状態を復元する
  useEffect(() => {
    if (!getAccessToken()) return undefined

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

  const signOut = useCallback(() => {
    apiLogout()
    setUser(null)
    setStatus('anonymous')
  }, [])

  const setDisplayName = useCallback(async (displayName) => {
    const updated = await apiUpdateDisplayName(displayName)
    setUser(updated)
    return updated
  }, [])

  const value = useMemo(
    () => ({ user, status, signIn, signUp, signOut, setDisplayName }),
    [user, status, signIn, signUp, signOut, setDisplayName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
