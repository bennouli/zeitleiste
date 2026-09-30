import { expect, test } from '@playwright/test'
import { messages } from '../src/i18n/messages'
import { openTimeline, timelineRegion } from './timeline'

const BRAND = 'liniya'

const PAGES = [
    { path: '/de', title: BRAND },
    { path: '/en', title: BRAND },
    {
        path: '/de/post/oktoberrevolution',
        title: `Oktoberrevolution – ${BRAND}`,
    },
    {
        path: '/en/post/oktoberrevolution',
        title: `Oktoberrevolution – ${BRAND}`,
    },
] as const

for (const { path, title } of PAGES) {
    test(`${path} is titled "${title}" under the ${BRAND} wordmark`, async ({
        page,
    }) => {
        await openTimeline(page, path)

        await expect(page).toHaveTitle(title)
        await expect(
            timelineRegion(page).getByText(BRAND, { exact: true })
        ).toBeVisible()
    })
}

test(`the admin's page titles end in ${BRAND}`, async ({ page }) => {
    await page.goto('/admin/login')

    await expect(page).toHaveTitle(new RegExp(`\\S – ${BRAND}$`))
})

for (const lang of ['de', 'en'] as const) {
    test(`/${lang} describes itself as ${BRAND}`, async ({ page }) => {
        await page.goto(`/${lang}`)

        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
            'content',
            messages[lang].site.description
        )
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
            'content',
            new RegExp(`^${BRAND}: `)
        )
    })
}
