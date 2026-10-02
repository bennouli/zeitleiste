import {
    expect,
    test,
    type APIRequestContext,
    type Page,
} from '@playwright/test'
import type { Payload } from 'payload'
import { paragraphsToLexical } from '../src/lib/richText'
import { localPayload } from './payload'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const emailFor = (name: string) => `e2e-notes-${name}-${RUN}@example.test`

const AUTHOR = { email: emailFor('author'), password: 'author-pass-1' }
const STRANGER = { email: emailFor('stranger'), password: 'stranger-pass-1' }
const ADMIN = { email: emailFor('admin'), password: 'admin-pass-1' }
const BODY = paragraphsToLexical('Nur für mich.')

let payload: Payload
const userIds = new Map<string, number>()

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
    payload = await localPayload()
    const acceptedAt = new Date().toISOString()
    const accounts = [
        { ...AUTHOR, role: 'editor' as const },
        { ...STRANGER, role: 'editor' as const },
        { ...ADMIN, role: 'admin' as const },
    ]
    for (const account of accounts) {
        const user = await payload.create({
            collection: 'users',
            data: { ...account, invitationAcceptedAt: acceptedAt },
        })
        userIds.set(account.email, user.id)
    }
})

test.afterAll(async () => {
    const ownerIds = [...userIds.values()]
    await payload.delete({
        collection: 'notes',
        where: { owner: { in: ownerIds } },
    })
    await payload.delete({
        collection: 'users',
        where: { id: { in: ownerIds } },
    })
})

function idOf(email: string): number {
    const id = userIds.get(email)
    if (id === undefined) throw new Error(`no user ${email}`)
    return id
}

async function authHeaders(
    request: APIRequestContext,
    credentials: { email: string; password: string }
) {
    const res = await request.post('/api/users/login', { data: credentials })
    expect(res.status()).toBe(200)
    const { token } = await res.json()
    return { Authorization: `JWT ${token}` }
}

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

async function adminLogin(page: Page, credentials: typeof AUTHOR) {
    await page.goto('/admin/login', { waitUntil: 'networkidle' })
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByLabel('Password').fill(credentials.password)
    await page.getByRole('button', { name: 'Login' }).click()
    await page.waitForURL(/\/admin$/)
}

test('a note is returned to its author only, never to another user, an admin or a visitor', async ({
    request,
}) => {
    const authorHeaders = await authHeaders(request, AUTHOR)
    const strangerHeaders = await authHeaders(request, STRANGER)
    const adminHeaders = await authHeaders(request, ADMIN)
    const noteId = await createNote(request, authorHeaders, { body: BODY })

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
    const authorHeaders = await authHeaders(request, AUTHOR)
    const strangerHeaders = await authHeaders(request, STRANGER)
    const noteId = await createNote(request, authorHeaders, { body: BODY })
    const otherBody = paragraphsToLexical('Überschrieben.')

    const change = await request.patch(`/api/notes/${noteId}`, {
        headers: strangerHeaders,
        data: { body: otherBody },
    })
    expect(change.status()).toBe(403)
    const removal = await request.delete(`/api/notes/${noteId}`, {
        headers: strangerHeaders,
    })
    expect(removal.status()).toBe(403)

    expect((await storedNote(noteId)).body).toEqual(BODY)
})

test('a visitor cannot create a note', async ({ request }) => {
    const res = await request.post('/api/notes', { data: { body: BODY } })
    expect(res.status()).toBe(403)
})

test('the owner is always the logged-in user, whatever the request sends', async ({
    request,
}) => {
    const authorHeaders = await authHeaders(request, AUTHOR)
    const strangerId = idOf(STRANGER.email)
    const authorId = idOf(AUTHOR.email)

    const noteId = await createNote(request, authorHeaders, {
        body: BODY,
        owner: strangerId,
    })
    expect((await storedNote(noteId)).owner).toBe(authorId)

    const reassign = await request.patch(`/api/notes/${noteId}`, {
        headers: authorHeaders,
        data: { owner: strangerId },
    })
    expect(reassign.status()).toBe(200)
    expect((await storedNote(noteId)).owner).toBe(authorId)
})

test('a user creates a note in the admin and only they see it listed', async ({
    page,
    browser,
}) => {
    const text = `Notiz aus dem Admin ${RUN}`
    await adminLogin(page, AUTHOR)
    await page.goto('/admin/collections/notes/create', {
        waitUntil: 'networkidle',
    })
    await page.locator('[contenteditable="true"]').first().fill(text)
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/admin\/collections\/notes\/\d+$/)
    const noteId = Number(page.url().split('/').pop())

    expect((await storedNote(noteId)).owner).toBe(idOf(AUTHOR.email))
    const listed = (viewer: Page) =>
        viewer.locator(`a[href$="/admin/collections/notes/${noteId}"]`)
    await page.goto('/admin/collections/notes', { waitUntil: 'networkidle' })
    await expect(listed(page)).not.toHaveCount(0)

    const strangerPage = await (await browser.newContext()).newPage()
    await adminLogin(strangerPage, STRANGER)
    await strangerPage.goto('/admin/collections/notes', {
        waitUntil: 'networkidle',
    })
    await expect(listed(strangerPage)).toHaveCount(0)
})
