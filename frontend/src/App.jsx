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
import AuthView from './components/AuthView'
import { fetchGourmetEntries, fetchMembers } from './api/client'
import { useAuth } from './auth/useAuth'
import { deriveTag, formatRelativeTime, groupEntriesByStore, withinHours } from './data/visits'

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
]

const validTabKeys = new Set(['home', 'capture', 'map', 'rank', 'profile'])

function initialTabFromUrl() {
  const requestedTab = new URLSearchParams(window.location.search).get('tab')
  return validTabKeys.has(requestedTab) ? requestedTab : 'home'
}

function App() {
  const { user, status: authStatus, signOut, setDisplayName, setAvatar } = useAuth()
  const [activeTab, setActiveTab] = useState(initialTabFromUrl)
  const [entries, setEntries] = useState([])
  const [members, setMembers] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [reloadToken, setReloadToken] = useState(0)
  const [composerPrefill, setComposerPrefill] = useState(null)

  useEffect(() => {
    // ログイン済みのときだけデータを取得する
    if (authStatus !== 'authenticated') return undefined

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
  }, [reloadToken, authStatus])

  const reloadData = () => setReloadToken((token) => token + 1)

  useEffect(() => {
    if (activeTab !== 'map') return undefined

    const { style } = document.body
    const previousOverflow = style.overflow
    style.overflow = 'hidden'

    return () => {
      style.overflow = previousOverflow
    }
  }, [activeTab])

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
            menu: entry.recordedByDisplayName ?? '記録者不明',
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

  const currentUser = {
    name: user?.displayName ?? user?.email ?? 'ゲスト',
    email: user?.email ?? '',
    displayName: user?.displayName ?? '',
    avatarUrl: user?.avatarUrl ?? '',
    entryCount: entries.length,
    favoriteCount: allStores.length,
    titles: user?.titles ?? [],
    canIssueInvites: user?.canIssueInvites ?? false,
  }

  // 認証状態の確認中はスプラッシュ、未ログインならログイン画面を表示する
  if (authStatus === 'loading') {
    return (
      <div className="app-shell">
        <div className="app-shell__backdrop" aria-hidden="true"></div>
        <main className="mobile-frame auth-screen">
          <p className="map-view__empty">読み込み中…</p>
        </main>
      </div>
    )
  }

  if (authStatus !== 'authenticated') {
    return <AuthView />
  }

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" aria-hidden="true"></div>
      <main className="mobile-frame">
        <HeaderBar
          onProfileClick={() => setActiveTab('profile')}
          isProfileActive={activeTab === 'profile'}
          avatarUrl={user?.avatarUrl}
        />

        {loadState === 'error' && (
          <p className="map-view__empty">バックエンドに接続できませんでした。backend が起動しているか確認してください。</p>
        )}

        {activeTab === 'home' && <HomeView stores={storesToday} ranking={ranking24h} onDataChange={reloadData} />}

        {activeTab === 'capture' && (
          <>
            <DailySnapshot stats={dailyStats} />
            <QuickComposer
              quickTags={quickTags}
              visitTypes={visitTypes}
              onSaved={reloadData}
              prefill={composerPrefill}
            />
            <RecentVisitList
              visits={recentVisits}
              onAppendVisit={(name) => setComposerPrefill({ name, token: Date.now() })}
            />
          </>
        )}

        {activeTab === 'map' && <MapView stores={allStores} members={members} onDataChange={reloadData} />}

        {activeTab === 'rank' && <RankView stores={allStores} onDataChange={reloadData} />}

        {activeTab === 'profile' && (
          <ProfileView
            user={currentUser}
            members={members}
            onSignOut={signOut}
            onUpdateDisplayName={setDisplayName}
            onUpdateAvatar={setAvatar}
          />
        )}
      </main>
      <BottomNavigation items={navigationItems} activeKey={activeTab} onSelect={setActiveTab} />
    </div>
  )
}

export default App
