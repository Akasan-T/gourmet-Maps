// アプリ全体で使う線画アイコン（絵文字の代わり）。
// ボトムナビ等と同じトーン: viewBox 24、stroke=currentColor、丸みのある線。
function Svg({ size = 18, strokeWidth = 1.8, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function PencilIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  )
}

export function CheckIcon(props) {
  return (
    <Svg {...props}>
      <path d="M5 13l4 4L19 7" />
    </Svg>
  )
}

export function CameraIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-2h7l1 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="3.2" />
    </Svg>
  )
}

export function LockIcon(props) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  )
}

export function BadgeCheckIcon(props) {
  return (
    <Svg {...props}>
      <path d="m9 12 2 2 4-4" />
      <circle cx="12" cy="12" r="8" />
    </Svg>
  )
}

export function SparkleIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.8 2.8M15.2 15.2 18 18M18 6l-2.8 2.8M8.8 15.2 6 18" />
    </Svg>
  )
}

export function CrownIcon(props) {
  return (
    <Svg {...props}>
      <path d="m4 8 3.5 3L12 5l4.5 6L20 8l-1.5 10h-13Z" />
      <path d="M6.5 18h11" />
    </Svg>
  )
}

export function TrophyIcon(props) {
  return (
    <Svg {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
      <path d="M12 13v3M9 20h6M10 20v-2h4v2" />
    </Svg>
  )
}

export function LocateIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Svg>
  )
}

const rankPalette = {
  1: { background: '#f4c151', color: '#5c3d05' },
  2: { background: '#c9ccd6', color: '#3a3d47' },
  3: { background: '#d79a63', color: '#4a2c10' },
}

export function RankBadge({ rank }) {
  const palette = rankPalette[rank]
  if (!palette) {
    return <span className="rank-item__medal rank-item__medal--plain">{rank}</span>
  }

  return (
    <span className="rank-item__medal" style={{ background: palette.background, color: palette.color }}>
      {rank}
    </span>
  )
}
