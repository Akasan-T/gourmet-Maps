import { useState } from 'react'
import RatingSelector from './RatingSelector'

const defaultApiBaseUrl = 'http://localhost:5001'

function QuickComposer({ quickTags, visitTypes, onSaved }) {
  const [restaurantName, setRestaurantName] = useState('らぁ麺 すぎ本')
  const [menuName, setMenuName] = useState('特製塩らぁ麺')
  const [selectedVisitType, setSelectedVisitType] = useState(visitTypes[0])
  const [selectedTag, setSelectedTag] = useState(quickTags[0])
  const [tasteScore, setTasteScore] = useState('4.5')
  const [repeatScore, setRepeatScore] = useState('4.0')
  const [memo, setMemo] = useState('スープが軽くて、退店後すぐにもう一杯いけそう。')
  const [submitState, setSubmitState] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl

  async function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('geolocation-unavailable'))
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    })
  }

  async function handleSubmit() {
    if (!restaurantName.trim()) {
      setSubmitState('error')
      setStatusMessage('お店の名前を入力してください。')
      return
    }

    setSubmitState('saving')
    setStatusMessage('現在地を取得しています。')

    try {
      const position = await getCurrentPosition()
      const taste = Number(tasteScore)
      const repeat = Number(repeatScore)
      const memoLines = [
        menuName.trim() ? `メニュー: ${menuName.trim()}` : '',
        `訪問タイプ: ${selectedVisitType}`,
        `タグ: ${selectedTag}`,
        memo.trim(),
      ].filter(Boolean)

      setStatusMessage('保存しています。')

      const response = await fetch(`${apiBaseUrl}/api/GourmetEntries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: restaurantName.trim(),
          genre: selectedTag,
          overallRating: Number(((taste + repeat) / 2).toFixed(1)),
          tasteRating: taste,
          repeatRating: repeat,
          memo: memoLines.join('\n'),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      })

      if (!response.ok) {
        throw new Error(`save-failed-${response.status}`)
      }

      setSubmitState('success')
      setStatusMessage('保存しました。地図のピンを更新しています。')
      onSaved?.()
    } catch (error) {
      setSubmitState('error')
      if (error?.code === 1) {
        setStatusMessage('位置情報の利用が拒否されました。ブラウザで許可してください。')
        return
      }
      if (error?.code === 2 || error?.code === 3) {
        setStatusMessage('現在地の取得に失敗しました。通信状況を確認してください。')
        return
      }
      setStatusMessage('保存に失敗しました。backend が起動しているか確認してください。')
    }
  }

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
          <p className="composer-card__hint">保存時に現在地を使って地図へピンを立てます。</p>
          {statusMessage && (
            <p className={`composer-card__status composer-card__status--${submitState}`}>{statusMessage}</p>
          )}
        </div>
        <button type="button" className="primary-button" onClick={handleSubmit} disabled={submitState === 'saving'}>
          この内容で保存
        </button>
      </div>
    </section>
  )
}

export default QuickComposer