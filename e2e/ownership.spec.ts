import { expect, test, type APIRequestContext } from '@playwright/test'
import { Schema } from 'effect'
import { readFile } from 'node:fs/promises'
import type { Payload } from 'payload'
import { paragraphsToLexical } from '../src/lib/richText'
import { localPayload } from './payload'
import { authHeaders, specAccounts, VISITOR, type Account } from './reader'

const OWNED = ['entries', 'posts', 'tags', 'subjects', 'media'] as const

const CreatedResponse = Schema.Struct({
    doc: Schema.Struct({
        id: Schema.Number,
        slug: Schema.optional(Schema.NullOr(Schema.String)),
    }),
})
const ListResponse = Schema.Struct({
    docs: Schema.Array(Schema.Struct({ id: Schema.Number })),
})
const decodeCreated = Schema.decodeUnknownSync(CreatedResponse)
const decodeList = Schema.decodeUnknownSync(ListResponse)

type Owned = (typeof OWNED)[number]
type AuthHeaders = Record<string, string>
type CreatedDoc = typeof CreatedResponse.Type.doc

const accounts = specAccounts('ownership')
const RUN = accounts.run
const FIXTURE = 'e2e/fixtures/image.png'
const POST = { body: paragraphsToLexical('Nur meine Sicht.') }
const ENTRY_TITLE = `Oktoberrevolution ${RUN}`

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
    headers: AuthHeaders,
    collection: Exclude<Owned, 'media'>,
    data: object
): Promise<CreatedDoc> {
    const res = await request.post(`/api/${collection}`, { headers, data })
    expect(res.status()).toBe(201)
    return decodeCreated(await res.json()).doc
}

async function uploadImage(
    request: APIRequestContext,
    headers: AuthHeaders
): Promise<CreatedDoc> {
    const buffer = await readFile(FIXTURE)
    const file = { name: `e2e-${RUN}.png`, mimeType: 'image/png', buffer }
    const fields = JSON.stringify({ alt: IMAGE_ALT })
    const res = await request.post('/api/media', {
        headers,
        multipart: { file, _payload: fields },
    })
    expect(res.status()).toBe(201)
    return decodeCreated(await res.json()).doc
}

async function createOneOfEach(
    request: APIRequestContext,
    headers: AuthHeaders,
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
    } satisfies Record<Owned, CreatedDoc>
}

async function foundIds(
    request: APIRequestContext,
    headers: AuthHeaders,
    collection: Owned
) {
    const res = await request.get(`/api/${collection}?limit=0&depth=0`, {
        headers,
    })
    expect(res.status()).toBe(200)
    const { docs } = decodeList(await res.json())
    return docs.map((doc) => doc.id)
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

    for (const collection of OWNED) {
        const { id } = authorDocs[collection]
        const authorRead = await request.get(`/api/${collection}/${id}`, {
            headers: authorHeaders,
        })
        expect(authorRead.status(), collection).toBe(200)
        expect(await foundIds(request, authorHeaders, collection)).toContain(id)

        for (const headers of [strangerHeaders, adminHeaders]) {
            const byId = await request.get(`/api/${collection}/${id}`, {
                headers,
            })
            expect(byId.status(), collection).toBe(404)
            expect(await foundIds(request, headers, collection)).not.toContain(
                id
            )
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

    for (const collection of OWNED) {
        const { id } = authorDocs[collection]
        const changeResponse = await request.patch(`/api/${collection}/${id}`, {
            headers: strangerHeaders,
            data: rename,
        })
        expect(changeResponse.status(), collection).toBe(403)
        const removalResponse = await request.delete(
            `/api/${collection}/${id}`,
            {
                headers: strangerHeaders,
            }
        )
        expect(removalResponse.status(), collection).toBe(403)
        const authorRead = await request.get(`/api/${collection}/${id}`, {
            headers: authorHeaders,
        })
        expect(authorRead.status(), collection).toBe(200)
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
    const storedTag = await payload.findByID({
        collection: 'tags',
        id: tag.id,
        depth: 0,
    })
    expect(storedTag.owner).toBe(author.id)
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
    const unlinkedEntry = await storedEntry(authorEntry.id)
    expect(unlinkedEntry.tags ?? []).toEqual([])
    expect(unlinkedEntry.subject ?? null).toBeNull()
    expect(unlinkedEntry.partOf ?? null).toBeNull()
    expect(unlinkedEntry.post ?? null).toBeNull()
})
