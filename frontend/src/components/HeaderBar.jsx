function HeaderBar({ todayLabel, placeLabel }) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Quick update mode</p>
        <h1>Gourmet Maps</h1>
      </div>
      <div className="app-header__meta" aria-label="Current context">
        <span>{todayLabel}</span>
        <span>{placeLabel}</span>
      </div>
    </header>
  )
}

export default HeaderBar