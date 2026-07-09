import { useState } from 'react'
import BrandMark from './BrandMark'
import { useAuth } from '../auth/useAuth'

function AuthView() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // login | register
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [status, setStatus] = useState(null) // { type: 'success' | 'error', message }
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'

  function switchMode(nextMode) {
    setMode(nextMode)
    setStatus(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setStatus(null)

    try {
      if (isRegister) {
        await signUp(email, password, inviteCode)
        setStatus({
          type: 'success',
          message: '登録が完了しました。同じメールアドレスとパスワードでログインしてください。',
        })
        setMode('login')
        setPassword('')
        setInviteCode('')
      } else {
        await signIn(email, password)
        // 成功すると認証状態が変わり、App 側で自動的にアプリ画面へ切り替わる
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" aria-hidden="true"></div>
      <main className="mobile-frame auth-screen">
        <div className="auth-brand">
          <BrandMark />
        </div>

        <section className="composer-card auth-card" aria-labelledby="auth-title">
          <div className="composer-card__header">
            <div>
              <p className="eyebrow">{isRegister ? 'Create account' : 'Welcome back'}</p>
              <h2 id="auth-title">{isRegister ? '新規登録' : 'ログイン'}</h2>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field__label">メールアドレス</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="field">
              <span className="field__label">パスワード</span>
              <input
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isRegister ? '6文字以上・英大小/数字/記号を含む' : 'パスワード'}
              />
            </label>

            {isRegister && (
              <label className="field">
                <span className="field__label">ワンタイム合言葉</span>
                <input
                  type="text"
                  autoComplete="off"
                  required
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  placeholder="例: ABCD-2345"
                />
                <span className="field__helper">
                  既存メンバーから受け取ったワンタイム合言葉を入力してください。1時間・1回きりで有効です。
                </span>
              </label>
            )}

            {status && (
              <p
                className={`composer-card__status ${
                  status.type === 'success'
                    ? 'composer-card__status--success'
                    : 'composer-card__status--error'
                }`}
                role={status.type === 'error' ? 'alert' : 'status'}
              >
                {status.message}
              </p>
            )}

            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? '処理中…' : isRegister ? '登録する' : 'ログイン'}
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? 'すでにアカウントをお持ちですか？' : 'アカウントをお持ちでないですか？'}{' '}
            <button
              type="button"
              className="text-button"
              onClick={() => switchMode(isRegister ? 'login' : 'register')}
            >
              {isRegister ? 'ログイン' : '新規登録'}
            </button>
          </p>
        </section>
      </main>
    </div>
  )
}

export default AuthView
