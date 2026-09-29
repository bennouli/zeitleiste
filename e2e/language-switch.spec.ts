import { expect, test } from '@playwright/test'
import { openTimeline } from './timeline'

const POST_SLUG = 'oktoberrevolution'

test('switching on a post opens the same post in English', async ({ page }) => {
    await openTimeline(page, `/de/post/${POST_SLUG}`)
    const article = page.getByRole('article')
    const title = article.getByRole('heading', { level: 2 })
    await expect(
        article.getByText('7. November 1917', { exact: true })
    ).toBeVisible()

    await page.getByRole('link', { name: 'English' }).click()

    await expect(page).toHaveURL(new RegExp(`/en/post/${POST_SLUG}$`))
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(title).toBeVisible()
    await expect(
        article.getByText('7 November 1917', { exact: true })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close post' })).toBeVisible()
    await expect(
        page.getByRole('button', { name: 'Zoom in', exact: true })
    ).toBeVisible()
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
