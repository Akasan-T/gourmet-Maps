function BottomNavigation({ items, activeKey, onChange }) {
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
            onClick={() => onChange?.(item.key)}
          >
            <span className="bottom-nav__icon" aria-hidden="true">{item.icon}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNavigation