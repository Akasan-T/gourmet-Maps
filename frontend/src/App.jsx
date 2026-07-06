import { useState } from 'react'
import './App.css'
import BottomNavigation from './components/BottomNavigation'
import DailySnapshot from './components/DailySnapshot'
import HeaderBar from './components/HeaderBar'
import QuickComposer from './components/QuickComposer'
import RecentVisitList from './components/RecentVisitList'
import TabPlaceholderSection from './components/TabPlaceholderSection'
import TopMapSection from './components/TopMapSection'

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

const themes = [
  {
    key: 'forest-mist',
    label: 'Forest',
    swatches: ['#ffffff', '#dff3e5', '#4d9b6c'],
  },
  {
    key: 'mint-air',
    label: 'Mint',
    swatches: ['#ffffff', '#e5f7f5', '#59b8a5'],
  },
  {
    key: 'olive-light',
    label: 'Olive',
    swatches: ['#ffffff', '#edf4df', '#7aa05c'],
  },
  {
    key: 'sage-dawn',
    label: 'Sage',
    swatches: ['#ffffff', '#f0f5eb', '#7f9d86'],
  },
]

function App() {
  const [activeTheme, setActiveTheme] = useState(themes[0].key)
  const [activeTab, setActiveTab] = useState('map')
  const [mapRefreshKey, setMapRefreshKey] = useState(0)

  function renderActiveTab() {
    if (activeTab === 'map') {
      return <TopMapSection refreshKey={mapRefreshKey} />
    }

    if (activeTab === 'capture') {
      return (
        <>
          <DailySnapshot stats={dailyStats} />
          <QuickComposer
            quickTags={quickTags}
            visitTypes={visitTypes}
            onSaved={() => setMapRefreshKey((currentKey) => currentKey + 1)}
          />
          <RecentVisitList visits={recentVisits} />
        </>
      )
    }

    if (activeTab === 'rank') {
      return (
        <TabPlaceholderSection
          eyebrow="Ranking"
          title="ランキングはこれから接続します"
          description="味や再訪率から自動で並び替える画面をここに載せます。今は地図と記録導線を優先しています。"
        />
      )
    }

    return (
      <TabPlaceholderSection
        eyebrow="Profile"
        title="プロフィール画面は準備中です"
        description="テーマ設定や記録傾向、訪問回数のまとめをここに集約する予定です。"
      />
    )
  }

  return (
    <div className="app-shell" data-theme={activeTheme}>
      <div className="app-shell__backdrop" aria-hidden="true"></div>
      <main className="mobile-frame">
        <HeaderBar
          todayLabel="4月26日 日曜日"
          placeLabel="中野駅から徒歩4分"
          themes={themes}
          activeTheme={activeTheme}
          onThemeChange={setActiveTheme}
        />
        {renderActiveTab()}
      </main>
      <BottomNavigation items={navigationItems} activeKey={activeTab} onChange={setActiveTab} />
    </div>
  )
}

export default App
