import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openTimeline } from './timeline'

const VIEWPORTS = [
    { name: 'desktop', size: { width: 1280, height: 800 } },
    { name: 'phone', size: { width: 390, height: 844 } },
] as const

const PAGES = [
    '/de',
    '/de/post/oktoberrevolution',
    '/en',
    '/en/post/oktoberrevolution',
] as const

const COLOR_SCHEMES = ['light', 'dark'] as const

const UNKNOWN_INVITATION = '/einladung/unbekannt'

async function violationsOn(page: Page) {
    const { violations } = await new AxeBuilder({ page }).analyze()
    return violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target.join(' ')),
    }))
}

for (const { name, size } of VIEWPORTS) {
    for (const colorScheme of COLOR_SCHEMES) {
        test.describe(`axe (${name}, ${colorScheme})`, () => {
            test.use({ viewport: size, colorScheme })
            for (const path of PAGES) {
                test(`${path} has no violations`, async ({ page }) => {
                    await openTimeline(page, path)
                    expect(await violationsOn(page)).toEqual([])
                })
            }

            test('the invitation form and its explanation have no violations', async ({
                page,
            }) => {
                await page.goto(UNKNOWN_INVITATION)
                expect(await violationsOn(page)).toEqual([])
                await page
                    .getByLabel('Passwort', { exact: true })
                    .fill('pass-1')
                await page.getByLabel('Passwort wiederholen').fill('pass-1')
                await page
                    .getByRole('button', { name: 'Passwort festlegen' })
                    .click()
                await expect(
                    page.getByText('Die Einladung ist abgelaufen')
                ).toBeVisible()
                expect(await violationsOn(page)).toEqual([])
            })
        })
    }
}
