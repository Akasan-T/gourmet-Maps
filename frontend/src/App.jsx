import { useState } from 'react'
import './App.css'
import BottomNavigation from './components/BottomNavigation'
import DailySnapshot from './components/DailySnapshot'
import HeaderBar from './components/HeaderBar'
import HomeView from './components/HomeView'
import MapView from './components/MapView'
import ProfileView from './components/ProfileView'
import QuickComposer from './components/QuickComposer'
import RankView from './components/RankView'
import RecentVisitList from './components/RecentVisitList'
import { allVisits, formatRelativeTime, groupVisitsByStore, members, withinHours } from './data/visits'

const dailyStats = [
  { label: '今日の記録', value: '3件' },
  { label: '未整理メモ', value: '1件' },
  { label: '今週の再訪候補', value: '4店' },
]

const quickTags = ['また行く', '一口目が強い', '接客よい', '写真映え', '量が多い']
const visitTypes = ['ひとり', '同僚と', '家族と', 'テイクアウト']

const visits24h = allVisits.filter((visit) => withinHours(visit, 24))
const storesToday = groupVisitsByStore(visits24h)
const ranking24h = [...visits24h].sort((a, b) => b.taste - a.taste)

const allStores = groupVisitsByStore(allVisits)

const recentVisits = [...allVisits]
  .sort((a, b) => b.visitedAt - a.visitedAt)
  .slice(0, 2)
  .map((visit) => ({
    restaurant: visit.store.name,
    menu: visit.menu,
    time: formatRelativeTime(visit.visitedAt),
    taste: visit.taste.toFixed(1),
    repeat: visit.repeat.toFixed(1),
    volume: visit.volume.toFixed(1),
    memo: visit.memo,
    tag: visit.tag,
    emoji: visit.store.emoji,
    gradient: visit.store.gradient,
  }))

const currentUser = { name: members[0].name, entryCount: allVisits.length, favoriteCount: 12 }

const navigationItems = [
  { key: 'home', label: 'ホーム' },
  { key: 'capture', label: '記録' },
  { key: 'map', label: '地図' },
  { key: 'rank', label: '順位' },
  { key: 'profile', label: '自分' },
]

function App() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" aria-hidden="true"></div>
      <main className="mobile-frame">
        <HeaderBar />

        {activeTab === 'home' && <HomeView stores={storesToday} ranking={ranking24h} />}

        {activeTab === 'capture' && (
          <>
            <DailySnapshot stats={dailyStats} />
            <QuickComposer quickTags={quickTags} visitTypes={visitTypes} />
            <RecentVisitList visits={recentVisits} />
          </>
        )}

        {activeTab === 'map' && <MapView stores={allStores} members={members} />}

        {activeTab === 'rank' && <RankView stores={allStores} />}

        {activeTab === 'profile' && <ProfileView user={currentUser} members={members} />}
      </main>
      <BottomNavigation items={navigationItems} activeKey={activeTab} onSelect={setActiveTab} />
    </div>
  )
}

export default App
