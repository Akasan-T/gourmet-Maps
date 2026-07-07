import L from 'leaflet'

export function createPinIcon(color) {
  const svg = `
    <svg width="30" height="36" viewBox="0 0 20 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="${color}" d="M10 1C5.58 1 2 4.58 2 9c0 6.25 8 14 8 14s8-7.75 8-14c0-4.42-3.58-8-8-8z"/>
      <circle cx="10" cy="9" r="3.2" fill="#fffaf5"/>
    </svg>
  `

  return L.divIcon({
    html: svg,
    className: 'map-pin-icon',
    iconSize: [30, 36],
    iconAnchor: [15, 36],
    popupAnchor: [0, -32],
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
