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
                const x = (left + right) / 2
                const y = (top + bottom) / 2
                // elementsFromPoint sees nothing off-screen; nothing is culled, so such crossings exist.
                if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight)
                    return []
                mark.style.pointerEvents = 'auto'
                const stack = document.elementsFromPoint(x, y)
                mark.style.pointerEvents = ''
                return [stack.indexOf(mark) < stack.indexOf(bar)]
            })
        })
    })
    expect(paintOrder.length).toBeGreaterThan(0)
    expect(paintOrder.every(Boolean)).toBe(true)
})

const label = (page: Page, id: string) =>
    page.locator(`[data-layer="cards"] [data-entry-id="${id}"]`)

const viewRange = (page: Page) =>
    timelineRegion(page).evaluate((el) => [
        el.dataset.viewStart,
        el.dataset.viewEnd,
    ])

type ClickableSpan = { id: string; x: number; y: number }

/** A span whose label sits outside its group stack's window, and a point where its bar takes the click. */
const spanHiddenInStack = (page: Page): Promise<ClickableSpan | undefined> =>
    page.evaluate(() => {
        const bars = [
            ...document.querySelectorAll<HTMLElement>('[data-span-id]'),
        ]
        return bars.flatMap((bar) => {
            const id = bar.dataset.spanId!
            const labelEl = document.querySelector(
                `[data-layer="cards"] [data-entry-id="${CSS.escape(id)}"]`
            )
            if (!labelEl?.closest('[inert]')) return []
            const rect = bar.getBoundingClientRect()
            const y = rect.top + rect.height / 2
            const xs = Array.from(
                { length: Math.floor(rect.width) },
                (_, i) => rect.left + i + 0.5
            ).filter((x) => x >= 0 && x < innerWidth)
            const x = xs.find((x) => document.elementFromPoint(x, y) === bar)
            return x === undefined ? [] : [{ id, x, y }]
        })[0]
    })

test('clicking a bar rings its title for about a second, without zooming or panning', async ({
    page,
}) => {
    await openTimeline(page)
    const title = label(page, FINISHED_SPAN)
    await expect(title).toBeInViewport()
    const viewBefore = await viewRange(page)

    await bar(page, FINISHED_SPAN).click()
    const clickedAt = Date.now()

    await expect(title).toHaveAttribute('data-bar-highlight', 'on')
    await expect
        .poll(() => title.getAttribute('data-bar-highlight'), {
            intervals: [50],
            timeout: 3000,
        })
        .toBeNull()
    const litMs = Date.now() - clickedAt
    expect(litMs).toBeGreaterThanOrEqual(900)
    expect(litMs).toBeLessThan(2000)
    expect(await viewRange(page)).toEqual(viewBefore)
    await expect(page.locator('article')).toHaveCount(0)
})

test('clicking the bar of a span hidden in a group stack steps the stack to it and rings it', async ({
    page,
}) => {
    await openTimeline(page)
    const hiddenSpan = await spanHiddenInStack(page)
    if (!hiddenSpan)
        throw new Error('no span hidden in a stack at this viewport')
    const title = label(page, hiddenSpan.id)
    const isInert = () => title.evaluate((el) => !!el.closest('[inert]'))
    expect(await isInert()).toBe(true)

    await page.mouse.click(hiddenSpan.x, hiddenSpan.y)

    await expect(title).toHaveAttribute('data-bar-highlight', 'on')
    expect(await isInert()).toBe(false)
    await expect(title).toBeInViewport()
})

test('a drag that starts on a bar pans without ringing the title', async ({
    page,
}) => {
    await openTimeline(page)
    const box = await bar(page, FINISHED_SPAN).boundingBox()
    if (!box) throw new Error('no bar')
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const viewBefore = await viewRange(page)

    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 40, start.y, { steps: 5 })
    await page.mouse.up()

    expect(await viewRange(page)).not.toEqual(viewBefore)
    await expect(label(page, FINISHED_SPAN)).not.toHaveAttribute(
        'data-bar-highlight',
        /.*/
    )
})

test('clicking a bar whose title is off screen pans the title into view', async ({
    page,
}) => {
    await openTimeline(page)
    for (let zoomStep = 0; zoomStep < 3; zoomStep++) await zoomIn(page)
    const box = await bar(page, FINISHED_SPAN).boundingBox()
    if (!box) throw new Error('no bar')
    const dragFrom = { x: 640, y: 780 }
    await page.mouse.move(dragFrom.x, dragFrom.y)
    await page.mouse.down()
    await page.mouse.move(dragFrom.x - 100 - box.x, dragFrom.y, { steps: 10 })
    await page.mouse.up()
    const title = label(page, FINISHED_SPAN)
    await expect(title).not.toBeInViewport()
    const shiftedBar = await bar(page, FINISHED_SPAN).boundingBox()

    await page.mouse.click(
        shiftedBar!.x + 150,
        shiftedBar!.y + shiftedBar!.height / 2
    )

    await expect(title).toHaveAttribute('data-bar-highlight', 'on')
    await expect(title).toBeInViewport()
})
