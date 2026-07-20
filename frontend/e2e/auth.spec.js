import { test, expect } from '@playwright/test'
import { mockAuthenticatedApi, login } from './helpers.js'

// 対応するE2E設計: AUTH-11 / AUTH-01 / CROSS-01
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

    // ログイン画面の見出しが消え、ボトムナビ(記録タブ)が現れればアプリに入れている
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeHidden()
    await expect(page.getByText('記録', { exact: true })).toBeVisible()
  })

  test('パスワード表示トグルで平文/マスクが切り替わる (AUTH-07)', async ({ page }) => {
    await page.goto('/')

    const password = page.locator('input[type="password"]').first()
    await password.fill('secret123')
    await expect(page.locator('input[type="password"]')).toHaveCount(1)

    // 目のアイコン(トグル)を押すと type が text に変わる
    await page.getByRole('button', { name: 'パスワードを表示する' }).click()
    await expect(page.locator('input[type="text"]')).toBeVisible()
  })
})
