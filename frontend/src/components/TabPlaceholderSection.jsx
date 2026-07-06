function TabPlaceholderSection({ eyebrow, title, description }) {
  return (
    <section className="placeholder-card" aria-labelledby="placeholder-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id="placeholder-title">{title}</h2>
      <p className="placeholder-card__text">{description}</p>
    </section>
  )
}

export default TabPlaceholderSection