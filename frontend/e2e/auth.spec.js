import { test, expect } from '@playwright/test'
import { mockAuthenticatedApi, login } from './helpers.js'

test.describe('認証', () => {
  test('未ログインではログインフォームが表示される (AUTH-11)', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
  })

  test('ログイン成功でアプリ画面に遷移する (AUTH-01)', async ({ page }) => {
    await mockAuthenticatedApi(page)

    await page.goto('/')
    await login(page)

    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeHidden()
    await expect(page.getByText('記録', { exact: true })).toBeVisible()
  })

  test('パスワード表示トグルで平文/マスクが切り替わる (AUTH-07)', async ({ page }) => {
    await page.goto('/')

    const password = page.locator('input[type="password"]').first()
    await password.fill('secret123')
    await expect(page.locator('input[type="password"]')).toHaveCount(1)

    await page.getByRole('button', { name: 'パスワードを表示する' }).click()
    await expect(page.locator('input[type="text"]')).toBeVisible()
  })

  test('新規登録フォームに切り替えられる (AUTH-03)', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '新規登録' }).click()

    await expect(page.getByRole('heading', { name: '新規登録' })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByPlaceholder('例: ABCD-2345')).toBeVisible()
    await expect(page.getByRole('button', { name: '登録する' })).toBeVisible()
  })

  test('新規登録→ログインに戻れる (AUTH-03b)', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '新規登録' }).click()
    await expect(page.getByRole('heading', { name: '新規登録' })).toBeVisible()

    await page.getByRole('button', { name: 'ログイン' }).click()
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
  })

  test('パスワードリセットフローの画面遷移 (AUTH-08)', async ({ page }) => {
    await page.route('**/api/auth/forgotPassword', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )

    await page.goto('/')

    await page.getByRole('button', { name: 'パスワードをお忘れですか？' }).click()
    await expect(page.getByRole('heading', { name: 'パスワードをお忘れですか？' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'コードを送信' })).toBeVisible()

    await page.locator('input[type="email"]').fill('tester@example.com')
    await page.getByRole('button', { name: 'コードを送信' }).click()

    await expect(page.getByRole('heading', { name: 'パスワードの再設定' })).toBeVisible()
    await expect(page.getByPlaceholder('リセットコード')).toBeVisible()
    await expect(page.getByRole('button', { name: 'パスワードを再設定' })).toBeVisible()
  })

  test('パスワードリセット画面からログインに戻れる (AUTH-08b)', async ({ page }) => {
    await page.route('**/api/auth/forgotPassword', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )

    await page.goto('/')
    await page.getByRole('button', { name: 'パスワードをお忘れですか？' }).click()
    await page.locator('input[type="email"]').fill('tester@example.com')
    await page.getByRole('button', { name: 'コードを送信' }).click()

    await expect(page.getByRole('heading', { name: 'パスワードの再設定' })).toBeVisible()

    await page.getByRole('button', { name: 'ログインに戻る' }).click()
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
  })

  test('ログイン失敗時にエラーメッセージが表示される (AUTH-02)', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
    )

    await page.goto('/')
    await login(page)

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByText('メールアドレスまたはパスワードが正しくありません')).toBeVisible()
  })

  test('新規登録失敗時にエラーメッセージが表示される (AUTH-05)', async ({ page }) => {
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: '招待コードが無効です。' }),
      }),
    )

    await page.goto('/')
    await page.getByRole('button', { name: '新規登録' }).click()

    await page.locator('input[type="email"]').fill('new@example.com')
    await page.locator('input[type="password"]').first().fill('Passw0rd!')
    await page.getByPlaceholder('例: ABCD-2345').fill('WRONG-CODE')
    await page.getByRole('button', { name: '登録する' }).click()

    await expect(page.getByText('招待コードが無効です')).toBeVisible()
  })
})
