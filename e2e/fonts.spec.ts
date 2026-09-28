import { expect, test } from '@playwright/test'
import { openTimeline } from './timeline'

const POST_PATH = '/post/oktoberrevolution'

const PAGES = ['/', POST_PATH] as const

const FONT_DELAY_MS = 1000

/** A subpixel line-height nudge where the fallback font is not the one next/font measured; a column changing width scores 0.008. */
const MAX_FONT_LAYOUT_SHIFT = 0.001

/** How long to wait for a buffered layout-shift entry before counting none. */
const SHIFT_OBSERVE_MS = 500

const SERIF = { family: 'ebGaramond', selector: '[data-entry-id] .font-serif' }
const SANS = { family: 'ibmPlexSans', selector: 'body' }
const SERIF_ITALIC = {
    family: 'ebGaramondItalic',
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
        for (const { family, selector } of fonts) {
            const rendered = await page
                .locator(selector)
                .first()
                .evaluate((el) => {
                    const style = getComputedStyle(el)
                    const unquote = (name: string) =>
                        name.trim().replace(/['"]/g, '')
                    const firstFamily = unquote(
                        style.fontFamily.split(',')[0] ?? ''
                    )
                    const loaded = [...document.fonts].some(
                        (f) =>
                            f.status === 'loaded' &&
                            unquote(f.family) === firstFamily &&
                            f.style === style.fontStyle
                    )
                    return { firstFamily, loaded }
                })
            expect(rendered).toEqual({ firstFamily: family, loaded: true })
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
