import { useRef, useState } from 'react'
import MemberProfileModal from './MemberProfileModal'
import TitlesModal from './TitlesModal'
import { CameraIcon, CheckIcon, CrownIcon, PencilIcon } from './icons'
import { issueInvite } from '../api/client'

const memberColors = ['var(--accent-strong)', 'var(--accent-green)', 'var(--accent-blue)', '#d9a441']

function formatExpiry(expiresAt) {
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' })
}

// アイコン画像を縮小して data URL 化する（ヘッダーやメンバー一覧など随所に表示するため小さめに圧縮）
function readAndCompressAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read-failed'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('decode-failed'))
      image.onload = () => {
        const maxSize = 320
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function ProfileView({ user, members, onSignOut, onUpdateDisplayName, onUpdateAvatar }) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '')
  const [editingName, setEditingName] = useState(false)
  const [status, setStatus] = useState(null) // { type, message }
  const [saving, setSaving] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const avatarInputRef = useRef(null)

  const titles = user.titles ?? []
  const canIssueInvites = user.canIssueInvites ?? false

  const [invite, setInvite] = useState(null) // { code, expiresAt }
  const [inviteError, setInviteError] = useState(null)
  const [issuing, setIssuing] = useState(false)
  const [copied, setCopied] = useState(false)

  const [showTitles, setShowTitles] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  function handleStartEditName() {
    setDisplayName(user.displayName ?? '')
    setStatus(null)
    setEditingName(true)
  }

  async function handleSaveDisplayName(event) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setStatus(null)
    try {
      await onUpdateDisplayName(displayName.trim())
      setStatus({ type: 'success', message: '表示名を更新しました。' })
      setEditingName(false)
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || avatarSaving) return

    setAvatarSaving(true)
    setStatus(null)
    try {
      const dataUrl = await readAndCompressAvatar(file)
      await onUpdateAvatar(dataUrl)
      setStatus({ type: 'success', message: 'アイコン画像を更新しました。' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message ?? 'アイコン画像の更新に失敗しました。' })
    } finally {
      setAvatarSaving(false)
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
    <>
      <section className="composer-card" aria-labelledby="profile-title">
        <div className="composer-card__header">
          <button
            type="button"
            className="profile-avatar-button"
            aria-label="アイコン画像を変更"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarSaving}
          >
            {user.avatarUrl ? (
              <img className="profile-avatar-button__image" src={user.avatarUrl} alt="" />
            ) : (
              <span className="profile-avatar-button__placeholder">
                {(user.displayName || user.name || '?').charAt(0)}
              </span>
            )}
            <span className="profile-avatar-button__badge" aria-hidden="true">
              {avatarSaving ? '…' : <CameraIcon size={12} strokeWidth={2.2} />}
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="profile-avatar-input"
            onChange={handleAvatarChange}
          />

          <div className="profile-header">
            <p className="eyebrow">Your account</p>

            {editingName ? (
              <form className="profile-name-edit" onSubmit={handleSaveDisplayName}>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="ランキングやメンバーに表示される名前"
                  maxLength={40}
                  autoFocus
                />
                <button type="submit" className="icon-button" aria-label="表示名を保存" disabled={saving}>
                  {saving ? '…' : <CheckIcon size={16} />}
                </button>
              </form>
            ) : (
              <div className="profile-name-row">
                <h2 id="profile-title">{user.name}</h2>
                <button type="button" className="icon-button" aria-label="表示名を編集" onClick={handleStartEditName}>
                  <PencilIcon size={15} />
                </button>
              </div>
            )}

            {user.email && <p className="profile-email">{user.email}</p>}

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
          </div>
        </div>

        <div className="profile-stats">
          <article className="snapshot-metric">
            <p className="snapshot-metric__value">{user.todayCount}件</p>
            <p className="snapshot-metric__label">今日の記録</p>
          </article>
          <article className="snapshot-metric">
            <p className="snapshot-metric__value">{user.entryCount}件</p>
            <p className="snapshot-metric__label">総記録数</p>
          </article>
          <article className="snapshot-metric">
            <p className="snapshot-metric__value">{user.favoriteCount}店</p>
            <p className="snapshot-metric__label">また行くリスト</p>
          </article>
        </div>
      </section>

      <section className="composer-card" aria-labelledby="profile-badges-title">
        <div className="composer-card__header">
          <div>
            <p className="eyebrow">Badges</p>
            <h3 id="profile-badges-title">獲得ずみのバッジ</h3>
          </div>
        </div>

        {titles.length > 0 ? (
          <div className="chip-row" role="list">
            {titles.map((title) =>
              canIssueInvites ? (
                <span key={title} className="chip chip--owner" role="listitem">
                  <CrownIcon size={14} strokeWidth={2.2} />
                  {title}
                </span>
              ) : (
                <span key={title} className="chip chip--active" role="listitem">
                  {title}
                </span>
              ),
            )}
          </div>
        ) : (
          <p className="profile-empty-hint">まだ特別なバッジはありません。称号図鑑で目指す称号を確認しよう。</p>
        )}

        <button type="button" className="titles-open-button" onClick={() => setShowTitles(true)}>
          <span>称号図鑑を見る</span>
          <span className="titles-open-button__meta">全200種</span>
        </button>
        <p className="profile-badges-hint">
          上のバッジは特別な実績。称号図鑑は投稿数などに応じて増えていく称号レベルの一覧です。
        </p>
      </section>

      {showTitles && <TitlesModal onClose={() => setShowTitles(false)} />}

      {canIssueInvites && (
        <section className="composer-card profile-invite">
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
        </section>
      )}

      <section className="composer-card profile-share">
        <div className="field__heading">
          <span className="field__label">メンバー</span>
        </div>
        <p className="field__helper">アイコンをタップすると、その人の登録店舗や称号の状況を見られます。</p>
        <div className="member-grid">
          {members.map((member, index) => (
            <button
              key={member.id}
              type="button"
              className="member-grid__item"
              onClick={() => setSelectedMember(member)}
              aria-label={`${member.displayName} のプロフィールを見る`}
            >
              <span
                className="member-grid__avatar"
                style={member.avatarUrl ? undefined : { background: memberColors[index % memberColors.length] }}
                aria-hidden="true"
              >
                {member.avatarUrl ? (
                  <img className="member-grid__image" src={member.avatarUrl} alt="" />
                ) : (
                  member.displayName.charAt(0)
                )}
              </span>
              <span className="member-grid__name">{member.displayName}</span>
            </button>
          ))}
        </div>
      </section>

      {selectedMember && (
        <MemberProfileModal
          key={selectedMember.id}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}

      <section className="composer-card profile-signout">
        <button type="button" className="ghost-button" onClick={onSignOut}>
          ログアウト
        </button>
      </section>
    </>
  )
}

export default ProfileView
