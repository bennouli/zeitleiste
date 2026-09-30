import { expect, test, type Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { openTimeline } from './timeline'
import { families, firstFamily, webFontFamily } from './webFont'

const POST_PATH = '/de/post/oktoberrevolution'

const PAGES = ['/de', '/en', POST_PATH] as const

const FONT_DELAY_MS = 1000

/** The fallback matches average glyph width, not line breaks: a paragraph near a line boundary may reflow by one line (0.0027 at a 22 px italic lead). A tenth of Lighthouse's "good" 0.1. */
const MAX_FONT_LAYOUT_SHIFT = 0.01

/** How long to wait for a buffered layout-shift entry before counting none. */
const SHIFT_OBSERVE_MS = 500

const SERIF = {
    variables: ['--font-eb-garamond'],
    selectors: ['[data-entry-id] .font-serif'],
}
const SANS = {
    variables: ['--font-google-sans-cyrillic', '--font-google-sans'],
    selectors: ['body', '[data-tick] span', '[data-top-bar] p'],
}
const SERIF_ITALIC = {
    variables: ['--font-eb-garamond-italic'],
    selectors: ['.font-serif-italic'],
}

const FONTS_BY_PAGE = [
    { path: '/de', fonts: [SERIF, SANS] },
    { path: '/en', fonts: [SANS] },
    { path: POST_PATH, fonts: [SERIF, SANS, SERIF_ITALIC] },
] as const

const GOOGLE_FONTS_HOST = /^https?:\/\/fonts\.(googleapis|gstatic)\.com\//

const CYRILLIC_SAMPLE = 'линия'

const CYRILLIC_WORDMARK_FILE = readFileSync(
    new URL(
        '../src/fonts/google-sans/google-sans-cyrillic-500-normal.woff2',
        import.meta.url
    )
)

const isForeignFontRequest = (request: Request, origin: string) =>
    GOOGLE_FONTS_HOST.test(request.url()) ||
    (request.resourceType() === 'font' &&
        new URL(request.url()).origin !== origin)

for (const { path, fonts } of FONTS_BY_PAGE) {
    test(`${path} renders its text in the web fonts`, async ({ page }) => {
        await openTimeline(page, path)
        await page.evaluate(() => document.fonts.ready)
        for (const { variables, selectors } of fonts) {
            const stack = await Promise.all(
                variables.map((variable) => webFontFamily(page, variable))
            )
            const textFamily = stack.at(-1)
            for (const selector of selectors) {
                const renderedFace = await page
                    .locator(selector)
                    .first()
                    .evaluate((el) => {
                        const style = getComputedStyle(el)
                        return {
                            fontFamily: style.fontFamily,
                            fontStyle: style.fontStyle,
                            fontWeight: style.fontWeight,
                        }
                    })
                const loadedFaces = await page.evaluate(() =>
                    [...document.fonts]
                        .filter((f) => f.status === 'loaded')
                        .map((f) => ({ family: f.family, style: f.style }))
                )
                const faceReady = await page.evaluate(
                    ({ fontStyle, fontWeight, family }) =>
                        document.fonts.check(
                            `${fontStyle} ${fontWeight} 12px "${family}"`
                        ),
                    { ...renderedFace, family: textFamily }
                )
                expect(
                    families(renderedFace.fontFamily).slice(0, stack.length)
                ).toEqual(stack)
                expect(
                    loadedFaces.some(
                        (f) =>
                            firstFamily(f.family) === textFamily &&
                            f.style === renderedFace.fontStyle
                    )
                ).toBe(true)
                expect(faceReady).toBe(true)
            }
        }
    })
}

for (const path of PAGES) {
    test(`${path} requests no font from another origin`, async ({ page }) => {
        const requests: Request[] = []
        page.on('request', (request) => requests.push(request))
        await openTimeline(page, path)
        await page.evaluate(() => document.fonts.ready)
        const origin = new URL(page.url()).origin
        expect(
            requests
                .filter((request) => isForeignFontRequest(request, origin))
                .map((request) => request.url())
        ).toEqual([])
    })
}

test('the Cyrillic face of the wordmark is preloaded', async ({ page }) => {
    await openTimeline(page, '/de')
    const preloadedFonts = await page
        .locator('link[rel="preload"][as="font"]')
        .evaluateAll((links) => links.map((l) => (l as HTMLLinkElement).href))
    const preloadedBytes = await Promise.all(
        preloadedFonts.map(async (href) =>
            (await page.request.get(href)).body()
        )
    )
    const cyrillicFamily = await webFontFamily(
        page,
        '--font-google-sans-cyrillic'
    )

    const cyrillicFaceReady = await page.evaluate(
        ({ family, text }) =>
            document.fonts.check(`500 13px "${family}"`, text),
        { family: cyrillicFamily, text: CYRILLIC_SAMPLE }
    )

    expect(
        preloadedBytes.some((bytes) => bytes.equals(CYRILLIC_WORDMARK_FILE))
    ).toBe(true)
    expect(cyrillicFaceReady).toBe(true)
})

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
