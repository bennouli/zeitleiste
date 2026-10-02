import { expect, test, type APIRequestContext } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { Payload } from 'payload'
import { paragraphsToLexical } from '../src/lib/richText'
import { localPayload } from './payload'
import { authHeaders, specAccounts, VISITOR, type Account } from './reader'

type Owned = 'entries' | 'posts' | 'tags' | 'subjects' | 'media'
type Headers = Record<string, string>
type Stored = { id: number; owner: number; slug?: string }

const accounts = specAccounts('ownership')
const RUN = accounts.run
const FIXTURE = 'e2e/fixtures/image.png'
const POST = { body: paragraphsToLexical('Nur meine Sicht.') }
const ENTRY_TITLE = `Oktoberrevolution ${RUN}`

/** Names and titles are unique per owner, so every document a test makes carries its own label. */
const tagNamed = (label: string) => ({
    name: `Russland ${label} ${RUN}`,
    kind: 'place',
})
const subjectNamed = (label: string) => ({
    name: `Kalter Krieg ${label} ${RUN}`,
})
const entryTitled = (label: string) => ({
    title: `${ENTRY_TITLE} ${label}`,
    summary: 'Ein Eintrag, den der e2e-Lauf anlegt und wieder löscht.',
    startYear: 1917,
    type: 'event',
    _status: 'draft',
})
const IMAGE_ALT = `Ein braunes Rechteck ${RUN}`

let payload: Payload
let author: Account
let stranger: Account
let admin: Account

test.describe.configure({ mode: 'serial' })
test.use({ storageState: VISITOR })

test.beforeAll(async () => {
    payload = await localPayload()
    author = await accounts.create(payload, 'author')
    stranger = await accounts.create(payload, 'stranger')
    admin = await accounts.create(payload, 'admin', 'admin')
})

test.afterAll(() => accounts.removeAll(payload))

async function createOwned(
    request: APIRequestContext,
    headers: Headers,
    collection: Exclude<Owned, 'media'>,
    data: object
): Promise<Stored> {
    const res = await request.post(`/api/${collection}`, { headers, data })
    expect(res.status()).toBe(201)
    return (await res.json()).doc
}

async function uploadImage(
    request: APIRequestContext,
    headers: Headers
): Promise<Stored> {
    const buffer = await readFile(FIXTURE)
    const file = { name: `e2e-${RUN}.png`, mimeType: 'image/png', buffer }
    const fields = JSON.stringify({ alt: IMAGE_ALT })
    const res = await request.post('/api/media', {
        headers,
        multipart: { file, _payload: fields },
    })
    expect(res.status()).toBe(201)
    return (await res.json()).doc
}

/** One document of each owned collection, created by `headers`' user through the REST API. */
async function createOneOfEach(
    request: APIRequestContext,
    headers: Headers,
    label: string
) {
    return {
        entries: await createOwned(
            request,
            headers,
            'entries',
            entryTitled(label)
        ),
        posts: await createOwned(request, headers, 'posts', POST),
        tags: await createOwned(request, headers, 'tags', tagNamed(label)),
        subjects: await createOwned(
            request,
            headers,
            'subjects',
            subjectNamed(label)
        ),
        media: await uploadImage(request, headers),
    } satisfies Record<Owned, Stored>
}

async function foundIds(
    request: APIRequestContext,
    headers: Headers,
    collection: Owned
) {
    const res = await request.get(`/api/${collection}?limit=0&depth=0`, {
        headers,
    })
    expect(res.status()).toBe(200)
    const { docs } = await res.json()
    return docs.map((doc: { id: number }) => doc.id)
}

async function storedEntry(id: number) {
    return payload.findByID({
        collection: 'entries',
        id,
        depth: 0,
        draft: true,
    })
}

test("a user's entry, post, tag, subject and image are returned to them only, never to another user or an admin", async ({
    request,
}) => {
    const authorHeaders = await authHeaders(request, author)
    const strangerHeaders = await authHeaders(request, stranger)
    const adminHeaders = await authHeaders(request, admin)
    const authorDocs = await createOneOfEach(request, authorHeaders, 'read')

    for (const [collection, { id }] of Object.entries(authorDocs)) {
        const owned = collection as Owned
        const authorRead = await request.get(`/api/${owned}/${id}`, {
            headers: authorHeaders,
        })
        expect(authorRead.status(), owned).toBe(200)
        expect(await foundIds(request, authorHeaders, owned)).toContain(id)

        for (const headers of [strangerHeaders, adminHeaders]) {
            const byId = await request.get(`/api/${owned}/${id}`, { headers })
            expect(byId.status(), owned).toBe(404)
            expect(await foundIds(request, headers, owned)).not.toContain(id)
        }
    }
})

test("another user can neither change nor delete a user's documents", async ({
    request,
}) => {
    const authorHeaders = await authHeaders(request, author)
    const strangerHeaders = await authHeaders(request, stranger)
    const authorDocs = await createOneOfEach(request, authorHeaders, 'change')
    const rename = { title: 'Überschrieben', name: 'Überschrieben' }

    for (const [collection, { id }] of Object.entries(authorDocs)) {
        const owned = collection as Owned
        const changeResponse = await request.patch(`/api/${owned}/${id}`, {
            headers: strangerHeaders,
            data: rename,
        })
        expect(changeResponse.status(), owned).toBe(403)
        const removalResponse = await request.delete(`/api/${owned}/${id}`, {
            headers: strangerHeaders,
        })
        expect(removalResponse.status(), owned).toBe(403)
        const authorRead = await request.get(`/api/${owned}/${id}`, {
            headers: authorHeaders,
        })
        expect(authorRead.status(), owned).toBe(200)
    }
    expect((await storedEntry(authorDocs.entries.id)).title).toBe(
        `${ENTRY_TITLE} change`
    )
})

test('the owner is always the logged-in user, whatever the request sends', async ({
    request,
}) => {
    const authorHeaders = await authHeaders(request, author)
    const spoofedTag = { ...tagNamed('spoof'), owner: stranger.id }
    const spoofedEntry = { ...entryTitled('spoof'), owner: stranger.id }
    const reassignment = { owner: stranger.id }

    const tag = await createOwned(request, authorHeaders, 'tags', spoofedTag)
    const entry = await createOwned(
        request,
        authorHeaders,
        'entries',
        spoofedEntry
    )
    expect(tag.owner).toBe(author.id)
    expect((await storedEntry(entry.id)).owner).toBe(author.id)

    const reassignResponse = await request.patch(`/api/entries/${entry.id}`, {
        headers: authorHeaders,
        data: reassignment,
    })
    expect(reassignResponse.status()).toBe(200)
    expect((await storedEntry(entry.id)).owner).toBe(author.id)
})

test('two users each create a tag of the same name and an entry of the same slug', async ({
    request,
}) => {
    const authorHeaders = await authHeaders(request, author)
    const strangerHeaders = await authHeaders(request, stranger)
    const sharedTag = tagNamed('shared')
    const sharedEntry = entryTitled('shared')

    await createOwned(request, authorHeaders, 'tags', sharedTag)
    await createOwned(request, strangerHeaders, 'tags', sharedTag)
    const authorEntry = await createOwned(
        request,
        authorHeaders,
        'entries',
        sharedEntry
    )
    const strangerEntry = await createOwned(
        request,
        strangerHeaders,
        'entries',
        sharedEntry
    )

    expect(strangerEntry.slug).toBe(authorEntry.slug)
})

test('a user cannot attach another user’s tag, subject, entry or post to their own entry', async ({
    request,
}) => {
    const authorHeaders = await authHeaders(request, author)
    const strangerHeaders = await authHeaders(request, stranger)
    const strangerDocs = await createOneOfEach(request, strangerHeaders, 'link')
    const authorEntry = await createOwned(
        request,
        authorHeaders,
        'entries',
        entryTitled('link')
    )
    const foreignLinks = {
        tags: { tags: [strangerDocs.tags.id] },
        subject: { subject: strangerDocs.subjects.id },
        partOf: { partOf: strangerDocs.entries.id },
        post: { post: strangerDocs.posts.id },
    }

    for (const [field, link] of Object.entries(foreignLinks)) {
        const res = await request.patch(`/api/entries/${authorEntry.id}`, {
            headers: authorHeaders,
            data: link,
        })
        expect(res.status(), field).toBe(400)
    }
    const stored = await storedEntry(authorEntry.id)
    expect(stored.tags ?? []).toEqual([])
    expect(stored.subject ?? null).toBeNull()
    expect(stored.partOf ?? null).toBeNull()
    expect(stored.post ?? null).toBeNull()
})
