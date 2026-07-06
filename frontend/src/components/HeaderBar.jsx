import ThemePicker from './ThemePicker'

function HeaderBar({ todayLabel, placeLabel, themes, activeTheme, onThemeChange }) {
  return (
    <header className="app-header">
      <div className="app-header__top">
        <p className="eyebrow">Quick update mode</p>
        <ThemePicker themes={themes} activeTheme={activeTheme} onChange={onThemeChange} />
      </div>
      <div>
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