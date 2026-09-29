import { expect, test } from '@playwright/test'
import { openTimeline } from './timeline'

const POST_SLUG = 'oktoberrevolution'

test('switching on a post opens the same post in English', async ({ page }) => {
    await openTimeline(page, `/de/post/${POST_SLUG}`)
    const title = page.getByRole('article').getByRole('heading', { level: 2 })

    await page.getByRole('link', { name: 'English' }).click()

    await expect(page).toHaveURL(new RegExp(`/en/post/${POST_SLUG}$`))
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(title).toBeVisible()
})

test('switching on the start page goes to the other start page and back', async ({
    page,
}) => {
    await openTimeline(page, '/de')

    await page.getByRole('link', { name: 'English' }).click()
    await expect(page).toHaveURL(/\/en$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.getByRole('link', { name: 'Deutsch' }).click()
    await expect(page).toHaveURL(/\/de$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
})
