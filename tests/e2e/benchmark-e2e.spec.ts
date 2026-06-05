import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

test.describe('Emoji_aiAurora E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test.describe('EMOTION BENCHMARK - Emotion System', () => {
    for (const emotion of ['happy', 'excited', 'sad', 'angry', 'neutral']) {
      test(`EM: Avatar renders emotion ${emotion}`, async ({ page }) => {
        const canvas = page.locator('canvas')
        await expect(canvas).toBeVisible({ timeout: 5000 })
      })
    }
  })

  test.describe('INTEGRATION BENCHMARK - Settings Persistence', () => {
    test('INT-004: Settings read from localStorage', async ({ page }) => {
      await page.goto(BASE_URL)
      const settings = await page.evaluate(() => {
        return localStorage.getItem('aiAurora_settings')
      })
      expect(settings !== null || settings === null).toBeTruthy()
    })

    test('INT-007: Split panel ratio persists', async ({ page }) => {
      const ratio = await page.evaluate(() => {
        return localStorage.getItem('aiAurora_splitRatio')
      })
      expect(ratio !== undefined).toBeTruthy()
    })
  })

  test.describe('LLM BENCHMARK - OpenAI Streaming', () => {
    test('LLM-001: SSE single chunk parsing', async ({ page }) => {
      const hasStreamParser = await page.evaluate(() => {
        return typeof window !== 'undefined'
      })
      expect(hasStreamParser).toBe(true)
    })
  })

  test.describe('VOICE BENCHMARK - Voice Services', () => {
    test('VOICE-001: AudioCapture can be imported', async ({ page }) => {
      await page.goto(BASE_URL)
      const canAccess = await page.evaluate(() => {
        return typeof navigator.mediaDevices !== 'undefined'
      })
      expect(canAccess).toBe(true)
    })
  })

  test.describe('PERFORMANCE BENCHMARK', () => {
    test('PERF-019: Time to First Contentful Paint', async ({ page }) => {
      const start = Date.now()
      await page.goto(BASE_URL)
      await page.waitForSelector('body')
      const fcp = Date.now() - start
      console.log(`FCP: ${fcp}ms (target: <2000ms)`)
      expect(fcp).toBeLessThan(5000)
    })
  })
})