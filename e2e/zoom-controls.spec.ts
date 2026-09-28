import { expect, test, type Locator, type Page } from '@playwright/test'
import { openTimeline, tabUntil, timelineRegion } from './timeline'

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })

const TRANSPARENT = 'rgba(0, 0, 0, 0)'

const zoomButton = (page: Page, name: string) =>
    page.getByRole('button', { name, exact: true })

const paint = (button: Locator) =>
    button.evaluate((el) => {
        const style = getComputedStyle(el)
        return {
            background: style.backgroundColor,
            color: style.color,
            border: style.borderTopColor,
        }
    })

test('zoom buttons are outlined circles', async ({ page }) => {
    await openTimeline(page)
    const zoomIn = zoomButton(page, 'Hineinzoomen')
    const shape = await zoomIn.evaluate((el) => {
        const style = getComputedStyle(el)
        const box = el.getBoundingClientRect()
        return {
            width: box.width,
            height: box.height,
            radius: parseFloat(style.borderTopLeftRadius),
            borderWidth: style.borderTopWidth,
            borderStyle: style.borderTopStyle,
            background: style.backgroundColor,
        }
    })
    expect(shape.width).toBe(shape.height)
    expect(shape.radius).toBeGreaterThanOrEqual(shape.width / 2)
    expect(shape.borderWidth).toBe('1px')
    expect(shape.borderStyle).toBe('solid')
    expect(shape.background).toBe(TRANSPARENT)
})

test('zoom buttons invert on hover and keyboard focus, never while disabled', async ({
    page,
}) => {
    await openTimeline(page)
    const region = timelineRegion(page)
    const ink = await region.evaluate((el) => getComputedStyle(el).color)
    const paper = await region.evaluate(
        (el) => getComputedStyle(el).backgroundColor
    )
    const zoomIn = zoomButton(page, 'Hineinzoomen')
    const zoomOut = zoomButton(page, 'Herauszoomen')
    await expect(zoomOut).toHaveAttribute('aria-disabled', 'true')

    await zoomIn.hover()
    expect(await paint(zoomIn)).toMatchObject({
        background: ink,
        color: paper,
    })

    await zoomOut.hover()
    const disabledPaint = await paint(zoomOut)
    expect(disabledPaint.background).toBe(TRANSPARENT)
    expect(disabledPaint.color).not.toBe(ink)
    expect(disabledPaint.border).not.toBe(ink)

    await page.mouse.move(0, 0)
    await region.focus()
    await tabUntil(page, (f) => f.name === 'Herauszoomen')
    await expect(zoomOut).toBeFocused()
    expect((await paint(zoomOut)).background).toBe(TRANSPARENT)

    await page.keyboard.press('Tab')
    await expect(zoomIn).toBeFocused()
    expect(await paint(zoomIn)).toMatchObject({
        background: ink,
        color: paper,
    })
})
