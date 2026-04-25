function DailySnapshot({ stats }) {
  return (
    <section className="snapshot-card" aria-labelledby="snapshot-title">
      <div className="snapshot-card__header">
        <p className="eyebrow">Today at a glance</p>
        <h2 id="snapshot-title">いまの食記録</h2>
      </div>
      <div className="snapshot-card__grid">
        {stats.map((stat) => (
          <article key={stat.label} className="snapshot-metric">
            <p className="snapshot-metric__value">{stat.value}</p>
            <p className="snapshot-metric__label">{stat.label}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default DailySnapshot