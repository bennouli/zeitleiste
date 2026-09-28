import { expect, test, type Locator } from '@playwright/test'
import { openTimeline, timelineRegion } from './timeline'

const POST_PATH = '/post/oktoberrevolution'
const DESKTOP = { width: 1920, height: 1080 }
const MAX_COLUMN_PX = 660

type Typeface = { family: string; size: string; style: string }

function typeface(el: Locator): Promise<Typeface> {
    return el.evaluate((node) => {
        const style = getComputedStyle(node)
        return {
            family: style.fontFamily,
            size: style.fontSize,
            style: style.fontStyle,
        }
    })
}

test.use({ viewport: DESKTOP })

test('title, lead and body are set in the serif at their sizes; the column stays within 660 px', async ({
    page,
}) => {
    await openTimeline(page, POST_PATH)
    const article = page.getByRole('article')
    const title = article.getByRole('heading', { level: 2 })
    const column = title.locator('..')
    const lead = column.locator('> p').nth(1)
    const body = column.locator('> p').nth(2)

    expect(await typeface(title)).toMatchObject({
        family: expect.stringContaining('EB Garamond'),
        size: '44px',
        style: 'normal',
    })
    expect(await typeface(lead)).toMatchObject({
        family: expect.stringContaining('EB Garamond'),
        size: '20px',
        style: 'italic',
    })
    expect(await typeface(body)).toMatchObject({
        family: expect.stringContaining('EB Garamond'),
        size: '16.5px',
        style: 'normal',
    })
    const columnBox = await column.boundingBox()
    expect(columnBox!.width).toBeLessThanOrEqual(MAX_COLUMN_PX)
})

for (const [reducedMotion, transitionProperty] of [
    ['no-preference', 'height'],
    ['reduce', 'none'],
] as const) {
    test(`the timeline collapse transitions "${transitionProperty}" with reduced motion "${reducedMotion}"`, async ({
        page,
    }) => {
        await page.emulateMedia({ reducedMotion })
        await openTimeline(page, POST_PATH)
        const transition = await timelineRegion(page).evaluate((el) => {
            const style = getComputedStyle(el)
            return {
                property: style.transitionProperty,
                duration: style.transitionDuration,
                easing: style.transitionTimingFunction,
            }
        })
        expect(transition).toEqual({
            property: transitionProperty,
            duration: '0.5s',
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        })
    })
}
