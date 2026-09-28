import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openTimeline } from './timeline'

const VIEWPORTS = [
    { name: 'desktop', size: { width: 1280, height: 800 } },
    { name: 'phone', size: { width: 390, height: 844 } },
] as const

const PAGES = ['/', '/post/oktoberrevolution'] as const

const COLOR_SCHEMES = ['light', 'dark'] as const

for (const { name, size } of VIEWPORTS) {
    for (const colorScheme of COLOR_SCHEMES) {
        test.describe(`axe (${name}, ${colorScheme})`, () => {
            test.use({ viewport: size, colorScheme })
            for (const path of PAGES) {
                test(`${path} has no violations`, async ({ page }) => {
                    await openTimeline(page, path)
                    const { violations } = await new AxeBuilder({
                        page,
                    }).analyze()
                    expect(
                        violations.map((v) => ({
                            id: v.id,
                            nodes: v.nodes.map((n) => n.target.join(' ')),
                        }))
                    ).toEqual([])
                })
            }
        })
    }
}
