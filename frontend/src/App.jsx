import './App.css'
import BottomNavigation from './components/BottomNavigation'
import DailySnapshot from './components/DailySnapshot'
import HeaderBar from './components/HeaderBar'
import QuickComposer from './components/QuickComposer'
import RecentVisitList from './components/RecentVisitList'

const dailyStats = [
  { label: '今日の記録', value: '3件' },
  { label: '未整理メモ', value: '1件' },
  { label: '今週の再訪候補', value: '4店' },
]

const quickTags = ['また行く', '一口目が強い', '接客よい', '写真映え', '量が多い']
const visitTypes = ['ひとり', '同僚と', '家族と', 'テイクアウト']

const recentVisits = [
  {
    restaurant: '麺処 はやし田 中野店',
    menu: '醤油らぁ麺',
    time: '15分前',
    taste: '4.6',
    repeat: '4.3',
    volume: '3.7',
    memo: '鶏の輪郭がはっきりしていて、麺を食べ切るまで温度が落ちにくい。',
    tag: 'また行く',
  },
  {
    restaurant: '喫茶シンボパン',
    menu: '厚焼きたまごサンド',
    time: '昨日',
    taste: '4.2',
    repeat: '4.0',
    volume: '4.1',
    memo: 'パンが軽いので食後の動きに影響しにくい。午後の打ち合わせ前に良さそう。',
    tag: '接客よい',
  },
]

const navigationItems = [
  { key: 'capture', label: '記録', icon: '●' },
  { key: 'map', label: '地図', icon: '▲' },
  { key: 'rank', label: '順位', icon: '■' },
  { key: 'profile', label: '自分', icon: '◆' },
]

function App() {
  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" aria-hidden="true"></div>
      <main className="mobile-frame">
        <HeaderBar todayLabel="4月26日 日曜日" placeLabel="中野駅から徒歩4分" />
        <DailySnapshot stats={dailyStats} />
        <QuickComposer quickTags={quickTags} visitTypes={visitTypes} />
        <RecentVisitList visits={recentVisits} />
      </main>
      <BottomNavigation items={navigationItems} activeKey="capture" />
    </div>
  )
}

export default App
