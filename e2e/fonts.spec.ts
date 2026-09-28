import { expect, test } from '@playwright/test'
import { openTimeline } from './timeline'

const POST_PATH = '/post/oktoberrevolution'

const PAGES = ['/', POST_PATH] as const

const FONT_DELAY_MS = 1000

/** A subpixel line-height nudge where the fallback font is not the one next/font measured; a column changing width scores 0.008. */
const MAX_FONT_LAYOUT_SHIFT = 0.001

/** How long to wait for a buffered layout-shift entry before counting none. */
const SHIFT_OBSERVE_MS = 500

const FONTS = [
    {
        family: /^['"]?EB Garamond['"]?$/,
        selector: '[data-entry-id] .font-serif',
    },
    { family: /^['"]?IBM Plex Sans['"]?$/, selector: 'body' },
] as const

for (const path of PAGES) {
    test(`${path} renders EB Garamond and IBM Plex Sans`, async ({ page }) => {
        await openTimeline(page, path)
        await page.evaluate(() => document.fonts.ready)
        for (const { family, selector } of FONTS) {
            const renderedFamilies = await page
                .locator(selector)
                .first()
                .evaluate((el) => {
                    const style = getComputedStyle(el)
                    const loadedFaces = [...document.fonts].filter(
                        (f) =>
                            f.status === 'loaded' &&
                            style.fontFamily.includes(
                                f.family.replace(/['"]/g, '')
                            )
                    )
                    return loadedFaces.map((f) => f.family)
                })
            expect(renderedFamilies.some((f) => family.test(f))).toBe(true)
        }
    })
}

test('the post page does not shift layout when the fonts arrive', async ({
    page,
}) => {
    await page.route(/\.woff2$/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, FONT_DELAY_MS))
        await route.continue()
    })
    await openTimeline(page, POST_PATH)
    await page.evaluate(() => document.fonts.ready)
    const fontShift = await page.evaluate(
        (observeMs) =>
            new Promise<number>((resolve) => {
                const fontsArrivedAt = Math.min(
                    ...performance
                        .getEntriesByType('resource')
                        .filter((e) => e.name.endsWith('.woff2'))
                        .map(
                            (e) => (e as PerformanceResourceTiming).responseEnd
                        )
                )
                if (!Number.isFinite(fontsArrivedAt))
                    throw new Error('no web font was requested')
                const sumShiftAfterFonts = (entries: PerformanceEntryList) =>
                    entries
                        .filter((e) => e.startTime >= fontsArrivedAt)
                        .reduce(
                            (sum, e) =>
                                sum + (e as unknown as { value: number }).value,
                            0
                        )
                new PerformanceObserver((list) =>
                    resolve(sumShiftAfterFonts(list.getEntries()))
                ).observe({ type: 'layout-shift', buffered: true })
                setTimeout(() => resolve(0), observeMs)
            }),
        SHIFT_OBSERVE_MS
    )
    expect(fontShift).toBeLessThan(MAX_FONT_LAYOUT_SHIFT)
})
