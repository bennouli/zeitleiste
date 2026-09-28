import { expect, test, type Page } from '@playwright/test'
import { openTimeline, timelineRegion } from './timeline'

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })

type Box = { x: number; y: number; width: number; height: number }

const ONGOING_SPAN = 'russischer-angriffskrieg-gegen-die-ukraine'
const FINISHED_SPAN = 'kalter-krieg'
const SPAN_WITH_POST = 'kubakrise'

const bar = (page: Page, id: string) => page.locator(`[data-span-id="${id}"]`)

const barBoxes = (page: Page): Promise<Box[]> =>
    page
        .locator('[data-span-id]')
        .evaluateAll((els) =>
            els.map((el) => el.getBoundingClientRect().toJSON() as Box)
        )

async function axisLineBox(page: Page): Promise<Box> {
    const box = await page.locator('[data-axis-line]').boundingBox()
    if (!box) throw new Error('no axis line')
    return box
}

const zoomIn = (page: Page) =>
    page.getByRole('button', { name: 'Hineinzoomen', exact: true }).click()

test('spans lie on the axis at every zoom; nothing is reserved below it', async ({
    page,
}) => {
    await openTimeline(page)
    const region = await timelineRegion(page).boundingBox()
    const below = await page.locator('[data-layer="below"]').boundingBox()
    expect(below!.y + below!.height).toBeCloseTo(region!.y + region!.height, 0)

    for (let zoomStep = 0; zoomStep < 3; zoomStep++) {
        const axis = await axisLineBox(page)
        const axisCentre = axis.y + axis.height / 2
        const boxes = await barBoxes(page)
        const onAxis = boxes.filter((b) => b.height === 7)
        expect(onAxis.length).toBeGreaterThan(0)
        for (const b of onAxis) expect(b.y + b.height / 2).toBe(axisCentre)
        for (const b of boxes) {
            expect(b.y).toBeGreaterThanOrEqual(axisCentre - 3.5)
            expect(b.y).toBeLessThan(axis.y + 60)
        }
        await zoomIn(page)
    }
})

test('overlapping spans occupy separate lanes without touching', async ({
    page,
}) => {
    await openTimeline(page)
    const boxes = await barBoxes(page)
    const overlapInX = (a: Box, b: Box) =>
        a.x < b.x + b.width && b.x < a.x + a.width
    const apartInY = (a: Box, b: Box) =>
        a.y + a.height < b.y || b.y + b.height < a.y
    const touching = boxes.flatMap((a, i) =>
        boxes.slice(i + 1).filter((b) => overlapInX(a, b) && !apartInY(a, b))
    )
    expect(new Set(boxes.map((b) => b.y)).size).toBeGreaterThan(1)
    expect(touching).toEqual([])
})

test('an ongoing span fades towards today; a finished one is solid', async ({
    page,
}) => {
    await openTimeline(page)
    const backgroundImage = (id: string) =>
        bar(page, id).evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(await backgroundImage(ONGOING_SPAN)).toMatch(
        /^linear-gradient\(to right, .+ 60%, .+\)$/
    )
    expect(await backgroundImage(FINISHED_SPAN)).toBe('none')
    const restingGradient = await backgroundImage(ONGOING_SPAN)
    await bar(page, ONGOING_SPAN).hover()
    expect(await backgroundImage(ONGOING_SPAN)).not.toBe(restingGradient)
    const ongoing = await bar(page, ONGOING_SPAN).boundingBox()
    const todayX = await page
        .locator('[data-today]')
        .evaluate((el) => el.getBoundingClientRect().x)
    expect(ongoing!.x + ongoing!.width).toBeCloseTo(todayX, 0)
})

test('hovering a span strengthens it and shows its hover note; clicking it opens no post', async ({
    page,
}) => {
    await openTimeline(page)
    const spanBar = bar(page, SPAN_WITH_POST)
    const backgroundColor = () =>
        spanBar.evaluate((el) => getComputedStyle(el).backgroundColor)
    const restingColor = await backgroundColor()
    await spanBar.hover()
    expect(await backgroundColor()).not.toBe(restingColor)
    await expect(page.getByRole('tooltip')).toContainText('Kubakrise')
    const urlBefore = page.url()
    await spanBar.click()
    await expect(page.locator('article')).toHaveCount(0)
    expect(page.url()).toBe(urlBefore)
})

test('keyboard focus strengthens a span like hover does', async ({ page }) => {
    await openTimeline(page)
    const spanBar = bar(page, FINISHED_SPAN)
    const backgroundColor = () =>
        spanBar.evaluate((el) => getComputedStyle(el).backgroundColor)
    const restingColor = await backgroundColor()
    await page.keyboard.press('Tab')
    await spanBar.focus()
    await expect(spanBar).toBeFocused()
    expect(await spanBar.evaluate((el) => el.matches(':focus-visible'))).toBe(
        true
    )
    expect(await backgroundColor()).not.toBe(restingColor)
})

test('bars paint behind the dots and connectors that cross them', async ({
    page,
}) => {
    await openTimeline(page)
    const paintOrder = await page.evaluate(() => {
        const marks = [
            ...document.querySelectorAll<HTMLElement>(
                '[data-axis-dot], [data-connector]'
            ),
        ]
        const bars = [
            ...document.querySelectorAll<HTMLElement>('[data-span-id]'),
        ]
        return marks.flatMap((mark) => {
            const m = mark.getBoundingClientRect()
            return bars.flatMap((bar) => {
                const b = bar.getBoundingClientRect()
                const left = Math.max(m.left, b.left)
                const right = Math.min(m.right, b.right)
                const top = Math.max(m.top, b.top)
                const bottom = Math.min(m.bottom, b.bottom)
                if (right - left < 1 || bottom - top < 1) return []
                mark.style.pointerEvents = 'auto'
                const stack = document.elementsFromPoint(
                    (left + right) / 2,
                    (top + bottom) / 2
                )
                mark.style.pointerEvents = ''
                return [stack.indexOf(mark) < stack.indexOf(bar)]
            })
        })
    })
    expect(paintOrder.length).toBeGreaterThan(0)
    expect(paintOrder.every(Boolean)).toBe(true)
})
