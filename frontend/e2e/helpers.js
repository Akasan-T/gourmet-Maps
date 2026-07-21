// ログイン後のアプリ表示に必要な API 呼び出しをまとめてモックするヘルパー。
// 実際のバックエンドに依存せず E2E を安定して回すために使う。
// 呼び出し順: POST /api/auth/login -> GET /api/account/me -> GET /api/GourmetEntries, /api/Members

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

export const sampleEntries = [
  {
    id: 1,
    name: '麺屋テスト',
    genre: 'ラーメン',
    tasteRating: 4.5,
    costPerformanceRating: 4.0,
    appearanceRating: 3.5,
    serviceRating: 4.0,
    repeatRating: 4.0,
    volumeRating: 3.5,
    memo: 'メニュー: 味噌ラーメン\n訪問タイプ: ひとり\nタグ: また行く',
    visitDate: new Date().toISOString(),
    latitude: 35.6812,
    longitude: 139.7671,
    recordedByDisplayName: 'テスト太郎',
    storeID: 1,
  },
  {
    id: 2,
    name: 'カフェモック',
    genre: 'カフェ',
    tasteRating: 3.0,
    costPerformanceRating: 3.5,
    appearanceRating: 4.5,
    serviceRating: 4.0,
    repeatRating: 3.5,
    volumeRating: 3.0,
    memo: 'メニュー: ラテ\n訪問タイプ: 同僚と',
    visitDate: new Date().toISOString(),
    latitude: 35.6825,
    longitude: 139.7680,
    recordedByDisplayName: 'テスト太郎',
    storeID: 2,
  },
]

export const sampleMembers = [
  { id: 'member-1', displayName: 'テスト太郎', avatarUrl: '' },
  { id: 'member-2', displayName: 'テスト花子', avatarUrl: '' },
]

export const sampleMe = {
  email: 'tester@example.com',
  displayName: 'テスト太郎',
  avatarUrl: '',
  titles: ['初代タベマップ'],
  canIssueInvites: true,
}

export async function mockAuthenticatedApi(page, overrides = {}) {
  const {
    me = sampleMe,
    entries = [],
    members = sampleMembers,
  } = overrides

  await page.route('**/api/auth/login', (route) =>
    json(route, { succeeded: true }),
  )
  await page.route('**/api/account/me', (route) => json(route, me))
  await page.route('**/api/GourmetEntries', (route) => {
    if (route.request().method() === 'GET') {
      return json(route, entries)
    }
    return json(route, { id: 99, ...JSON.parse(route.request().postData() || '{}') })
  })
  await page.route('**/api/GourmetEntries/rankings/overall', (route) => json(route, []))
  await page.route('**/api/GourmetEntries/rankings/genres', (route) => json(route, []))
  await page.route('**/api/Members', (route) => json(route, members))
  await page.route('**/api/Members/*', (route) =>
    json(route, { ...members[0], entries: [], titles: [] }),
  )
  await page.route('**/api/Stores*', (route) => json(route, []))
  await page.route('**/api/places/search*', (route) => json(route, []))
  await page.route('**/api/titles', (route) => json(route, [
    { id: 1, name: '初代タベマップ', description: '最初のメンバー', threshold: 0, isUnlocked: true },
    { id: 2, name: 'ラーメン通', description: 'ラーメン10件記録', threshold: 10, isUnlocked: false },
  ]))
  await page.route('**/api/invites', (route) => {
    if (route.request().method() === 'POST') {
      return json(route, { code: 'TEST-1234', expiresAt: new Date(Date.now() + 3600000).toISOString() })
    }
    return json(route, [])
  })
  await page.route('**/api/auth/logout', (route) => json(route, {}))
  await page.route('**/api/auth/refresh', (route) => json(route, {}))
  // Overpass API (外部) をモックして E2E を安定させる
  await page.route('**/overpass-api.de/**', (route) =>
    json(route, { elements: [] }),
  )
}

export async function loginAndNavigate(page, overrides = {}) {
  await mockAuthenticatedApi(page, overrides)
  await page.goto('/')
  await login(page)
  // アプリ画面が表示されるまで待つ
  await page.getByText('記録', { exact: true }).waitFor({ state: 'visible' })
}

export async function login(page, email = 'tester@example.com', password = 'Passw0rd!') {
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole('button', { name: 'ログイン' }).click()
}
