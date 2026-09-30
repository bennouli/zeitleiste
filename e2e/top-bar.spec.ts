import { expect, test, type Page } from '@playwright/test'
import { messages } from '../src/i18n/messages'
import { openTimeline } from './timeline'

type Box = { x: number; y: number; width: number; height: number }

const POST_PATH = '/de/post/oktoberrevolution'
const SETTLE_WAIT_MS = 1000

const intersects = (a: Box, b: Box) =>
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height

const contains = (outer: Box, inner: Box) =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height

const cardBoxes = (page: Page) =>
    page.locator('[data-layer="cards"] [data-entry-id]').evaluateAll((els) =>
        els.map((el) => ({
            id: (el as HTMLElement).dataset.entryId,
            box: el.getBoundingClientRect().toJSON() as Box,
        }))
    )

for (const size of [
    { width: 390, height: 844 },
    { width: 1920, height: 1080 },
]) {
    test(`no label enters the top bar at ${size.width} px`, async ({
        page,
    }) => {
        await page.setViewportSize(size)
        await openTimeline(page, POST_PATH)
        await page.waitForTimeout(SETTLE_WAIT_MS)
        const bar = (await page.locator('[data-top-bar]').boundingBox())!

        const cards = await cardBoxes(page)

        expect(cards.length).toBeGreaterThan(0)
        const inBar = cards.filter(({ box }) => intersects(box, bar))
        expect(inBar.map(({ id }) => id)).toEqual([])
    })
}

test('the top bar holds the wordmark, the language switch and the zoom controls', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openTimeline(page, POST_PATH)
    const bar = page.locator('[data-top-bar]')
    const barBox = (await bar.boundingBox())!
    const controls = [
        bar.getByRole('img', { name: messages.de.site.name }),
        bar.getByRole('link', { name: 'English' }),
        bar.getByRole('button', { name: 'Herauszoomen', exact: true }),
        bar.getByRole('button', { name: 'Hineinzoomen', exact: true }),
    ]

    const controlBoxes = await Promise.all(controls.map((c) => c.boundingBox()))

    for (const box of controlBoxes) expect(contains(barBox, box!)).toBe(true)
})
