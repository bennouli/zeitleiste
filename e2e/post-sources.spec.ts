import { expect, test } from '@playwright/test'
import { Effect } from 'effect'
import type { Payload } from 'payload'
import type { Source } from '../src/lib/entry'
import { paragraphsToLexical } from '../src/lib/richText'
import type { Post } from '../src/payload-types'
import { localPayload } from './payload'
import { readerId } from './reader'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const QUIET = { disableRevalidate: true }
const BODY = paragraphsToLexical('Ein Beitrag, den der e2e-Lauf anlegt.')
const TARLE = {
    title: 'Tarle: Der Krimkrieg',
    url: 'https://example.org/tarle',
}
const FIGES = { title: 'Figes: Crimea', url: 'http://example.org/figes' }
const FTP_URL = 'ftp://example.org/tarle.pdf'

type Created = { collection: 'entries' | 'posts'; id: number }

let payload: Payload
let owner: number
const createdDocs: Created[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
    payload = await localPayload()
    owner = await readerId(payload)
})

test.afterAll(async () => {
    for (const { collection, id } of createdDocs.reverse()) {
        await payload.delete({ collection, id, context: QUIET })
    }
})

/** Sources as an API caller may send them, before the collection checks them. */
type IncomingSource = Partial<Source>

async function createPost(sources?: readonly IncomingSource[]) {
    const data = { owner, body: BODY, ...(sources && { sources }) } as Pick<
        Post,
        'owner' | 'body' | 'sources'
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
        owner,
        title: `E2E Quellen ${post} ${RUN}`,
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

    const refusals: [string, IncomingSource, string][] = [
        ['without a title', untitled, 'Titel'],
        ['without a link', unlinked, 'Link'],
        ['with a javascript: link', script, 'Link'],
        ['with an ftp: link', ftp, 'Link'],
    ]

    for (const [name, source, field] of refusals) {
        test(name, async () => {
            await expect(createPost([source])).rejects.toThrow(
                `Quellen 1 > ${field}`
            )
        })
    }
})

test('the admin refuses a source without a title or an http link, and names the fields', async ({
    page,
}) => {
    const post = await createPost()
    await page.goto(`/admin/collections/posts/${post.id}`, {
        waitUntil: 'networkidle',
    })

    await page.getByRole('button', { name: 'Add Quelle' }).click()
    await page.locator('#field-sources__0__url').fill(FTP_URL)
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    const errors = page.locator('.payload-toast-container')
    await expect(errors).toContainText('Quellen 1 → Titel')
    await expect(errors).toContainText('Quellen 1 → Link')
    const stored = await payload.findByID({ collection: 'posts', id: post.id })
    expect(stored.sources).toEqual([])
})
