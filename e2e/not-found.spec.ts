import { expect, test } from '@playwright/test'
import { messages } from '../src/i18n/messages'
import { timelineRegion } from './timeline'

const UNKNOWN_PATHS = [
    { path: '/de/post/gibt-es-nicht', lang: 'de' },
    { path: '/de/gibt-es-nicht', lang: 'de' },
    { path: '/en/post/does-not-exist', lang: 'en' },
    { path: '/en/does-not-exist', lang: 'en' },
    { path: '/xx', lang: 'de' },
    { path: '/xx/gibt-es-nicht', lang: 'de' },
] as const

for (const { path, lang } of UNKNOWN_PATHS) {
    test(`${path} is a 404 in the ${lang} layout that keeps the timeline above the notice`, async ({
        page,
    }) => {
        const response = await page.goto(path)

        expect(response?.status()).toBe(404)
        await expect(page.locator('html')).toHaveAttribute('lang', lang)
        await expect(timelineRegion(page)).toBeVisible()
        await expect(
            page.getByRole('heading', { name: messages[lang].notFound.heading })
        ).toBeVisible()
    })
}
