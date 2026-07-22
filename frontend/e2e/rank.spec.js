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
    const overallChip = page.locator('.chip', { hasText: '総合' }).first()
    await expect(overallChip).toHaveClass(/chip--active/)

    await expect(page.getByText('麺屋テスト')).toBeVisible()
    await expect(page.getByText('カフェモック')).toBeVisible()
  })

  test('ジャンル別モードに切り替えできる (RANK-02)', async ({ page }) => {
    await page.locator('.chip', { hasText: 'ジャンル別' }).click()

    await expect(page.getByText('ジャンル別の順位')).toBeVisible()
    await expect(page.locator('.chip', { hasText: 'ラーメン' }).first()).toBeVisible()
    await expect(page.locator('.chip', { hasText: 'カフェ' }).first()).toBeVisible()
  })

  test('ジャンル別でジャンルを切り替えるとリストが変わる (RANK-03)', async ({ page }) => {
    await page.locator('.chip', { hasText: 'ジャンル別' }).click()

    await expect(page.getByText('麺屋テスト')).toBeVisible()

    await page.locator('.chip', { hasText: 'カフェ' }).first().click()
    await expect(page.getByText('カフェモック')).toBeVisible()
  })

  test('個別基準モードに切り替えできる (RANK-04)', async ({ page }) => {
    await page.locator('.chip', { hasText: '個別基準' }).click()

    await expect(page.getByText('個別基準の順位')).toBeVisible()
    await expect(page.locator('.chip', { hasText: '味' }).first()).toBeVisible()
    await expect(page.locator('.chip', { hasText: 'コスパ' }).first()).toBeVisible()
    await expect(page.locator('.chip', { hasText: '雰囲気' }).first()).toBeVisible()
    await expect(page.locator('.chip', { hasText: '接客' }).first()).toBeVisible()
  })

  test('個別基準の切り替えでスコアが変わる (RANK-05)', async ({ page }) => {
    await page.locator('.chip', { hasText: '個別基準' }).click()

    const tasteChip = page.locator('.chip', { hasText: '味' }).first()
    await expect(tasteChip).toHaveClass(/chip--active/)

    await page.locator('.chip', { hasText: 'コスパ' }).first().click()
    const costChip = page.locator('.chip', { hasText: 'コスパ' }).first()
    await expect(costChip).toHaveClass(/chip--active/)
    await expect(tasteChip).not.toHaveClass(/chip--active/)
  })

  test('モードを切り替えて戻しても正しく表示される (RANK-06)', async ({ page }) => {
    await page.locator('.chip', { hasText: 'ジャンル別' }).click()
    await expect(page.getByText('ジャンル別の順位')).toBeVisible()

    await page.locator('.chip', { hasText: '総合' }).first().click()
    await expect(page.getByText('総合の順位')).toBeVisible()
    await expect(page.getByText('麺屋テスト')).toBeVisible()
  })

  test('最後の晩餐モードで候補を追加・並べ替え・削除できる (RANK-07)', async ({ page }) => {
    let ranking = []
    const entryById = Object.fromEntries(sampleEntries.map((entry) => [entry.id, entry]))

    await page.route('**/api/GourmetEntries/rankings/lastsupper', async (route) => {
      if (route.request().method() === 'PUT') {
        const { entryIds } = JSON.parse(route.request().postData() || '{}')
        ranking = entryIds.map((id, index) => ({
          id,
          name: entryById[id].name,
          genre: entryById[id].genre,
          menuName: null,
          photoUrl: null,
          visitDate: entryById[id].visitDate,
          rank: index + 1,
        }))
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ranking) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ranking) })
    })

    await page.locator('.chip', { hasText: '最後の晩餐' }).click()
    await expect(page.getByText('もしこれが最後の食事だとしたら')).toBeVisible()
    await expect(page.getByText('まだ選ばれていません。')).toBeVisible()

    // カフェモックを追加 → 1位に入る
    const cafeCandidate = page.locator('.rank-item', { hasText: 'カフェモック' })
    await cafeCandidate.getByRole('button', { name: '追加' }).click()
    await expect(page.getByText('候補から追加 (1/10)')).toBeVisible()

    // 麺屋テストを追加 → 2位に入る
    const ramenCandidate = page.locator('.rank-item', { hasText: '麺屋テスト' })
    await ramenCandidate.getByRole('button', { name: '追加' }).click()
    await expect(page.getByText('候補から追加 (2/10)')).toBeVisible()

    const rankedItems = page.locator('.rank-list--lastsupper > .rank-item')
    await expect(rankedItems).toHaveCount(2)
    await expect(rankedItems.nth(0)).toContainText('カフェモック')
    await expect(rankedItems.nth(1)).toContainText('麺屋テスト')

    // 2位を1位に繰り上げる
    await rankedItems.nth(1).getByRole('button', { name: '▲' }).click()
    await expect(rankedItems.nth(0)).toContainText('麺屋テスト')
    await expect(rankedItems.nth(1)).toContainText('カフェモック')

    // カフェモックを削除
    await rankedItems.nth(1).getByRole('button', { name: '✕' }).click()
    await expect(page.locator('.rank-list--lastsupper > .rank-item')).toHaveCount(1)
    await expect(page.getByText('候補から追加 (1/10)')).toBeVisible()
  })
})
