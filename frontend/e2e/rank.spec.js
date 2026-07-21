import { test, expect } from '@playwright/test'
import { loginAndNavigate, sampleEntries } from './helpers.js'

const overallRanking = [
  {
    name: '麺屋テスト',
    genre: 'ラーメン',
    visitCount: 5,
    averageOverallRating: 4.2,
    bayesianScore: 4.0,
  },
  {
    name: 'カフェモック',
    genre: 'カフェ',
    visitCount: 3,
    averageOverallRating: 3.8,
    bayesianScore: 3.5,
  },
]

const genreRanking = [
  {
    genre: 'ラーメン',
    stores: [
      { name: '麺屋テスト', visitCount: 5, averageOverallRating: 4.2, bayesianScore: 4.0 },
    ],
  },
  {
    genre: 'カフェ',
    stores: [
      { name: 'カフェモック', visitCount: 3, averageOverallRating: 3.8, bayesianScore: 3.5 },
    ],
  },
]

test.describe('順位画面', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, { entries: sampleEntries })

    // ランキングAPIをオーバーライド
    await page.route('**/api/GourmetEntries/rankings/overall', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overallRanking) }),
    )
    await page.route('**/api/GourmetEntries/rankings/genres', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(genreRanking) }),
    )

    await page.getByText('順位', { exact: true }).click()
    await expect(page.getByText('総合の順位')).toBeVisible()
  })

  test('総合ランキングが表示される (RANK-01)', async ({ page }) => {
    // デフォルトで「総合」モードが選択されている
    const overallChip = page.locator('.chip', { hasText: '総合' }).first()
    await expect(overallChip).toHaveClass(/chip--active/)

    await expect(page.getByText('麺屋テスト')).toBeVisible()
    await expect(page.getByText('カフェモック')).toBeVisible()
  })

  test('ジャンル別モードに切り替えできる (RANK-02)', async ({ page }) => {
    await page.locator('.chip', { hasText: 'ジャンル別' }).click()

    await expect(page.getByText('ジャンル別の順位')).toBeVisible()
    // ジャンルチップが表示される
    await expect(page.locator('.chip', { hasText: 'ラーメン' }).first()).toBeVisible()
    await expect(page.locator('.chip', { hasText: 'カフェ' }).first()).toBeVisible()
  })

  test('ジャンル別でジャンルを切り替えるとリストが変わる (RANK-03)', async ({ page }) => {
    await page.locator('.chip', { hasText: 'ジャンル別' }).click()

    // デフォルトでラーメンジャンルが選択されている
    await expect(page.getByText('麺屋テスト')).toBeVisible()

    // カフェに切り替え
    await page.locator('.chip', { hasText: 'カフェ' }).first().click()
    await expect(page.getByText('カフェモック')).toBeVisible()
  })

  test('個別基準モードに切り替えできる (RANK-04)', async ({ page }) => {
    await page.locator('.chip', { hasText: '個別基準' }).click()

    await expect(page.getByText('個別基準の順位')).toBeVisible()
    // 基準チップが表示される
    await expect(page.locator('.chip', { hasText: '味' }).first()).toBeVisible()
    await expect(page.locator('.chip', { hasText: 'コスパ' }).first()).toBeVisible()
    await expect(page.locator('.chip', { hasText: '雰囲気' }).first()).toBeVisible()
    await expect(page.locator('.chip', { hasText: '接客' }).first()).toBeVisible()
  })

  test('個別基準の切り替えでスコアが変わる (RANK-05)', async ({ page }) => {
    await page.locator('.chip', { hasText: '個別基準' }).click()

    // デフォルトは「味」基準
    const tasteChip = page.locator('.chip', { hasText: '味' }).first()
    await expect(tasteChip).toHaveClass(/chip--active/)

    // 「コスパ」に切り替え
    await page.locator('.chip', { hasText: 'コスパ' }).first().click()
    const costChip = page.locator('.chip', { hasText: 'コスパ' }).first()
    await expect(costChip).toHaveClass(/chip--active/)
    await expect(tasteChip).not.toHaveClass(/chip--active/)
  })

  test('モードを切り替えて戻しても正しく表示される (RANK-06)', async ({ page }) => {
    // ジャンル別に切り替え
    await page.locator('.chip', { hasText: 'ジャンル別' }).click()
    await expect(page.getByText('ジャンル別の順位')).toBeVisible()

    // 総合に戻す
    await page.locator('.chip', { hasText: '総合' }).first().click()
    await expect(page.getByText('総合の順位')).toBeVisible()
    await expect(page.getByText('麺屋テスト')).toBeVisible()
  })
})
