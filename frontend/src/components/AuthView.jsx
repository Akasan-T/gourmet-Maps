import { useState } from 'react'
import BrandMark from './BrandMark'
import { useAuth } from '../auth/useAuth'
import { forgotPassword, resetPassword } from '../api/client'

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.36 5.14A11.6 11.6 0 0 1 12 5c7 0 11 7 11 7a13.6 13.6 0 0 1-3.22 3.94M6.6 6.6C3.9 8.3 1 12 1 12s4 7 11 7a10.7 10.7 0 0 0 3.4-.56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AuthView() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // login | register | forgot | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'success' | 'error', message }
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'

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
      } else if (isForgot) {
        await forgotPassword(email)
        setStatus({
          type: 'success',
          message: 'リセットコードをメールで送信しました。届いたコードを次の画面で入力してください。',
        })
        setMode('reset')
      } else if (isReset) {
        await resetPassword(email, resetCode, newPassword)
        setStatus({
          type: 'success',
          message: 'パスワードを再設定しました。新しいパスワードでログインしてください。',
        })
        setMode('login')
        setPassword('')
        setResetCode('')
        setNewPassword('')
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
    <div className="app-shell app-shell--auth">
      <div className="app-shell__backdrop" aria-hidden="true"></div>
      <main className="mobile-frame auth-screen">
        <div className="auth-brand">
          <BrandMark />
        </div>

        <section className="composer-card auth-card" aria-labelledby="auth-title">
          <div className="composer-card__header">
            <div>
              <p className="eyebrow">
                {isRegister ? 'Create account' : isForgot || isReset ? 'Reset password' : 'Welcome back'}
              </p>
              <h2 id="auth-title">
                {isRegister
                  ? '新規登録'
                  : isForgot
                    ? 'パスワードをお忘れですか？'
                    : isReset
                      ? 'パスワードの再設定'
                      : 'ログイン'}
              </h2>
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

            {!isForgot && !isReset && (
              <label className="field">
                <span className="field__label">パスワード</span>
                <div className="field__input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isRegister ? '6文字以上・英大小/数字/記号を含む' : 'パスワード'}
                  />
                  <button
                    type="button"
                    className="field__toggle-visibility"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示する'}
                    aria-pressed={showPassword}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </label>
            )}

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

            {isReset && (
              <>
                <label className="field">
                  <span className="field__label">リセットコード</span>
                  <input
                    type="text"
                    autoComplete="one-time-code"
                    required
                    maxLength={8}
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value)}
                    placeholder="リセットコード"
                  />
                  <span className="field__helper">
                    届いたメールに記載のコードを入力してください。
                  </span>
                </label>

                <label className="field">
                  <span className="field__label">新しいパスワード</span>
                  <div className="field__input-wrap">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="6文字以上・英大小/数字/記号を含む"
                    />
                    <button
                      type="button"
                      className="field__toggle-visibility"
                      onClick={() => setShowNewPassword((value) => !value)}
                      aria-label={showNewPassword ? 'パスワードを隠す' : 'パスワードを表示する'}
                      aria-pressed={showNewPassword}
                    >
                      <EyeIcon open={showNewPassword} />
                    </button>
                  </div>
                </label>
              </>
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
              {submitting
                ? '処理中…'
                : isRegister
                  ? '登録する'
                  : isForgot
                    ? 'コードを送信'
                    : isReset
                      ? 'パスワードを再設定'
                      : 'ログイン'}
            </button>
          </form>

          {!isForgot && !isReset && (
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
          )}

          {!isRegister && !isForgot && !isReset && (
            <p className="auth-switch">
              <button type="button" className="text-button" onClick={() => switchMode('forgot')}>
                パスワードをお忘れですか？
              </button>
            </p>
          )}

          {(isForgot || isReset) && (
            <p className="auth-switch">
              <button type="button" className="text-button" onClick={() => switchMode('login')}>
                ログインに戻る
              </button>
            </p>
          )}
        </section>
      </main>
    </div>
  )
}

export default AuthView
