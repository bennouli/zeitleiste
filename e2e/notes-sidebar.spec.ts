import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Response } from '@playwright/test'
import type { Payload } from 'payload'
import { paragraphsToLexical } from '../src/lib/richText'
import { localPayload } from './payload'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

let payload: Payload
const userIds: number[] = []

test.beforeAll(async () => {
    payload = await localPayload()
})

test.afterAll(async () => {
    await payload.delete({
        collection: 'notes',
        where: { owner: { in: userIds } },
    })
    await payload.delete({
        collection: 'users',
        where: { id: { in: userIds } },
    })
})

async function newAuthor(name: string) {
    const credentials = {
        email: `e2e-sidebar-${name}-${RUN}@example.test`,
        password: `${name}-pass-1`,
    }
    const user = await payload.create({
        collection: 'users',
        data: {
            ...credentials,
            role: 'editor',
            invitationAcceptedAt: new Date().toISOString(),
        },
    })
    userIds.push(user.id)
    return { ...credentials, id: user.id }
}

async function signIn(
    page: Page,
    credentials: { email: string; password: string }
) {
    const res = await page.request.post('/api/users/login', {
        data: credentials,
    })
    expect(res.status()).toBe(200)
}

async function storeNote(ownerId: number, text: string) {
    return payload.create({
        collection: 'notes',
        data: { owner: ownerId, body: paragraphsToLexical(text) },
        overrideAccess: true,
    })
}

function sidebarOf(page: Page) {
    return page.getByRole('complementary', { name: 'Notizen' })
}

function newNoteEditor(page: Page) {
    return sidebarOf(page).getByRole('textbox', { name: 'Neue Notiz' })
}

test('a note written with Markdown shortcuts keeps its formatting after a reload', async ({
    page,
}) => {
    const author = await newAuthor('markdown')
    await signIn(page, author)
    await page.goto('/de')

    const editor = newNoteEditor(page)
    await editor.click()
    await page.keyboard.type('# Reise nach Holland')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Er reiste **inkognito** ')
    await expect(
        editor.locator('strong', { hasText: 'inkognito' })
    ).toBeVisible()
    await page.keyboard.press('Enter')
    await page.keyboard.type('- Zaandam')
    await page.keyboard.press('Enter')
    await page.keyboard.type('London')
    await page.keyboard.press('ControlOrMeta+Enter')

    await expect(editor).toHaveText('')
    await page.reload()

    const firstNote = sidebarOf(page).getByRole('article').first()
    await expect(
        firstNote.getByRole('heading', { level: 3, name: 'Reise nach Holland' })
    ).toBeVisible()
    await expect(firstNote.locator('strong')).toHaveText('inkognito')
    await expect(firstNote.getByRole('listitem')).toHaveText([
        'Zaandam',
        'London',
    ])
})

test('a note longer than twelve lines is cut off and can be expanded', async ({
    page,
}) => {
    const author = await newAuthor('long')
    const lines = Array.from({ length: 20 }, (_, i) => `Zeile ${i + 1}`)
    const longNote = ['Lange Notiz', ...lines].join('\n\n')
    await storeNote(author.id, longNote)
    await signIn(page, author)
    await page.goto('/de')

    const note = sidebarOf(page).getByRole('article')
    const showAll = note.getByRole('button', { name: 'Ganz anzeigen' })
    await expect(showAll).toBeVisible()
    await expect(note.getByText('Zeile 20')).not.toBeInViewport()
    const clampedHeight = (await note.boundingBox())?.height ?? 0

    await showAll.click()

    await expect(
        note.getByRole('button', { name: 'Weniger anzeigen' })
    ).toHaveAttribute('aria-expanded', 'true')
    expect((await note.boundingBox())?.height ?? 0).toBeGreaterThan(
        clampedHeight
    )
})

test('a note is edited and deleted from the sidebar', async ({ page }) => {
    const author = await newAuthor('edit')
    await storeNote(author.id, 'Pskow')
    await signIn(page, author)
    await page.goto('/de')
    const sidebar = sidebarOf(page)

    await sidebar
        .getByRole('button', { name: 'Notiz bearbeiten: Pskow' })
        .click()
    const editor = sidebar.getByRole('textbox', {
        name: 'Notiz bearbeiten: Pskow',
    })
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' 1240')
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(
        sidebar.getByRole('heading', { level: 3, name: 'Pskow 1240' })
    ).toBeVisible()

    await page.reload()
    await sidebar
        .getByRole('button', { name: 'Notiz löschen: Pskow 1240' })
        .click()
    await sidebar
        .getByRole('group', { name: 'Diese Notiz löschen?' })
        .getByRole('button', { name: 'Löschen' })
        .click()
    await expect(sidebar.getByRole('article')).toHaveCount(0)

    await page.reload()
    await expect(sidebar.getByRole('textbox')).toBeVisible()
    await expect(sidebar.getByRole('article')).toHaveCount(0)
})

test('collapsing the sidebar survives a reload', async ({ page }) => {
    const author = await newAuthor('collapse')
    await signIn(page, author)
    await page.goto('/de')

    await sidebarOf(page)
        .getByRole('button', { name: 'Notizen ausblenden' })
        .click()
    await page.reload()

    await expect(
        sidebarOf(page).getByRole('button', { name: 'Notizen einblenden' })
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(newNoteEditor(page)).toBeHidden()
})

test('the sidebar passes an accessibility check', async ({ page }) => {
    const author = await newAuthor('a11y')
    await storeNote(author.id, 'Barrierefrei\n\nZweite Zeile')
    await signIn(page, author)
    await page.goto('/de')
    await expect(sidebarOf(page).getByRole('article')).toBeVisible()

    const results = await new AxeBuilder({ page }).include('aside').analyze()

    expect(results.violations).toEqual([])
})

test('a visitor sees no sidebar and gets no notes from the server', async ({
    page,
}) => {
    const author = await newAuthor('private')
    const secret = `Geheim ${RUN}`
    await storeNote(author.id, secret)
    const isServerAction = (response: Response) =>
        response.request().method() === 'POST' &&
        response.request().headers()['next-action'] !== undefined
    const notesLoad = page.waitForResponse(isServerAction)

    await page.goto('/de')
    const notesResponse = await notesLoad

    await expect(sidebarOf(page)).toHaveCount(0)
    expect(await page.content()).not.toContain(secret)
    expect(await notesResponse.text()).not.toContain(secret)
})

test('a note is written, saved and deleted with the keyboard alone', async ({
    page,
}) => {
    const author = await newAuthor('keyboard')
    await signIn(page, author)
    await page.goto('/de')
    const sidebar = sidebarOf(page)
    const editor = newNoteEditor(page)

    await editor.focus()
    await page.keyboard.type('Tastatur')
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(
        sidebar.getByRole('heading', { level: 3, name: 'Tastatur' })
    ).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(sidebar.getByRole('button', { name: 'Sichern' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
        sidebar.getByRole('button', { name: 'Notiz bearbeiten: Tastatur' })
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
        sidebar.getByRole('button', { name: 'Notiz löschen: Tastatur' })
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
        sidebar.getByRole('button', { name: 'Abbrechen' })
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')

    await expect(sidebar.getByRole('article')).toHaveCount(0)
    await expect(editor).toBeFocused()
})
