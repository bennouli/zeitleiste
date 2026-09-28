import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openTimeline } from './timeline'

const VIEWPORT = { width: 1280, height: 800 }

const CURSOR_OFFSET_PX = 14

test.use({ viewport: VIEWPORT })

/** Room right of and below a card for a 320 px note, so it follows the cursor unclamped. */
const NOTE_ROOM_PX = 400

type Box = { x: number; y: number }

const isRoomy = ({ x, y }: Box) =>
    x > 0 &&
    y > 0 &&
    x + NOTE_ROOM_PX < VIEWPORT.width &&
    y + NOTE_ROOM_PX / 2 < VIEWPORT.height

async function entryInView(page: Page) {
    for (const card of await page
        .locator('[data-layer="points"] [aria-describedby]')
        .all()) {
        const box = await card.boundingBox()
        if (box && isRoomy(box)) return card
    }
    throw new Error('no entry card inside the viewport')
}

const noteBox = async (page: Page) =>
    (await page.getByRole('tooltip').boundingBox())!

test('the hover note follows the mouse 14 px right and below and stays in the viewport', async ({
    page,
}) => {
    await openTimeline(page)
    const entry = await entryInView(page)
    const entryBox = (await entry.boundingBox())!
    const start = { x: entryBox.x + 4, y: entryBox.y + 4 }
    const moved = { x: start.x + 20, y: start.y + 6 }

    await page.mouse.move(start.x, start.y)
    await expect(page.getByRole('tooltip')).toBeVisible()
    await expect
        .poll(async () => (await noteBox(page)).x)
        .toBeCloseTo(start.x + CURSOR_OFFSET_PX, 0)
    await page.mouse.move(moved.x, moved.y)

    await expect
        .poll(async () => (await noteBox(page)).x)
        .toBeCloseTo(moved.x + CURSOR_OFFSET_PX, 0)
    const box = await noteBox(page)
    expect(box.y).toBeCloseTo(moved.y + CURSOR_OFFSET_PX, 0)
    expect(box.x + box.width).toBeLessThanOrEqual(VIEWPORT.width)
    expect(box.y + box.height).toBeLessThanOrEqual(VIEWPORT.height)
})

test('an open hover note resolves aria-describedby and has no axe violations', async ({
    page,
}) => {
    await openTimeline(page)
    const entry = await entryInView(page)
    await entry.hover()
    const note = page.getByRole('tooltip')
    await expect(note).toBeVisible()
    await expect(note).toHaveId((await entry.getAttribute('aria-describedby'))!)

    const { violations } = await new AxeBuilder({ page }).analyze()

    expect(
        violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target.join(' ')),
        }))
    ).toEqual([])
})
