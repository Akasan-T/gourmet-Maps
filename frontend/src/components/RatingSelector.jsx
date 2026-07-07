function RatingSelector({ label, helper, options, value, onChange, descriptions }) {
  const activeDescription = descriptions?.[value]

  return (
    <div className="field">
      <div className="field__heading">
        <span className="field__label">{label}</span>
        <span className="field__helper">{helper}</span>
      </div>
      <div className="segment-control" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const checked = option === value
          const description = descriptions?.[option]

          return (
            <button
              key={option}
              type="button"
              className={`segment-control__option${checked ? ' segment-control__option--active' : ''}`}
              aria-pressed={checked}
              title={description ? `★${option}: ${description}` : undefined}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          )
        })}
      </div>
      {activeDescription && (
        <p className="rating-description">★{value}: {activeDescription}</p>
      )}
    </div>
  )
}

export default RatingSelector
