import { expect, test, type Locator, type Page } from '@playwright/test'
import { openTimeline, timelineRegion } from './timeline'

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })

const ZOOM_STEPS = 4

const viewEnd = async (region: Locator) =>
    Number(await region.getAttribute('data-view-end'))

async function zoomInAndPanToEnd(page: Page) {
    const region = timelineRegion(page)
    await region.focus()
    for (let i = 0; i < ZOOM_STEPS; i++) await page.keyboard.press('+')
    await expect(async () => {
        const endBeforePan = await viewEnd(region)
        await page.keyboard.press('ArrowRight')
        expect(await viewEnd(region)).toBe(endBeforePan)
    }).toPass({ intervals: [0] })
    const regionBox = (await region.boundingBox())!
    expect(await todayMarkX(page)).toBeGreaterThan(
        regionBox.x + regionBox.width / 2
    )
}

const todayMarkX = (page: Page) =>
    page.locator('[data-today]').evaluate((el) => el.getBoundingClientRect().x)

async function expectAxisSpansRegion(page: Page) {
    const region = (await timelineRegion(page).boundingBox())!
    const line = (await page.locator('[data-axis-line]').boundingBox())!
    expect(line.x).toBeCloseTo(region.x, 0)
    expect(line.x + line.width).toBeCloseTo(region.x + region.width, 0)
}

async function expectHeuteInsideRegion(page: Page) {
    const region = (await timelineRegion(page).boundingBox())!
    const label = (await page
        .getByText('Heute', { exact: true })
        .boundingBox())!
    expect(label.x).toBeGreaterThanOrEqual(region.x)
    expect(label.x + label.width).toBeLessThanOrEqual(region.x + region.width)
}

test('the axis line reaches the right edge and "Heute" stays inside', async ({
    page,
}) => {
    await openTimeline(page)
    await expectAxisSpansRegion(page)
    await expectHeuteInsideRegion(page)

    await zoomInAndPanToEnd(page)

    await expectAxisSpansRegion(page)
    await expectHeuteInsideRegion(page)
})

test('ticks after today look like ticks before it', async ({ page }) => {
    await openTimeline(page)
    await zoomInAndPanToEnd(page)
    const todayX = await todayMarkX(page)
    const ticks = await page.locator('[data-tick]').evaluateAll((els) =>
        els.map((el) => ({
            x: el.getBoundingClientRect().x,
            markClass: el.firstElementChild!.className,
        }))
    )
    const markClassesBefore = ticks
        .filter((tick) => tick.x < todayX)
        .map((tick) => tick.markClass)
    const ticksAfter = ticks.filter((tick) => tick.x > todayX)
    expect(ticksAfter.length).toBeGreaterThan(0)
    for (const tick of ticksAfter)
        expect(markClassesBefore).toContain(tick.markClass)
})
