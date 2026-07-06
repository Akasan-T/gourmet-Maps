const palette = ['var(--accent-strong)', 'var(--accent-green)', 'var(--accent-blue)', '#d9a441']

function MemberAvatars({ members, compact = false }) {
  return (
    <div className={`member-avatars${compact ? ' member-avatars--compact' : ''}`}>
      <div className="member-avatars__stack">
        {members.map((member, index) => (
          <span
            key={member.id}
            className="member-avatars__badge"
            style={{ background: palette[index % palette.length] }}
            title={member.displayName}
          >
            {member.displayName.charAt(0)}
          </span>
        ))}
      </div>
      {compact ? (
        <span className="member-avatars__label">{members.length}人と共有中</span>
      ) : null}
    </div>
  )
}

export default MemberAvatars
