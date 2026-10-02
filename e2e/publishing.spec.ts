import {
    expect,
    test,
    type APIRequestContext,
    type Page,
} from '@playwright/test'
import { paragraphsToLexical } from '../src/lib/richText'
import { readerAccount } from './reader'
import { openTimeline } from './timeline'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

type Created = { collection: 'entries' | 'posts'; id: number }

let authorization: string
const created: Created[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ playwright }, { project }) => {
    const api = await playwright.request.newContext({
        baseURL: project.use.baseURL,
    })
    const login = await api.post('/api/users/login', {
        data: readerAccount(),
    })
    expect(login.status()).toBe(200)
    authorization = `JWT ${(await login.json()).token}`
    await api.dispose()
})

// Through the server, so its hooks refresh the pages it serves.
test.afterAll(async ({ playwright }, { project }) => {
    const api = await playwright.request.newContext({
        baseURL: project.use.baseURL,
        extraHTTPHeaders: { Authorization: authorization },
    })
    for (const { collection, id } of created.reverse()) {
        const res = await api.delete(`/api/${collection}/${id}`)
        expect(res.status()).toBe(200)
    }
    await api.dispose()
})

async function createDoc(
    request: APIRequestContext,
    collection: Created['collection'],
    data: object
): Promise<{ id: number; slug?: string }> {
    const res = await request.post(`/api/${collection}`, {
        headers: { Authorization: authorization },
        data,
    })
    expect(res.status()).toBe(201)
    const { doc } = await res.json()
    created.push({ collection, id: doc.id })
    return doc
}

async function setStatus(
    request: APIRequestContext,
    id: number,
    status: 'draft' | 'published'
) {
    const res = await request.patch(`/api/entries/${id}`, {
        headers: { Authorization: authorization },
        data: { _status: status },
    })
    expect(res.status()).toBe(200)
}

const entryOnTimeline = (page: Page, slug: string) =>
    page
        .locator(`[data-entry-id="${slug}"], [data-entry-ids~="${slug}"]`)
        .first()

const entryData = (title: string, post?: number) => ({
    title,
    summary: 'Ein Eintrag, den der e2e-Lauf anlegt und wieder löscht.',
    startYear: 1995,
    startMonth: 6,
    type: 'event',
    post,
    _status: 'published',
})

test('a newly published entry is on the timeline at the next load', async ({
    page,
    request,
}) => {
    await openTimeline(page)
    const title = `E2E Veröffentlicht ${RUN}`

    const entry = await createDoc(request, 'entries', entryData(title))
    await openTimeline(page)

    await expect(entryOnTimeline(page, entry.slug!)).toBeAttached()
})

test('an unpublished entry leaves the timeline and its post is not found', async ({
    page,
    request,
}) => {
    const post = await createDoc(request, 'posts', {
        body: paragraphsToLexical('Ein Beitrag, der gleich verschwindet.'),
    })
    const title = `E2E Zurückgezogen ${RUN}`
    const entry = await createDoc(request, 'entries', entryData(title, post.id))
    const postPath = `/de/post/${entry.slug}`
    const shown = await page.goto(postPath)
    expect(shown?.status()).toBe(200)
    await expect(
        page.getByRole('heading', { level: 2, name: title })
    ).toBeVisible()

    await setStatus(request, entry.id, 'draft')

    await openTimeline(page)
    await expect(entryOnTimeline(page, entry.slug!)).not.toBeAttached()
    const gone = await page.goto(postPath)
    expect(gone?.status()).toBe(404)
    await expect(
        page.getByRole('heading', { name: 'Seite nicht gefunden' })
    ).toBeVisible()
})
