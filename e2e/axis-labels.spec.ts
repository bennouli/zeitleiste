import { expect, test } from '@playwright/test'
import { openTimeline } from './timeline'

const DESKTOP = { width: 1920, height: 1080 }

test.use({ viewport: DESKTOP })

test('tick labels and "Heute" paint over the connectors that cross them', async ({
    page,
}) => {
    await openTimeline(page)
    const paintOrder = await page.evaluate(() => {
        const labels = [
            ...document.querySelectorAll<HTMLElement>(
                '[data-tick] span, [data-today] span'
            ),
        ]
        const connectors = [
            ...document.querySelectorAll<HTMLElement>('[data-connector]'),
        ]
        return labels.flatMap((label) => {
            const l = label.getBoundingClientRect()
            return connectors.flatMap((connector) => {
                const c = connector.getBoundingClientRect()
                const left = Math.max(l.left, c.left)
                const right = Math.min(l.right, c.right)
                const top = Math.max(l.top, c.top)
                const bottom = Math.min(l.bottom, c.bottom)
                const isOnScreen = left >= 0 && right <= window.innerWidth
                if (right - left < 1 || bottom - top < 1 || !isOnScreen)
                    return []
                label.style.pointerEvents = 'auto'
                connector.style.pointerEvents = 'auto'
                const stack = document.elementsFromPoint(
                    (left + right) / 2,
                    (top + bottom) / 2
                )
                label.style.pointerEvents = ''
                connector.style.pointerEvents = ''
                return [stack.indexOf(label) < stack.indexOf(connector)]
            })
        })
    })
    expect(paintOrder.length).toBeGreaterThan(0)
    expect(paintOrder.every(Boolean)).toBe(true)
})
