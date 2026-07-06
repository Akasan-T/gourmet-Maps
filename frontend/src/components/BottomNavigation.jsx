const iconPaths = {
  home: (
    <path d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9" />
  ),
  capture: (
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 3.4v7.2M9.6 7.4v3.4c0 1.3 1.07 1.9 1.07 2.6v2.6" />
  ),
  map: (
    <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Zm0 0v14m6-14v14" />
  ),
  rank: (
    <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z" />
  ),
  profile: (
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
  ),
}

function BottomNavigation({ items, activeKey, onSelect }) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const isActive = item.key === activeKey

        return (
          <button
            key={item.key}
            type="button"
            className={`bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect?.(item.key)}
          >
            <svg
              className="bottom-nav__icon"
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
              {iconPaths[item.key]}
            </svg>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNavigation
