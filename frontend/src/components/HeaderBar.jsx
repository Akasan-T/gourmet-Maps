import BrandMark from './BrandMark'

function HeaderBar({ onProfileClick, isProfileActive, avatarUrl }) {
  return (
    <header className="app-header">
      <BrandMark />
      <button
        type="button"
        className={`app-header__profile-button${isProfileActive ? ' app-header__profile-button--active' : ''}`}
        aria-label="自分のページを開く"
        onClick={onProfileClick}
      >
        {avatarUrl ? (
          <img className="app-header__profile-avatar" src={avatarUrl} alt="" />
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
          </svg>
        )}
      </button>
    </header>
  )
}

export default HeaderBar
