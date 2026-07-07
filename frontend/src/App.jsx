import { useEffect, useMemo, useState } from 'react'
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
import { fetchGourmetEntries, fetchMembers } from './api/client'
import { deriveTag, formatRelativeTime, groupEntriesByStore, participantNames, withinHours } from './data/visits'

const dailyStats = [
  { label: '今日の記録', value: '3件' },
  { label: '未整理メモ', value: '1件' },
  { label: '今週の再訪候補', value: '4店' },
]

const quickTags = ['また行く', '一口目が強い', '接客よい', '写真映え', '量が多い']
const visitTypes = ['ひとり', '同僚と', '家族と', 'テイクアウト']

const navigationItems = [
  { key: 'home', label: 'ホーム' },
  { key: 'capture', label: '記録' },
  { key: 'map', label: '地図' },
  { key: 'rank', label: '順位' },
  { key: 'profile', label: '自分' },
]

const validTabKeys = new Set(['home', 'capture', 'map', 'rank', 'profile'])

function initialTabFromUrl() {
  const requestedTab = new URLSearchParams(window.location.search).get('tab')
  return validTabKeys.has(requestedTab) ? requestedTab : 'home'
}

function App() {
  const [activeTab, setActiveTab] = useState(initialTabFromUrl)
  const [entries, setEntries] = useState([])
  const [members, setMembers] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let ignore = false

    Promise.all([fetchGourmetEntries(), fetchMembers()])
      .then(([entriesResult, membersResult]) => {
        if (ignore) return
        setEntries(entriesResult)
        setMembers(membersResult)
        setLoadState('success')
      })
      .catch(() => {
        if (!ignore) setLoadState('error')
      })

    return () => {
      ignore = true
    }
  }, [reloadToken])

  const reloadData = () => setReloadToken((token) => token + 1)

  const entries24h = useMemo(() => entries.filter((entry) => withinHours(entry, 24)), [entries])
  const storesToday = useMemo(() => groupEntriesByStore(entries24h), [entries24h])
  const ranking24h = useMemo(
    () => [...entries24h].sort((a, b) => b.tasteRating - a.tasteRating),
    [entries24h],
  )

  const allStores = useMemo(() => groupEntriesByStore(entries), [entries])

  const recentVisits = useMemo(
    () =>
      [...entries]
        .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
        .slice(0, 2)
        .map((entry) => {
          const visual = groupEntriesByStore([entry])[0]
          return {
            restaurant: entry.name,
            menu: participantNames(entry).join('・') || '記録者不明',
            time: formatRelativeTime(new Date(entry.visitDate)),
            taste: entry.tasteRating.toFixed(1),
            repeat: entry.repeatRating.toFixed(1),
            volume: entry.volumeRating.toFixed(1),
            memo: entry.memo,
            tag: deriveTag(entry),
            emoji: visual.emoji,
            gradient: visual.gradient,
          }
        }),
    [entries],
  )

  const currentUser = { name: members[0]?.displayName ?? 'ゲスト', entryCount: entries.length, favoriteCount: allStores.length }

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" aria-hidden="true"></div>
      <main className="mobile-frame">
        <HeaderBar />

        {loadState === 'error' && (
          <p className="map-view__empty">バックエンドに接続できませんでした。backend が起動しているか確認してください。</p>
        )}

        {activeTab === 'home' && <HomeView stores={storesToday} ranking={ranking24h} />}

        {activeTab === 'capture' && (
          <>
            <DailySnapshot stats={dailyStats} />
            <QuickComposer quickTags={quickTags} visitTypes={visitTypes} onSaved={reloadData} />
            <RecentVisitList visits={recentVisits} />
          </>
        )}

        {activeTab === 'map' && <MapView stores={allStores} members={members} />}

        {activeTab === 'rank' && <RankView stores={allStores} members={members} />}

        {activeTab === 'profile' && <ProfileView user={currentUser} members={members} />}
      </main>
      <BottomNavigation items={navigationItems} activeKey={activeTab} onSelect={setActiveTab} />
    </div>
  )
}

export default App
