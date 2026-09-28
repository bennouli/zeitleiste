import { expect, test, type Locator, type Page } from '@playwright/test'
import { sampleEntry } from '../src/test/entries'
import { openTimeline, timelineRegion } from './timeline'

const POST_ENTRY = sampleEntry('oktoberrevolution')
const POST_PATH = `/post/${POST_ENTRY.id}`
const FIRST_BODY_PARAGRAPH_START = /^Im Herbst 1917/
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
    const lead = article.getByText(POST_ENTRY.summary)
    const body = article.getByText(FIRST_BODY_PARAGRAPH_START)

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
    const bodyWidth = await body.evaluate(
        (el) => el.getBoundingClientRect().width
    )
    expect(bodyWidth).toBeLessThanOrEqual(MAX_COLUMN_PX)
})

const collapseTransition = (page: Page) =>
    timelineRegion(page).evaluate((el) => {
        const style = getComputedStyle(el)
        return {
            property: style.transitionProperty,
            duration: style.transitionDuration,
            easing: style.transitionTimingFunction,
        }
    })

test('the timeline collapse transitions its height over 500 ms, ease-in-out', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openTimeline(page, POST_PATH)
    expect(await collapseTransition(page)).toEqual({
        property: 'height',
        duration: '0.5s',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    })
})

test('the timeline collapse does not transition with reduced motion', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openTimeline(page, POST_PATH)
    expect((await collapseTransition(page)).property).toBe('none')
})
