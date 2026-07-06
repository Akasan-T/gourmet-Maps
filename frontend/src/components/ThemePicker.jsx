function ThemePicker({ themes, activeTheme, onChange }) {
  return (
    <div className="theme-picker" aria-label="Color themes">
      {themes.map((theme) => {
        const isActive = theme.key === activeTheme

        return (
          <button
            key={theme.key}
            type="button"
            className={`theme-picker__item${isActive ? ' theme-picker__item--active' : ''}`}
            onClick={() => onChange(theme.key)}
            aria-pressed={isActive}
          >
            <span className="theme-picker__swatch" aria-hidden="true">
              <span style={{ background: theme.swatches[0] }}></span>
              <span style={{ background: theme.swatches[1] }}></span>
              <span style={{ background: theme.swatches[2] }}></span>
            </span>
            <span className="theme-picker__label">{theme.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default ThemePicker