import { expect, test, type Page } from '@playwright/test'
import { openTimeline, timelineRegion } from './timeline'

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })

const view = async (page: Page) => {
    const region = timelineRegion(page)
    const start = Number(await region.getAttribute('data-view-start'))
    const end = Number(await region.getAttribute('data-view-end'))
    return { start, end, span: end - start }
}

/** Makes the page taller than the window, so an unprevented wheel would scroll it. */
const makePageScrollable = (page: Page) =>
    page.evaluate(() => {
        const filler = document.createElement('div')
        filler.style.height = '200vh'
        document.body.append(filler)
    })

test('wheel over the timeline zooms in and out and does not scroll the page', async ({
    page,
}) => {
    await openTimeline(page)
    await makePageScrollable(page)
    const box = (await timelineRegion(page).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const before = await view(page)

    await page.mouse.wheel(0, -300)

    await expect
        .poll(async () => (await view(page)).span)
        .toBeLessThan(before.span)
    const zoomedIn = await view(page)
    await page.mouse.wheel(0, 300)
    await expect
        .poll(async () => (await view(page)).span)
        .toBeGreaterThan(zoomedIn.span)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('Ctrl + wheel over the timeline is left to the browser', async ({
    page,
}) => {
    await openTimeline(page)
    const region = timelineRegion(page)
    const box = (await region.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const prevented = region.evaluate(
        (el) =>
            new Promise<boolean>((resolve) =>
                el.addEventListener(
                    'wheel',
                    (e) => setTimeout(() => resolve(e.defaultPrevented)),
                    { once: true }
                )
            )
    )

    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -100)
    await page.keyboard.up('Control')

    expect(await prevented).toBe(false)
})
