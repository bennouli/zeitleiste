import { expect, test } from '@playwright/test'
import { openTimeline } from './timeline'
import { firstFamily, webFontFamily } from './webFont'

const POST_PATH = '/post/oktoberrevolution'

const PAGES = ['/', POST_PATH] as const

const FONT_DELAY_MS = 1000

/** The fallback matches average glyph width, not line breaks: a paragraph near a line boundary may reflow by one line (0.0027 at a 22 px italic lead). A tenth of Lighthouse's "good" 0.1. */
const MAX_FONT_LAYOUT_SHIFT = 0.01

/** How long to wait for a buffered layout-shift entry before counting none. */
const SHIFT_OBSERVE_MS = 500

const SERIF = {
    variable: '--font-eb-garamond',
    selector: '[data-entry-id] .font-serif',
}
const SANS = { variable: '--font-ibm-plex-sans', selector: 'body' }
const SERIF_ITALIC = {
    variable: '--font-eb-garamond-italic',
    selector: '.font-serif-italic',
}

const FONTS_BY_PAGE = [
    { path: '/', fonts: [SERIF, SANS] },
    { path: POST_PATH, fonts: [SERIF, SANS, SERIF_ITALIC] },
] as const

const GOOGLE_FONTS_HOST = /^https?:\/\/fonts\.(googleapis|gstatic)\.com\//

for (const { path, fonts } of FONTS_BY_PAGE) {
    test(`${path} renders its text in the web fonts`, async ({ page }) => {
        await openTimeline(page, path)
        await page.evaluate(() => document.fonts.ready)
        for (const { variable, selector } of fonts) {
            const family = await webFontFamily(page, variable)
            const renderedFace = await page
                .locator(selector)
                .first()
                .evaluate((el) => {
                    const style = getComputedStyle(el)
                    return {
                        fontFamily: style.fontFamily,
                        fontStyle: style.fontStyle,
                    }
                })
            const loadedFaces = await page.evaluate(() =>
                [...document.fonts]
                    .filter((f) => f.status === 'loaded')
                    .map((f) => ({ family: f.family, style: f.style }))
            )
            expect(firstFamily(renderedFace.fontFamily)).toBe(family)
            expect(
                loadedFaces.some(
                    (f) =>
                        firstFamily(f.family) === family &&
                        f.style === renderedFace.fontStyle
                )
            ).toBe(true)
        }
    })
}

for (const path of PAGES) {
    test(`${path} requests nothing from Google Fonts`, async ({ page }) => {
        const requestedUrls: string[] = []
        page.on('request', (request) => requestedUrls.push(request.url()))
        await openTimeline(page, path)
        await page.evaluate(() => document.fonts.ready)
        expect(
            requestedUrls.filter((url) => GOOGLE_FONTS_HOST.test(url))
        ).toEqual([])
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
