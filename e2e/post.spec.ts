import { expect, test, type Locator, type Page } from '@playwright/test'
import { sampleEntry } from '../src/test/entries'
import { openTimeline, timelineRegion } from './timeline'
import { firstFamily, webFontFamily } from './webFont'

const POST_ENTRY = sampleEntry('oktoberrevolution')
const SPAN_WITH_POST = sampleEntry('kubakrise')
const POST_PATH = `/post/${POST_ENTRY.id}`
const FIRST_BODY_PARAGRAPH_START = /^Im Herbst 1917/
const BODY_PARAGRAPHS = 4
const DESKTOP = { width: 1920, height: 1080 }
const MAX_COLUMN_PX = 660

type Typeface = { family: string; size: string; style: string }

async function typeface(el: Locator): Promise<Typeface> {
    const computed = await el.evaluate((node) => {
        const style = getComputedStyle(node)
        return {
            family: style.fontFamily,
            size: style.fontSize,
            style: style.fontStyle,
        }
    })
    return { ...computed, family: firstFamily(computed.family) }
}

test.use({ viewport: DESKTOP })

test("title, lead and the body's four paragraphs are set in the serif at their sizes; the column stays within 660 px", async ({
    page,
}) => {
    await openTimeline(page, POST_PATH)
    const article = page.getByRole('article')
    const title = article.getByRole('heading', { level: 2 })
    const lead = article.getByText(POST_ENTRY.summary)
    const body = article.getByText(FIRST_BODY_PARAGRAPH_START)
    const serif = await webFontFamily(page, '--font-eb-garamond')
    const serifItalic = await webFontFamily(page, '--font-eb-garamond-italic')

    expect(await typeface(title)).toMatchObject({
        family: serif,
        size: '44px',
        style: 'normal',
    })
    expect(await typeface(lead)).toMatchObject({
        family: serifItalic,
        size: '22px',
        style: 'italic',
    })
    expect(await typeface(body)).toMatchObject({
        family: serif,
        size: '18px',
        style: 'normal',
    })
    await expect(article.locator('p.text-body')).toHaveCount(BODY_PARAGRAPHS)
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

test('"Beitrag" on a span\'s label opens its post', async ({ page }) => {
    await openTimeline(page)
    const label = page.getByRole('button', {
        name: new RegExp(`^${SPAN_WITH_POST.title},`),
    })
    await label.getByText('Beitrag').click()
    await expect(page).toHaveURL(new RegExp(`/post/${SPAN_WITH_POST.id}$`))
    await expect(
        page.getByRole('article').getByRole('heading', { level: 2 })
    ).toHaveText(SPAN_WITH_POST.title)
})
