import { useState } from 'react'
import MemberAvatars from './MemberAvatars'

function ProfileView({ user, members, onSignOut, onUpdateDisplayName }) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '')
  const [status, setStatus] = useState(null) // { type, message }
  const [saving, setSaving] = useState(false)

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

      <div className="profile-share">
        <div className="field__heading">
          <span className="field__label">身内だけで共有</span>
          <button type="button" className="text-button">招待する</button>
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
