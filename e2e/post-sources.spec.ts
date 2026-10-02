import { expect, test } from '@playwright/test'
import { Effect } from 'effect'
import type { Payload } from 'payload'
import type { Source } from '../src/lib/entry'
import { paragraphsToLexical } from '../src/lib/richText'
import type { Post } from '../src/payload-types'
import { localPayload } from './payload'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const QUIET = { disableRevalidate: true }
const BODY = paragraphsToLexical('Ein Beitrag, den der e2e-Lauf anlegt.')
const TARLE = {
    title: 'Tarle: Der Krimkrieg',
    url: 'https://example.org/tarle',
}
const FIGES = { title: 'Figes: Crimea', url: 'http://example.org/figes' }
const FTP_URL = 'ftp://example.org/tarle.pdf'
const URL_PROBLEM = 'Nur Links mit http:// oder https:// sind erlaubt.'

type Created = { collection: 'entries' | 'posts'; id: number }

let payload: Payload
const createdDocs: Created[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
    payload = await localPayload()
})

test.afterAll(async () => {
    for (const { collection, id } of createdDocs.reverse()) {
        await payload.delete({ collection, id, context: QUIET })
    }
})

/** Sources as an API caller may send them, before the collection checks them. */
type IncomingSource = Partial<Source>

async function createPost(sources?: readonly IncomingSource[]) {
    const data = { body: BODY, ...(sources && { sources }) } as Pick<
        Post,
        'body' | 'sources'
    >
    const doc = await payload.create({
        collection: 'posts',
        data,
        context: QUIET,
    })
    createdDocs.push({ collection: 'posts', id: doc.id })
    return doc
}

async function createEntry(post: number) {
    const data = {
        title: `E2E Quellen ${RUN}`,
        summary: 'Ein Eintrag, den der e2e-Lauf anlegt und wieder löscht.',
        startYear: 1853,
        type: 'war' as const,
        post,
        _status: 'published' as const,
    }
    const doc = await payload.create({
        collection: 'entries',
        data,
        context: QUIET,
    })
    createdDocs.push({ collection: 'entries', id: doc.id })
    return doc
}

async function loadedPost({ slug }: { slug?: string | null }) {
    const { loadPost } = await import('../src/lib/entries')
    const entry = await Effect.runPromise(loadPost(slug ?? ''))
    return entry?.post
}

test('a post saved with two sources loads both, in their order', async () => {
    const post = await createPost([TARLE, FIGES])
    const entry = await createEntry(post.id)

    expect((await loadedPost(entry))?.sources).toEqual([TARLE, FIGES])
})

test('a post without sources saves and loads with none', async () => {
    const post = await createPost()
    const entry = await createEntry(post.id)

    expect(await loadedPost(entry)).toEqual({ body: BODY, sources: [] })
})

test.describe('a source is refused', () => {
    const untitled = { url: TARLE.url }
    const unlinked = { title: TARLE.title }
    const script = { title: TARLE.title, url: 'javascript:alert(1)' }
    const ftp = { title: TARLE.title, url: FTP_URL }

    for (const [name, source] of Object.entries({
        untitled,
        unlinked,
        script,
        ftp,
    })) {
        test(name, async () => {
            await expect(createPost([source])).rejects.toThrow(/sources/)
        })
    }
})

test('the admin refuses a source without a title or an http link, and says why', async ({
    page,
}) => {
    const post = await createPost()
    await page.goto(`/admin/collections/posts/${post.id}`, {
        waitUntil: 'networkidle',
    })

    await page.getByRole('button', { name: 'Add Quelle' }).click()
    await page.locator('#field-sources__0__url').fill(FTP_URL)
    const save = page.getByRole('button', { name: 'Save', exact: true })
    const sources = page.locator('#field-sources')
    await expect(async () => {
        await save.click()
        await expect(sources).toContainText(URL_PROBLEM, { timeout: 2_000 })
    }).toPass()

    await expect(sources).toContainText('This field is required.')
    const stored = await payload.findByID({ collection: 'posts', id: post.id })
    expect(stored.sources).toEqual([])
})
