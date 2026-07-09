import { useState } from 'react'
import MemberAvatars from './MemberAvatars'
import { issueInvite } from '../api/client'

function formatExpiry(expiresAt) {
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' })
}

function ProfileView({ user, members, onSignOut, onUpdateDisplayName }) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '')
  const [status, setStatus] = useState(null) // { type, message }
  const [saving, setSaving] = useState(false)

  const titles = user.titles ?? []
  const canIssueInvites = user.canIssueInvites ?? false

  const [invite, setInvite] = useState(null) // { code, expiresAt }
  const [inviteError, setInviteError] = useState(null)
  const [issuing, setIssuing] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSaveDisplayName(event) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setStatus(null)
    try {
      await onUpdateDisplayName(displayName.trim())
      setStatus({ type: 'success', message: '表示名を更新しました。' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleIssueInvite() {
    if (issuing) return
    setIssuing(true)
    setInviteError(null)
    setCopied(false)
    try {
      const result = await issueInvite()
      setInvite(result)
    } catch (error) {
      setInviteError(error.message)
    } finally {
      setIssuing(false)
    }
  }

  async function handleCopy() {
    if (!invite?.code) return
    try {
      await navigator.clipboard.writeText(invite.code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="composer-card" aria-labelledby="profile-title">
      <div className="composer-card__header">
        <div>
          <p className="eyebrow">Your account</p>
          <h2 id="profile-title">{user.name}</h2>
          {user.email && <p className="profile-email">{user.email}</p>}
        </div>
        <button type="button" className="ghost-button" onClick={onSignOut}>
          ログアウト
        </button>
      </div>

      {titles.length > 0 && (
        <div className="profile-titles">
          <span className="field__label">称号</span>
          <div className="chip-row" role="list">
            {titles.map((title) => (
              <span key={title} className="chip chip--active" role="listitem">
                {title}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="profile-stats">
        <article className="snapshot-metric">
          <p className="snapshot-metric__value">{user.entryCount}件</p>
          <p className="snapshot-metric__label">総記録数</p>
        </article>
        <article className="snapshot-metric">
          <p className="snapshot-metric__value">{user.favoriteCount}店</p>
          <p className="snapshot-metric__label">また行くリスト</p>
        </article>
      </div>

      <form className="profile-displayname" onSubmit={handleSaveDisplayName}>
        <label className="field">
          <span className="field__label">表示名</span>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="ランキングやメンバーに表示される名前"
            maxLength={40}
          />
        </label>
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
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? '保存中…' : '表示名を保存'}
        </button>
      </form>

      {canIssueInvites && (
        <div className="profile-invite">
          <div className="field__heading">
            <span className="field__label">ワンタイム合言葉を発行</span>
          </div>
          <p className="field__helper">
            発行した合言葉は<strong>1時間・1回きり</strong>で有効。新しく招待したい人にこの合言葉を伝えると、その人だけが新規登録できます。
          </p>

          {invite && (
            <div className="profile-invite__result">
              <code className="profile-invite__code">{invite.code}</code>
              <button type="button" className="text-button" onClick={handleCopy}>
                {copied ? 'コピーしました' : 'コピー'}
              </button>
              {invite.expiresAt && (
                <p className="composer-card__nearby-status">有効期限: {formatExpiry(invite.expiresAt)} まで</p>
              )}
            </div>
          )}

          {inviteError && (
            <p className="composer-card__status composer-card__status--error" role="alert">
              {inviteError}
            </p>
          )}

          <button type="button" className="primary-button" onClick={handleIssueInvite} disabled={issuing}>
            {issuing ? '発行中…' : invite ? 'もう1つ発行' : 'ワンタイム合言葉を発行'}
          </button>
        </div>
      )}

      <div className="profile-share">
        <div className="field__heading">
          <span className="field__label">身内メンバー</span>
        </div>
        <MemberAvatars members={members} />
        <ul className="profile-share__list">
          {members.map((member) => (
            <li key={member.id}>
              <span>{member.displayName}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default ProfileView
