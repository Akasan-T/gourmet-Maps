import MemberAvatars from './MemberAvatars'

function ProfileView({ user, members }) {
  return (
    <section className="composer-card" aria-labelledby="profile-title">
      <div className="composer-card__header">
        <div>
          <p className="eyebrow">Your account</p>
          <h2 id="profile-title">{user.name}</h2>
        </div>
        <button type="button" className="ghost-button">
          設定
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

      <div className="profile-share">
        <div className="field__heading">
          <span className="field__label">身内だけで共有</span>
          <button type="button" className="text-button">招待する</button>
        </div>
        <MemberAvatars members={members} />
        <ul className="profile-share__list">
          {members.map((member) => (
            <li key={member.name}>
              <span>{member.name}</span>
              <span className="visit-card__time">{member.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default ProfileView
