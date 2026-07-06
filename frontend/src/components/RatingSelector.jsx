function RatingSelector({ label, helper, options, value, onChange }) {
  return (
    <div className="field">
      <div className="field__heading">
        <span className="field__label">{label}</span>
        <span className="field__helper">{helper}</span>
      </div>
      <div className="segment-control" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const checked = option === value

          return (
            <button
              key={option}
              type="button"
              className={`segment-control__option${checked ? ' segment-control__option--active' : ''}`}
              aria-pressed={checked}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default RatingSelector