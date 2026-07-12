function RatingSelector({ label, helper, options, value, onChange, descriptions }) {
  const activeDescription = descriptions?.[value]
  const sortedOptions = [...options].sort((a, b) => Number(a) - Number(b))

  return (
    <div className="field">
      <div className="field__heading">
        <span className="field__label">{label}</span>
        <span className="field__helper">{helper}</span>
      </div>
      <div className="star-rating" role="radiogroup" aria-label={label}>
        {sortedOptions.map((option) => {
          const filled = Number(value) >= Number(option)
          const description = descriptions?.[option]

          return (
            <button
              key={option}
              type="button"
              className={`star-rating__star${filled ? ' star-rating__star--filled' : ''}`}
              aria-pressed={option === value}
              aria-label={`★${option}${description ? `: ${description}` : ''}`}
              title={description ? `★${option}: ${description}` : undefined}
              onClick={() => onChange(option)}
            >
              ★
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
