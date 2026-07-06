function BrandMark({ withWordmark = true, size = 40 }) {
  return (
    <div className="brand-mark">
      <img className="brand-mark__pin" src="/icons/app-icon.png" alt="タベマップ" width={size} height={size} />
      {withWordmark ? (
        <div className="brand-mark__word">
          <span className="brand-mark__title">タベマップ</span>
          <span className="brand-mark__sub">TABE MAP</span>
        </div>
      ) : null}
    </div>
  )
}

export default BrandMark
