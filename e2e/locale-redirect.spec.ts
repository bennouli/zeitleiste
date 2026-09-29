import { expect, test } from '@playwright/test'

const BROWSER_LOCALES = [
    { locale: 'de-DE', lang: 'de' },
    { locale: 'en-US', lang: 'en' },
    { locale: 'fr-FR', lang: 'de' },
] as const

for (const { locale, lang } of BROWSER_LOCALES) {
    test.describe(`a browser in ${locale}`, () => {
        test.use({ locale })

        test(`is sent from / to /${lang}`, async ({ page }) => {
            await page.goto('/')
            await expect(page).toHaveURL(new RegExp(`/${lang}$`))
            await expect(page.locator('html')).toHaveAttribute('lang', lang)
        })

        test(`is sent from an old post address to /${lang}/post/…`, async ({
            page,
        }) => {
            await page.goto('/post/oktoberrevolution?quelle=alt')
            await expect(page).toHaveURL(
                new RegExp(`/${lang}/post/oktoberrevolution\\?quelle=alt$`)
            )
            await expect(page.getByRole('article')).toBeVisible()
        })
    })
}

test('the admin is never given a locale prefix', async ({ page }) => {
    const response = await page.goto('/admin/login')
    expect(new URL(page.url()).pathname).toBe('/admin/login')
    expect(response?.status()).toBe(200)
})
