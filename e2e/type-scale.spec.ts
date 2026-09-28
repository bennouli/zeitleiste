import { expect, test, type Locator } from '@playwright/test'
import { openTimeline } from './timeline'

const DESKTOP = { width: 1920, height: 1080 }

test.use({ viewport: DESKTOP })

const fontSize = (el: Locator) =>
    el.evaluate((node) => getComputedStyle(node).fontSize)

test('tick labels, "Heute" and date lines are 12 px, entry titles 20 px', async ({
    page,
}) => {
    await openTimeline(page)
    const tickLabel = page.locator('[data-tick] span').first()
    const todayLabel = page.locator('[data-today] span')
    const card = page.locator('[data-entry-id]').first()
    const entryTitle = card.locator('.text-entry')
    const dateLine = card.locator('.tracking-date')

    expect(await fontSize(tickLabel)).toBe('12px')
    expect(await fontSize(todayLabel)).toBe('12px')
    expect(await fontSize(dateLine)).toBe('12px')
    expect(await fontSize(entryTitle)).toBe('20px')
})
