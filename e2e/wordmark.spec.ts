import { expect, test, type Page } from '@playwright/test'
import { messages } from '../src/i18n/messages'
import { sampleEntry } from '../src/test/entries'
import { openTimeline, timelineRegion } from './timeline'

type SampledFrame = { text: string; switchX: number; t: number }

type RecordingWindow = typeof window & { wordmarkFrames: SampledFrame[] }

const BRAND = messages.de.site.name
const CYRILLIC = 'линия'
const HAS_CYRILLIC = /[Ѐ-ӿ]/
const TYPING_MS = 1500
/** Three frames at 60 Hz: the step due at 1500 ms paints on the next frame, and the sampler records it on the frame after. */
const FRAME_SLACK_MS = 50
const POST_ENTRY = sampleEntry('kubakrise')

/** From the first frame on, records every change of the wordmark's visible text and of the language switch's x position. */
function recordWordmarkFrames() {
    const frames: SampledFrame[] = []
    Object.assign(window, { wordmarkFrames: frames })
    const isShown = (el: Element) =>
        el.checkVisibility({ visibilityProperty: true })
    const sample = () => {
        const wordmark = document.querySelector('[data-wordmark]')
        const languageSwitch = document.querySelector('[data-top-bar] a')
        if (wordmark && languageSwitch) {
            const text = [...wordmark.children]
                .filter(isShown)
                .map((el) => el.textContent)
                .join('')
            const switchX = languageSwitch.getBoundingClientRect().x
            const lastFrame = frames.at(-1)
            if (lastFrame?.text !== text || lastFrame.switchX !== switchX)
                frames.push({
                    text,
                    switchX,
                    t: performance.now(),
                })
        }
        requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
}

const wordmarkFrames = (page: Page) =>
    page.evaluate(() => (window as RecordingWindow).wordmarkFrames)

const firstPaintMs = (page: Page) =>
    page.evaluate(
        () =>
            performance.getEntriesByName('first-contentful-paint')[0]!.startTime
    )

async function waitForTypingEnd(page: Page) {
    await expect
        .poll(async () => (await wordmarkFrames(page)).at(-1)?.text)
        .toBe(BRAND)
    await expect(page.locator('[data-wordmark-typing]')).toHaveCount(0)
}

const wordmark = (page: Page) => timelineRegion(page).locator('[data-wordmark]')

test.beforeEach(async ({ page }) => {
    await page.addInitScript(recordWordmarkFrames)
})

test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' })

    for (const path of ['/de', '/en']) {
        test(`${path} shows «линия» first and ends on "${BRAND}" within 1.5 s`, async ({
            page,
        }) => {
            await openTimeline(page, path)
            await waitForTypingEnd(page)

            const frames = await wordmarkFrames(page)
            const paintedAt = await firstPaintMs(page)
            const endedAt = frames.find((f) => f.text === BRAND)!.t

            expect(frames[0]?.text).toBe(CYRILLIC)
            expect(endedAt - paintedAt).toBeLessThan(TYPING_MS + FRAME_SLACK_MS)
            expect(endedAt - paintedAt).toBeGreaterThan(
                TYPING_MS - FRAME_SLACK_MS
            )
        })
    }

    test('the letters are replaced left to right, one per step', async ({
        page,
    }) => {
        await openTimeline(page)
        await waitForTypingEnd(page)

        const texts = (await wordmarkFrames(page)).map((f) => f.text)

        expect([...new Set(texts)]).toEqual([
            'линия',
            'lиния',
            'liния',
            'linия',
            'liniя',
            'liniya',
        ])
    })

    test('the language switch does not move while the wordmark types', async ({
        page,
    }) => {
        await openTimeline(page)
        await waitForTypingEnd(page)

        const switchXs = (await wordmarkFrames(page)).map((f) => f.switchX)

        expect(new Set(switchXs).size).toBe(1)
    })

    test(`the page exposes no Cyrillic while the wordmark types, and its heading names "${BRAND}"`, async ({
        page,
    }) => {
        await openTimeline(page)
        const main = page.getByRole('main')
        await expect(wordmark(page)).toBeVisible()
        const treeWhileTyping = await main.ariaSnapshot()
        await waitForTypingEnd(page)
        const treeAfterTyping = await main.ariaSnapshot()

        expect(treeWhileTyping).not.toMatch(HAS_CYRILLIC)
        expect(treeAfterTyping).not.toMatch(HAS_CYRILLIC)
        await expect(
            page.getByRole('heading', { level: 1, name: new RegExp(BRAND) })
        ).toBeAttached()
    })

    test('opening a post and switching language do not replay it; a reload does', async ({
        page,
    }) => {
        await openTimeline(page)
        await waitForTypingEnd(page)
        await page.evaluate(
            () => ((window as RecordingWindow).wordmarkFrames.length = 0)
        )

        await page
            .getByRole('button', {
                name: new RegExp(`^${POST_ENTRY.title},`),
            })
            .getByText('Beitrag')
            .click()
        await expect(page).toHaveURL(new RegExp(`/de/post/${POST_ENTRY.id}$`))
        await page.getByRole('link', { name: 'English' }).click()
        await expect(page).toHaveURL(new RegExp(`/en/post/${POST_ENTRY.id}$`))
        await expect(wordmark(page)).toBeVisible()
        const framesAfterNavigation = await wordmarkFrames(page)
        await page.reload()
        await expect(wordmark(page)).toBeVisible()
        const framesAfterReload = await wordmarkFrames(page)

        expect(
            framesAfterNavigation.filter((f) => HAS_CYRILLIC.test(f.text))
        ).toEqual([])
        expect(framesAfterReload[0]?.text).toBe(CYRILLIC)
    })
})

test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test(`the wordmark reads "${BRAND}" from the first frame, with no Cyrillic`, async ({
        page,
    }) => {
        await openTimeline(page)
        await expect(page.locator('[data-wordmark-typing]')).toHaveCount(0)

        const texts = (await wordmarkFrames(page)).map((f) => f.text)

        expect(texts[0]).toBe(BRAND)
        expect(texts.filter((text) => HAS_CYRILLIC.test(text))).toEqual([])
    })
})

test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' })

    test(`the wordmark reads "${BRAND}" with no Cyrillic frame`, async ({
        page,
    }) => {
        await page.goto('/de')

        await expect(
            wordmark(page).getByText(BRAND, { exact: true })
        ).toBeVisible()
        await expect(page.locator('[data-wordmark-typing]')).toBeHidden()
    })
})
