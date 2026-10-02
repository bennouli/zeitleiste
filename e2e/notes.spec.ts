import {
    expect,
    test,
    type APIRequestContext,
    type Page,
} from '@playwright/test'
import type { Payload } from 'payload'
import { paragraphsToLexical } from '../src/lib/richText'
import { localPayload } from './payload'
import {
    authHeaders,
    specAccounts,
    VISITOR,
    type Account,
    type Credentials,
} from './reader'

const accounts = specAccounts('notes')
const RUN = accounts.run
const BODY = paragraphsToLexical('Nur für mich.')
const NOTE = { body: BODY }

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

async function createNote(
    request: APIRequestContext,
    headers: Record<string, string>,
    data: object
): Promise<number> {
    const res = await request.post('/api/notes', { headers, data })
    expect(res.status()).toBe(201)
    return (await res.json()).doc.id
}

async function storedNote(id: number) {
    return payload.findByID({ collection: 'notes', id, depth: 0 })
}

async function foundNoteIds(
    request: APIRequestContext,
    headers: Record<string, string>
) {
    const res = await request.get('/api/notes?limit=0&depth=0', { headers })
    expect(res.status()).toBe(200)
    const { docs } = await res.json()
    return docs.map((doc: { id: number }) => doc.id)
}

async function adminLogin(page: Page, credentials: Credentials) {
    await page.goto('/admin/login', { waitUntil: 'networkidle' })
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByLabel('Password').fill(credentials.password)
    await page.getByRole('button', { name: 'Login' }).click()
    await page.waitForURL(/\/admin$/)
}

test('a note is returned to its author only, never to another user, an admin or a visitor', async ({
    request,
}) => {
    const authorHeaders = await authHeaders(request, author)
    const strangerHeaders = await authHeaders(request, stranger)
    const adminHeaders = await authHeaders(request, admin)
    const noteId = await createNote(request, authorHeaders, NOTE)

    const authorRead = await request.get(`/api/notes/${noteId}`, {
        headers: authorHeaders,
    })
    expect(authorRead.status()).toBe(200)
    expect(await foundNoteIds(request, authorHeaders)).toContain(noteId)

    for (const headers of [strangerHeaders, adminHeaders]) {
        const byId = await request.get(`/api/notes/${noteId}`, { headers })
        expect(byId.status()).toBe(404)
        expect(await foundNoteIds(request, headers)).not.toContain(noteId)
    }

    expect((await request.get(`/api/notes/${noteId}`)).status()).toBe(403)
    expect((await request.get('/api/notes')).status()).toBe(403)
})

test('another user can neither change nor delete a note', async ({
    request,
}) => {
    const authorHeaders = await authHeaders(request, author)
    const strangerHeaders = await authHeaders(request, stranger)
    const noteId = await createNote(request, authorHeaders, NOTE)
    const overwrite = { body: paragraphsToLexical('Überschrieben.') }

    const changeResponse = await request.patch(`/api/notes/${noteId}`, {
        headers: strangerHeaders,
        data: overwrite,
    })
    expect(changeResponse.status()).toBe(403)
    const removalResponse = await request.delete(`/api/notes/${noteId}`, {
        headers: strangerHeaders,
    })
    expect(removalResponse.status()).toBe(403)

    expect((await storedNote(noteId)).body).toEqual(BODY)
})

test('a visitor cannot create a note', async ({ request }) => {
    const res = await request.post('/api/notes', { data: NOTE })
    expect(res.status()).toBe(403)
})

test('the owner is always the logged-in user, whatever the request sends', async ({
    request,
}) => {
    const authorHeaders = await authHeaders(request, author)

    const spoofedNote = { body: BODY, owner: stranger.id }
    const reassignment = { owner: stranger.id }

    const noteId = await createNote(request, authorHeaders, spoofedNote)
    expect((await storedNote(noteId)).owner).toBe(author.id)

    const reassignResponse = await request.patch(`/api/notes/${noteId}`, {
        headers: authorHeaders,
        data: reassignment,
    })
    expect(reassignResponse.status()).toBe(200)
    expect((await storedNote(noteId)).owner).toBe(author.id)
})

test('a user creates a note in the admin and only they see it listed', async ({
    page,
    browser,
}) => {
    const text = `Notiz aus dem Admin ${RUN}`
    await adminLogin(page, author)
    await page.goto('/admin/collections/notes/create', {
        waitUntil: 'networkidle',
    })
    await page.locator('[contenteditable="true"]').first().fill(text)
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/admin\/collections\/notes\/\d+$/)
    const noteId = Number(page.url().split('/').pop())

    expect((await storedNote(noteId)).owner).toBe(author.id)
    const noteLinkIn = (viewer: Page) =>
        viewer.locator(`a[href$="/admin/collections/notes/${noteId}"]`)
    await page.goto('/admin/collections/notes', { waitUntil: 'networkidle' })
    await expect(noteLinkIn(page)).not.toHaveCount(0)

    const strangerPage = await (await browser.newContext()).newPage()
    await adminLogin(strangerPage, stranger)
    await strangerPage.goto('/admin/collections/notes', {
        waitUntil: 'networkidle',
    })
    await expect(noteLinkIn(strangerPage)).toHaveCount(0)
})

test("deleting a user deletes that user's notes", async ({ request }) => {
    const leaver = await accounts.create(payload, 'leaver')
    const leaverHeaders = await authHeaders(request, leaver)
    const noteId = await createNote(request, leaverHeaders, NOTE)
    const adminHeaders = await authHeaders(request, admin)

    const removalResponse = await request.delete(`/api/users/${leaver.id}`, {
        headers: adminHeaders,
    })
    expect(removalResponse.status()).toBe(200)

    const { totalDocs } = await payload.count({
        collection: 'notes',
        where: { id: { equals: noteId } },
    })
    expect(totalDocs).toBe(0)
})
