import { useState } from 'react'
import RatingSelector from './RatingSelector'

function QuickComposer({ quickTags, visitTypes }) {
  const [restaurantName, setRestaurantName] = useState('らぁ麺 すぎ本')
  const [menuName, setMenuName] = useState('特製塩らぁ麺')
  const [selectedVisitType, setSelectedVisitType] = useState(visitTypes[0])
  const [selectedTag, setSelectedTag] = useState(quickTags[0])
  const [tasteScore, setTasteScore] = useState('4.5')
  const [repeatScore, setRepeatScore] = useState('4.0')
  const [memo, setMemo] = useState('スープが軽くて、退店後すぐにもう一杯いけそう。')

  return (
    <section className="composer-card" aria-labelledby="composer-title">
      <div className="composer-card__header">
        <div>
          <p className="eyebrow">One-hand entry</p>
          <h2 id="composer-title">来店直後に記録</h2>
        </div>
        <button type="button" className="ghost-button">
          下書き保存
        </button>
      </div>

      <div className="composer-card__fields">
        <label className="field">
          <span className="field__label">お店</span>
          <input value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} />
        </label>

        <label className="field">
          <span className="field__label">メニュー</span>
          <input value={menuName} onChange={(event) => setMenuName(event.target.value)} />
        </label>

        <div className="field">
          <span className="field__label">訪問タイプ</span>
          <div className="chip-row" role="list">
            {visitTypes.map((visitType) => (
              <button
                key={visitType}
                type="button"
                className={`chip${visitType === selectedVisitType ? ' chip--active' : ''}`}
                onClick={() => setSelectedVisitType(visitType)}
              >
                {visitType}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">ひとことタグ</span>
          <div className="chip-row" role="list">
            {quickTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`chip${tag === selectedTag ? ' chip--active' : ''}`}
                onClick={() => setSelectedTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <RatingSelector
          label="味"
          helper="最初に残したい評価"
          value={tasteScore}
          onChange={setTasteScore}
          options={['5.0', '4.5', '4.0', '3.5', '3.0']}
        />

        <RatingSelector
          label="再訪したさ"
          helper="次も行きたいか"
          value={repeatScore}
          onChange={setRepeatScore}
          options={['5.0', '4.5', '4.0', '3.5', '3.0']}
        />

        <label className="field">
          <span className="field__label">メモ</span>
          <textarea rows="3" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </label>
      </div>

      <div className="composer-card__footer">
        <div>
          <p className="composer-card__hint">保存前でも、味と再訪だけ触れば後で追記できます。</p>
        </div>
        <button type="button" className="primary-button">
          この内容で保存
        </button>
      </div>
    </section>
  )
}

export default QuickComposer