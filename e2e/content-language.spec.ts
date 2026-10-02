import { expect, test } from '@playwright/test'
import type { Payload } from 'payload'
import { paragraphsToLexical } from '../src/lib/richText'
import { localPayload } from './payload'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const QUIET = { disableRevalidate: true }

type Created = { collection: 'entries' | 'posts'; id: number }

let payload: Payload
const created: Created[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
    payload = await localPayload()
})

test.afterAll(async () => {
    for (const { collection, id } of created.reverse()) {
        await payload.delete({ collection, id, context: QUIET })
    }
})

test('a post reads the same under /de and /en', async ({ page }) => {
    const title = `Einsprachig ${RUN}`
    const bodyText = `Der einzige Text ${RUN}`
    const postData = { body: paragraphsToLexical(bodyText) }
    const post = await payload.create({
        collection: 'posts',
        data: postData,
        context: QUIET,
    })
    created.push({ collection: 'posts', id: post.id })
    const entryData = {
        title,
        summary: `Zusammenfassung ${RUN}`,
        startYear: 1995,
        type: 'event' as const,
        post: post.id,
        _status: 'published' as const,
    }
    const entry = await payload.create({
        collection: 'entries',
        data: entryData,
        context: QUIET,
    })
    created.push({ collection: 'entries', id: entry.id })

    for (const lang of ['de', 'en']) {
        await page.goto(`/${lang}/post/${entry.slug}`)

        await expect(page.locator('html')).toHaveAttribute('lang', lang)
        await expect(
            page.getByRole('heading', { level: 2, name: title })
        ).toBeVisible()
        await expect(page.getByText(bodyText)).toBeVisible()
    }
})
