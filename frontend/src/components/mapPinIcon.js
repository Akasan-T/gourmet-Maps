import L from 'leaflet'

// ジャンル色のしずく型ピンの頭に、白い円＋ジャンル絵文字を載せる。
// 引数は { color, emoji } を推奨。後方互換のため色文字列だけの呼び出しも受け付ける。
export function createPinIcon(options) {
  const { color = '#6b7688', emoji = '' } =
    typeof options === 'string' ? { color: options } : (options ?? {})

  const emojiMarkup = emoji
    ? `<span class="map-pin-icon__emoji">${emoji}</span>`
    : ''

  const html = `
    <div class="map-pin-icon__wrap">
      <svg class="map-pin-icon__svg" width="34" height="44" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg">
        <path fill="${color}" stroke="#ffffff" stroke-width="2"
          d="M18 2C10.27 2 4 8.06 4 15.5C4 25 18 43 18 43S32 25 32 15.5C32 8.06 25.73 2 18 2Z"/>
        <circle cx="18" cy="15.5" r="9" fill="#fffaf5"/>
      </svg>
      ${emojiMarkup}
    </div>
  `

  return L.divIcon({
    html,
    className: 'map-pin-icon',
    iconSize: [34, 44],
    iconAnchor: [17, 43],
    popupAnchor: [0, -38],
  })
}

export function createCurrentLocationIcon() {
  const svg = `
    <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="8" fill="#2563eb" fill-opacity="0.25"/>
      <circle cx="10" cy="10" r="5" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
    </svg>
  `

  return L.divIcon({
    html: svg,
    className: 'map-current-location-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  })
}
