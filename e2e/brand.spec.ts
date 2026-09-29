import { expect, test } from '@playwright/test'
import { openTimeline, timelineRegion } from './timeline'

const BRAND = 'Liniya'

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
