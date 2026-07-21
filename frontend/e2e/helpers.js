// ログイン後のアプリ表示に必要な API 呼び出しをまとめてモックするヘルパー。
// 実際のバックエンドに依存せず E2E を安定して回すために使う。
// 呼び出し順: POST /api/auth/login -> GET /api/account/me -> GET /api/GourmetEntries, /api/Members

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

export async function mockAuthenticatedApi(page, overrides = {}) {
  const {
    me = { email: 'tester@example.com', displayName: 'テスト太郎', avatarUrl: '' },
    entries = [],
    members = [],
  } = overrides

  await page.route('**/api/auth/login', (route) =>
    json(route, { succeeded: true }),
  )
  await page.route('**/api/account/me', (route) => json(route, me))
  await page.route('**/api/GourmetEntries', (route) => json(route, entries))
  await page.route('**/api/Members', (route) => json(route, members))
}

export async function login(page, email = 'tester@example.com', password = 'Passw0rd!') {
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole('button', { name: 'ログイン' }).click()
}
