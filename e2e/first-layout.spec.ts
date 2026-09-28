import { expect, test, type Page } from '@playwright/test'
import { openTimeline } from './timeline'

const SETTLE_WAIT_MS = 1000

const cardPositions = (page: Page) =>
    page.locator('[data-layer="cards"] [data-entry-id]').evaluateAll((els) =>
        els.map((el) => {
            const { x, y } = el.getBoundingClientRect()
            return `${(el as HTMLElement).dataset.entryId} ${x} ${y}`
        })
    )

for (const [label, size] of [
    ['desktop', { width: 1280, height: 800 }],
    ['phone', { width: 390, height: 844 }],
] as const) {
    test(`the entries never rearrange after load without input (${label})`, async ({
        page,
    }) => {
        await page.setViewportSize(size)
        await openTimeline(page)
        const firstLayout = await cardPositions(page)

        await page.waitForTimeout(SETTLE_WAIT_MS)

        expect(firstLayout.length).toBeGreaterThan(0)
        expect(await cardPositions(page)).toEqual(firstLayout)
    })
}
