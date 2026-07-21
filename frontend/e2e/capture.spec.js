import { test, expect } from '@playwright/test'
import { loginAndNavigate } from './helpers.js'

test.describe('記録フォーム (QuickComposer)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page)
    await page.getByText('記録', { exact: true }).click()
    await expect(page.getByText('来店直後に記録')).toBeVisible()
  })

  test('フォームの基本要素が表示される (CAP-01)', async ({ page }) => {
    await expect(page.locator('.field__label', { hasText: 'お店' })).toBeVisible()
    await expect(page.getByPlaceholder('店名を入力、または一覧から選択')).toBeVisible()
    await expect(page.locator('.field__label', { hasText: 'ジャンル' })).toBeVisible()
    await expect(page.locator('.field__label', { hasText: '味' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '投稿' })).toBeVisible()
  })

  test('ジャンルチップの選択が切り替わる (CAP-02)', async ({ page }) => {
    const ramenChip = page.locator('.chip', { hasText: 'ラーメン' }).first()
    const cafeChip = page.locator('.chip', { hasText: 'カフェ' }).first()

    await expect(ramenChip).toHaveClass(/chip--active/)

    await cafeChip.click()
    await expect(cafeChip).toHaveClass(/chip--active/)
    await expect(ramenChip).not.toHaveClass(/chip--active/)
  })

  test('評価セレクターで値を変更できる (CAP-03)', async ({ page }) => {
    const tasteRating = page.locator('.star-rating').first()
    await expect(tasteRating).toBeVisible()

    const stars = tasteRating.locator('.star-rating__star')
    await expect(stars).toHaveCount(5)
  })

  test('店名未入力で投稿するとエラーが出る (CAP-04)', async ({ page }) => {
    await page.getByRole('button', { name: '投稿' }).click()

    await expect(page.getByText('お店の名前を入力してください')).toBeVisible()
  })

  test('詳細を追加ボタンで追加フィールドが展開する (CAP-05)', async ({ page }) => {
    await expect(page.locator('.field__label', { hasText: 'メニュー' })).toBeHidden()

    await page.getByRole('button', { name: '詳細を追加' }).click()

    await expect(page.locator('.field__label', { hasText: 'メニュー' })).toBeVisible()
    await expect(page.locator('.field__label', { hasText: 'シーンタグ' })).toBeVisible()
    await expect(page.locator('.field__label', { hasText: '価格帯' })).toBeVisible()
    await expect(page.locator('.field__label', { hasText: '訪問タイプ' })).toBeVisible()
    await expect(page.locator('.field__label', { hasText: 'ひとことタグ' })).toBeVisible()
    await expect(page.locator('.field__label', { hasText: '誰と行った?' })).toBeVisible()
    await expect(page.locator('.field__label', { hasText: '写真（任意）' })).toBeVisible()
    await expect(page.locator('.field__label', { hasText: 'メモ' })).toBeVisible()
  })

  test('詳細を閉じるボタンで追加フィールドが折りたたまれる (CAP-06)', async ({ page }) => {
    await page.getByRole('button', { name: '詳細を追加' }).click()
    await expect(page.locator('.field__label', { hasText: 'メニュー' })).toBeVisible()

    await page.getByRole('button', { name: '詳細を閉じる' }).click()
    await expect(page.locator('.field__label', { hasText: 'メニュー' })).toBeHidden()
  })

  test('シーンタグのトグル選択ができる (CAP-07)', async ({ page }) => {
    await page.getByRole('button', { name: '詳細を追加' }).click()

    const dateChip = page.locator('.chip', { hasText: 'デート向き' })
    await dateChip.click()
    await expect(dateChip).toHaveClass(/chip--active/)

    await dateChip.click()
    await expect(dateChip).not.toHaveClass(/chip--active/)
  })

  test('メンバー一覧から「誰と行った?」を選択できる (CAP-08)', async ({ page }) => {
    await page.getByRole('button', { name: '詳細を追加' }).click()

    const memberChip = page.locator('.chip', { hasText: 'テスト花子' })
    await expect(memberChip).toBeVisible()

    await memberChip.click()
    await expect(memberChip).toHaveClass(/chip--active/)

    await memberChip.click()
    await expect(memberChip).not.toHaveClass(/chip--active/)
  })

  test('投稿成功後にステータスメッセージが表示される (CAP-09)', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 35.6812, longitude: 139.7671 })

    await page.getByPlaceholder('店名を入力、または一覧から選択').fill('テストラーメン')

    await page.getByRole('button', { name: '投稿' }).click()

    await expect(page.getByText('保存しました')).toBeVisible({ timeout: 10000 })
  })
})
