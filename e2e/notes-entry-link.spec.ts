import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { Effect } from 'effect'
import type { Payload } from 'payload'
import { paragraphsToLexical } from '../src/lib/richText'
import type { User } from '../src/payload-types'
import { localPayload } from './payload'
import { signIn, specAccounts } from './reader'

const accounts = specAccounts('entry-link')
const RUN = accounts.run
const QUIET = { disableRevalidate: true }

let payload: Payload
const entryIds: number[] = []

test.beforeAll(async () => {
    payload = await localPayload()
})

test.afterAll(async () => {
    await payload.delete({
        collection: 'entries',
        where: { id: { in: entryIds } },
        context: QUIET,
    })
    await accounts.removeAll(payload)
})

/** A draft, so it never shows on the timeline other specs walk; readers can still find it. */
async function storeEntry(ownerId: number, title: string) {
    const entry = await payload.create({
        collection: 'entries',
        data: {
            owner: ownerId,
            title,
            summary: `Zusammenfassung ${RUN}`,
            startYear: 1240,
            type: 'event',
        },
        draft: true,
        context: QUIET,
    })
    entryIds.push(entry.id)
    return entry
}

async function storeNote(ownerId: number, text: string, entryId?: number) {
    return payload.create({
        collection: 'notes',
        data: {
            owner: ownerId,
            body: paragraphsToLexical(text),
            entry: entryId,
        },
        overrideAccess: true,
    })
}

async function storedNote(id: number) {
    return payload.findByID({ collection: 'notes', id, depth: 0 })
}

function sidebarOf(page: Page) {
    return page.getByRole('complementary', { name: 'Notizen' })
}

test('a note linked to an entry from the sidebar still shows the link after a reload', async ({
    page,
}) => {
    const author = await accounts.create(payload, 'link')
    const entry = await storeEntry(author.id, `Mongolen erobern Kiew ${RUN}`)
    const noteTitle = `Kiew ${RUN}`
    const note = await storeNote(author.id, noteTitle)
    await signIn(page, author)
    await page.goto('/de')
    const sidebar = sidebarOf(page)

    await sidebar
        .getByRole('button', {
            name: `Notiz mit einem Eintrag verknüpfen: ${noteTitle}`,
        })
        .click()
    const picker = sidebar.getByRole('group', {
        name: `Notiz mit einem Eintrag verknüpfen: ${noteTitle}`,
    })
    const search = picker.getByRole('searchbox', { name: 'Eintrag suchen' })
    await expect(search).toBeFocused()
    await search.fill(`erobern ${RUN}`)
    const pick = picker.getByRole('button', { name: entry.title })
    await expect(pick).toBeVisible()
    const axe = await new AxeBuilder({ page }).include('aside').analyze()
    expect(axe.violations).toEqual([])
    await pick.click()

    const unlink = sidebar.getByRole('button', {
        name: `Verknüpfung mit ${entry.title} entfernen`,
    })
    await expect(unlink).toBeFocused()
    await page.reload()
    await expect(unlink).toBeVisible()
    await expect(sidebar.getByRole('article')).toContainText(entry.title)
    expect((await storedNote(note.id)).entry).toBe(entry.id)
})

test('removing the link leaves the note unlinked and otherwise unchanged', async ({
    page,
}) => {
    const author = await accounts.create(payload, 'unlink')
    const entry = await storeEntry(author.id, `Nowgorod wird Republik ${RUN}`)
    const noteTitle = `Nowgorod ${RUN}`
    const note = await storeNote(author.id, noteTitle, entry.id)
    await signIn(page, author)
    await page.goto('/de')
    const sidebar = sidebarOf(page)

    await sidebar
        .getByRole('button', {
            name: `Verknüpfung mit ${entry.title} entfernen`,
        })
        .click()

    await expect(
        sidebar.getByRole('button', {
            name: `Notiz mit einem Eintrag verknüpfen: ${noteTitle}`,
        })
    ).toBeFocused()
    await expect(sidebar.getByText(entry.title)).toHaveCount(0)
    const unlinkedNote = await storedNote(note.id)
    expect(unlinkedNote.entry).toBeNull()
    expect(unlinkedNote.body).toEqual(note.body)
    expect(unlinkedNote.owner).toBe(author.id)
})

test('a note is linked and unlinked with the keyboard alone', async ({
    page,
}) => {
    const author = await accounts.create(payload, 'keyboard')
    const entry = await storeEntry(author.id, `Taufe der Kiewer Rus ${RUN}`)
    const noteTitle = `Taufe ${RUN}`
    await storeNote(author.id, noteTitle)
    await signIn(page, author)
    await page.goto('/de')
    const sidebar = sidebarOf(page)
    const linkButton = sidebar.getByRole('button', {
        name: `Notiz mit einem Eintrag verknüpfen: ${noteTitle}`,
    })

    await sidebar
        .getByRole('button', { name: `Notiz bearbeiten: ${noteTitle}` })
        .focus()
    await page.keyboard.press('Tab')
    await expect(linkButton).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.type(`Taufe ${RUN}`)
    const pick = sidebar.getByRole('button', { name: entry.title })
    await expect(pick).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(pick).toBeFocused()
    await page.keyboard.press('Enter')

    const unlink = sidebar.getByRole('button', {
        name: `Verknüpfung mit ${entry.title} entfernen`,
    })
    await expect(unlink).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(linkButton).toBeFocused()
    await expect(sidebar.getByText(entry.title)).toHaveCount(0)
})

test('deleting an entry keeps its notes, without the link', async () => {
    const author = await accounts.create(payload, 'deleted-entry')
    const entry = await storeEntry(author.id, `Gelöschter Eintrag ${RUN}`)
    const note = await storeNote(author.id, `Pskow ${RUN}`, entry.id)

    await payload.delete({
        collection: 'entries',
        id: entry.id,
        context: QUIET,
    })

    const keptNote = await storedNote(note.id)
    expect(keptNote.entry).toBeNull()
    expect(keptNote.body).toEqual(note.body)
})

test('the notes of an entry are only the reader’s own notes linked to it', async () => {
    const author = await accounts.create(payload, 'entry-notes')
    const stranger = await accounts.create(payload, 'entry-stranger')
    const entry = await storeEntry(author.id, `Schlacht an der Newa ${RUN}`)
    const otherEntry = await storeEntry(
        author.id,
        `Schlacht auf dem Eis ${RUN}`
    )
    const linkedNote = await storeNote(author.id, `Newa ${RUN}`, entry.id)
    await storeNote(author.id, `Peipussee ${RUN}`, otherEntry.id)
    await storeNote(author.id, `Ohne Eintrag ${RUN}`)
    await storeNote(stranger.id, `Fremde Newa ${RUN}`, entry.id)
    const reader: User = await payload.findByID({
        collection: 'users',
        id: author.id,
    })
    const { loadReaderNotes } =
        await import('../src/app/(frontend)/notes/readerNotes')

    const { notes, loadFailed } = await Effect.runPromise(
        loadReaderNotes(reader, entry.id)
    )

    expect(loadFailed).toBe(false)
    expect(notes.map((note) => note.id)).toEqual([linkedNote.id])
    expect(notes[0]?.entry).toEqual({ id: entry.id, title: entry.title })
})
