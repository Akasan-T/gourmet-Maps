import { test, expect } from '@playwright/test'
import { loginAndNavigate, sampleEntries } from './helpers.js'

test.describe('タブナビゲーション', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, { entries: sampleEntries })
  })

  test('ホームタブがデフォルトで表示される (NAV-01)', async ({ page }) => {
    await expect(page.getByText('直近24時間に行ったお店')).toBeVisible()
    const homeTab = page.locator('.bottom-nav__item', { hasText: 'ホーム' })
    await expect(homeTab).toHaveAttribute('aria-current', 'page')
  })

  test('記録タブに切り替えできる (NAV-02)', async ({ page }) => {
    await page.getByText('記録', { exact: true }).click()

    await expect(page.getByText('来店直後に記録')).toBeVisible()
    const captureTab = page.locator('.bottom-nav__item', { hasText: '記録' })
    await expect(captureTab).toHaveAttribute('aria-current', 'page')
  })

  test('地図タブに切り替えできる (NAV-03)', async ({ page }) => {
    await page.getByText('地図', { exact: true }).click()

    // MapView の存在を確認
    await expect(page.locator('.leaflet-container')).toBeVisible()
  })

  test('順位タブに切り替えできる (NAV-04)', async ({ page }) => {
    await page.getByText('順位', { exact: true }).click()

    await expect(page.getByText('Rankings')).toBeVisible()
    await expect(page.getByText('総合の順位')).toBeVisible()
  })

  test('全タブを順番に切り替えて各画面が表示される (NAV-05)', async ({ page }) => {
    // 記録
    await page.getByText('記録', { exact: true }).click()
    await expect(page.getByText('来店直後に記録')).toBeVisible()

    // 地図
    await page.getByText('地図', { exact: true }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible()

    // 順位
    await page.getByText('順位', { exact: true }).click()
    await expect(page.getByText('総合の順位')).toBeVisible()

    // ホームに戻る
    await page.getByText('ホーム', { exact: true }).click()
    await expect(page.getByText('直近24時間に行ったお店')).toBeVisible()
  })

  test('ヘッダーのアバターからプロフィール画面を開ける (NAV-06)', async ({ page }) => {
    await page.getByRole('button', { name: '自分のページを開く' }).click()

    await expect(page.getByText('Your account')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'テスト太郎' })).toBeVisible()
  })

  test('URLパラメータ ?tab=capture で記録タブが初期表示される (NAV-07)', async ({ page }) => {
    await page.goto('/?tab=capture')

    await expect(page.getByText('来店直後に記録')).toBeVisible()
  })

  test('不正なtabパラメータはホームにフォールバックする (NAV-08)', async ({ page }) => {
    await page.goto('/?tab=invalid')

    await expect(page.getByText('直近24時間に行ったお店')).toBeVisible()
  })
})
