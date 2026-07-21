import { test, expect } from '@playwright/test'
import { loginAndNavigate, sampleEntries } from './helpers.js'

test.describe('ホーム画面', () => {
  test('データがない場合に空メッセージが表示される (HOME-01)', async ({ page }) => {
    await loginAndNavigate(page, { entries: [] })

    await expect(page.getByText('直近24時間に行ったお店')).toBeVisible()
    await expect(page.getByText('まだ直近24時間の記録がありません')).toBeVisible()
    await expect(page.getByText('まだ評価がありません')).toBeVisible()
  })

  test('記録があればランキングに店名が表示される (HOME-02)', async ({ page }) => {
    await loginAndNavigate(page, { entries: sampleEntries })

    await expect(page.getByText('直近24時間の評価ランキング')).toBeVisible()
    await expect(page.getByText('麺屋テスト')).toBeVisible()
    await expect(page.getByText('カフェモック')).toBeVisible()
  })

  test('ランキングは味の評価順に並ぶ (HOME-03)', async ({ page }) => {
    await loginAndNavigate(page, { entries: sampleEntries })

    const rankItems = page.locator('.rank-item')
    await expect(rankItems).toHaveCount(2)

    // 麺屋テスト(taste:4.5)が1位、カフェモック(taste:3.0)が2位
    const first = rankItems.nth(0)
    const second = rankItems.nth(1)
    await expect(first.getByText('麺屋テスト')).toBeVisible()
    await expect(second.getByText('カフェモック')).toBeVisible()
  })

  test('地図コンテナが表示される (HOME-04)', async ({ page }) => {
    await loginAndNavigate(page, { entries: sampleEntries })

    await expect(page.locator('.leaflet-container')).toBeVisible()
  })

  test('現在地ボタンが存在する (HOME-05)', async ({ page }) => {
    await loginAndNavigate(page, { entries: sampleEntries })

    await expect(page.getByRole('button', { name: '現在地を表示' })).toBeVisible()
  })
})
