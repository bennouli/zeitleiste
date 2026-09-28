import { expect, test } from '@playwright/test'
import { timelineRegion } from './timeline'

const UNKNOWN_PATHS = ['/post/gibt-es-nicht', '/gibt-es-nicht']

for (const path of UNKNOWN_PATHS) {
    test(`${path} is a 404 that keeps the timeline above the notice`, async ({
        page,
    }) => {
        const response = await page.goto(path)

        expect(response?.status()).toBe(404)
        await expect(timelineRegion(page)).toBeVisible()
        await expect(
            page.getByRole('heading', { name: 'Seite nicht gefunden' })
        ).toBeVisible()
    })
}
