import { test, expect } from '@playwright/test'
import { loginAndNavigate, sampleMe, sampleMembers } from './helpers.js'

test.describe('プロフィール画面', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, { entries: [] })
    await page.getByRole('button', { name: '自分のページを開く' }).click()
    await expect(page.getByText('Your account')).toBeVisible()
  })

  test('ユーザー情報が表示される (PROF-01)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'テスト太郎' })).toBeVisible()
    await expect(page.getByText('tester@example.com')).toBeVisible()
    await expect(page.getByText('総記録数')).toBeVisible()
    await expect(page.getByText('また行くリスト')).toBeVisible()
  })

  test('表示名の編集モードに切り替えられる (PROF-02)', async ({ page }) => {
    await page.getByRole('button', { name: '表示名を編集' }).click()

    const nameInput = page.locator('.profile-name-edit input[type="text"]')
    await expect(nameInput).toBeVisible()
    await expect(nameInput).toHaveValue('テスト太郎')
    await expect(page.getByRole('button', { name: '表示名を保存' })).toBeVisible()
  })

  test('表示名を更新できる (PROF-03)', async ({ page }) => {
    await page.route('**/api/account/me', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...sampleMe, displayName: '新しい名前' }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleMe),
      })
    })

    await page.getByRole('button', { name: '表示名を編集' }).click()
    const nameInput = page.locator('.profile-name-edit input[type="text"]')
    await nameInput.fill('新しい名前')
    await page.getByRole('button', { name: '表示名を保存' }).click()

    await expect(page.getByText('表示名を更新しました')).toBeVisible()
  })

  test('獲得バッジが表示される (PROF-04)', async ({ page }) => {
    await expect(page.getByText('獲得ずみのバッジ')).toBeVisible()
    await expect(page.locator('.chip', { hasText: '初代タベマップ' })).toBeVisible()
  })

  test('称号図鑑モーダルを開閉できる (PROF-05)', async ({ page }) => {
    await page.getByRole('button', { name: '称号図鑑を見る' }).click()

    await expect(page.getByRole('heading', { name: '称号図鑑' })).toBeVisible()

    await page.getByRole('button', { name: '閉じる' }).click()
    await expect(page.getByText('Your account')).toBeVisible()
  })

  test('ワンタイム合言葉の発行ボタンが表示される (PROF-06)', async ({ page }) => {
    await expect(page.locator('.field__label', { hasText: 'ワンタイム合言葉を発行' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ワンタイム合言葉を発行' })).toBeVisible()
  })

  test('ワンタイム合言葉を発行できる (PROF-07)', async ({ page }) => {
    await page.getByRole('button', { name: 'ワンタイム合言葉を発行' }).click()

    await expect(page.getByText('TEST-1234')).toBeVisible()
    await expect(page.getByText('有効期限')).toBeVisible()
    await expect(page.getByRole('button', { name: 'コピー' })).toBeVisible()
  })

  test('メンバー一覧が表示される (PROF-09)', async ({ page }) => {
    await expect(page.locator('.field__label', { hasText: 'メンバー' })).toBeVisible()
    // メンバーグリッド内に名前が表示されている
    await expect(page.locator('.member-grid__name', { hasText: 'テスト太郎' })).toBeVisible()
    await expect(page.locator('.member-grid__name', { hasText: 'テスト花子' })).toBeVisible()
  })

  test('メンバーアイコンをクリックするとプロフィールモーダルが開く (PROF-10)', async ({ page }) => {
    await page.getByRole('button', { name: 'テスト花子 のプロフィールを見る' }).click()

    // モーダル内にメンバー名が表示される
    await expect(page.getByRole('heading', { name: 'テスト花子' })).toBeVisible()
  })

  test('ログアウトボタンが表示される (PROF-11)', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
  })

  test('ログアウトするとログイン画面に戻る (PROF-12)', async ({ page }) => {
    await page.getByRole('button', { name: 'ログアウト' }).click()

    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
  })
})

test.describe('プロフィール画面 - 招待権限なし', () => {
  test('招待権限がないユーザーには発行セクションが表示されない (PROF-08)', async ({ page }) => {
    const noInviteMe = { ...sampleMe, canIssueInvites: false, titles: [] }
    await loginAndNavigate(page, { entries: [], me: noInviteMe })
    await page.getByRole('button', { name: '自分のページを開く' }).click()
    await expect(page.getByText('Your account')).toBeVisible()

    await expect(page.locator('.profile-invite')).toBeHidden()
  })

  test('バッジがないユーザーには空メッセージが表示される (PROF-13)', async ({ page }) => {
    const noBadgeMe = { ...sampleMe, canIssueInvites: false, titles: [] }
    await loginAndNavigate(page, { entries: [], me: noBadgeMe })
    await page.getByRole('button', { name: '自分のページを開く' }).click()

    await expect(page.getByText('まだ特別なバッジはありません')).toBeVisible()
  })
})
