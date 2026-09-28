import { expect, test, type Page } from '@playwright/test'
import { entries } from '../src/data/entries'
import { isSpan } from '../src/lib/entry'
import {
    describeFocus,
    openTimeline,
    tabThrough,
    tabUntil,
    timelineRegion,
    type Focused,
} from './timeline'

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })

const ORDER = new Map(entries.map((e, i) => [e.id, i]))
const SPAN_IDS = entries
    .filter(isSpan)
    .map((e) => e.id)
    .sort()

const view = async (page: Page) => {
    const region = timelineRegion(page)
    const start = Number(await region.getAttribute('data-view-start'))
    const end = Number(await region.getAttribute('data-view-end'))
    return { start, end, span: end - start }
}

test('Tab reaches the region first, then the entries in chronological order', async ({
    page,
}) => {
    await openTimeline(page)
    await page.keyboard.press('Tab')
    await expect(timelineRegion(page)).toBeFocused()

    const firstThree: Focused[] = []
    for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Tab')
        firstThree.push(await describeFocus(page))
    }
    for (const f of firstThree) {
        expect(f.inCards).toBe(true)
        expect(f.ids.length).toBeGreaterThan(0)
    }
    // Chronological per the sample data (which is sorted by start) and by anchor time.
    const firstIndex = firstThree.map((f) =>
        Math.min(...f.ids.map((id) => ORDER.get(id)!))
    )
    expect(firstIndex).toEqual([...firstIndex].sort((a, b) => a - b))
    const times = firstThree.map((f) => f.t!)
    expect(times).toEqual([...times].sort((a, b) => a - b))
})

for (const [label, size] of [
    ['desktop', { width: 1280, height: 800 }],
    ['phone', { width: 390, height: 844 }],
] as const) {
    test(`every entry is reachable with the keyboard, with a visible focus, without scrolling the timeline (${label})`, async ({
        page,
    }) => {
        await page.setViewportSize(size)
        await openTimeline(page)
        const region = timelineRegion(page)
        const labelled = new Set<string>()
        const barred = new Set<string>()
        const cardTimes: number[] = []
        const barTimes: number[] = []
        await page.keyboard.press('Tab')
        for await (const f of tabThrough(page)) {
            if (f.name === 'Hineinzoomen') break
            expect(f.outline, `focus visible on "${f.name}"`).not.toMatch(
                /^none|0px$/
            )
            if (f.role === 'group' && f.name.startsWith('Gruppe mit')) {
                // Step through the stack; each step shows the next entry.
                const stack = page.locator(':focus')
                for (let step = 0; step < f.ids.length; step++) {
                    const shown = await stack
                        .locator('li:not([inert]) [data-entry-id]')
                        .evaluateAll((els) =>
                            els.map(
                                (el) => (el as HTMLElement).dataset.entryId!
                            )
                        )
                    shown.forEach((id) => labelled.add(id))
                    await page.keyboard.press('ArrowDown')
                }
                await page.keyboard.press('Home')
            } else if (f.ids.length === 1) {
                if (f.inCards) labelled.add(f.ids[0]!)
                if (f.inSpans) barred.add(f.ids[0]!)
            }
            if (
                f.inCards &&
                f.t !== null &&
                !f.name.startsWith('Hineinzoomen:')
            )
                cardTimes.push(f.t)
            if (f.inSpans && f.t !== null) barTimes.push(f.t)
        }
        expect([...labelled].sort()).toEqual(entries.map((e) => e.id).sort())
        expect([...barred].sort()).toEqual(SPAN_IDS)
        expect(cardTimes).toEqual([...cardTimes].sort((a, b) => a - b))
        expect(barTimes).toEqual([...barTimes].sort((a, b) => a - b))
        // overflow: clip — focusing off-screen entries never scrolls the timeline box itself.
        expect(
            await region.evaluate((el) => [el.scrollLeft, el.scrollTop])
        ).toEqual([0, 0])
    })
}

test('Enter on a group marker zooms into the group and keeps focus in the timeline (phone)', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openTimeline(page)
    await page.keyboard.press('Tab')
    const marker = await tabUntil(page, (f) =>
        f.name.startsWith('Hineinzoomen: ')
    )
    expect(marker?.name).toMatch(/^Hineinzoomen: /)
    const before = await view(page)
    await page.keyboard.press('Enter')
    await expect
        .poll(async () => (await view(page)).span)
        .toBeLessThan(before.span)
    await expect
        .poll(async () =>
            (await describeFocus(page)).ids.some((id) =>
                marker!.ids.includes(id)
            )
        )
        .toBe(true)
})

test('Enter opens a post, focus lands in it, Escape returns to the start page and the entry', async ({
    page,
}) => {
    await openTimeline(page)
    await page.keyboard.press('Tab')
    const postCard = await tabUntil(
        page,
        (f) => f.name.endsWith(', Beitrag') && f.ids.length === 1
    )
    expect(postCard?.name).toMatch(/, Beitrag$/)
    const id = postCard!.ids[0]!
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/post/${id}$`))
    const heading = page.getByRole('article').getByRole('heading', { level: 2 })
    await expect(heading).toBeFocused()
    await expect(heading).toHaveText(entries.find((e) => e.id === id)!.title)

    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('article')).toHaveCount(0)
    await expect.poll(async () => (await describeFocus(page)).ids).toContain(id)
})

test('+ and - zoom, the arrow keys pan the focused timeline', async ({
    page,
}) => {
    await openTimeline(page)
    await page.keyboard.press('Tab')
    const v0 = await view(page)
    await page.keyboard.press('+')
    await expect.poll(async () => (await view(page)).span).toBeLessThan(v0.span)
    const v1 = await view(page)
    await page.keyboard.press('ArrowLeft')
    await expect
        .poll(async () => (await view(page)).start)
        .toBeLessThan(v1.start)
    const v2 = await view(page)
    await page.keyboard.press('ArrowRight')
    await expect
        .poll(async () => (await view(page)).start)
        .toBeGreaterThan(v2.start)
    const v3 = await view(page)
    await page.keyboard.press('-')
    await expect
        .poll(async () => (await view(page)).span)
        .toBeGreaterThan(v3.span)
})
