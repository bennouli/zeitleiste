import type {
    NoteChange,
    NoteDeletion,
    NotesLoad,
    NoteView,
} from '@/lib/noteSchema'
import { expectNoAxeViolations } from '@/test/axe'
import { inLocale } from '@/test/i18n'
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotesProvider, type NotesActions } from '../NotesContext'
import { NotesSidebar } from '../NotesSidebar'
import { PRIVATE_UNDER_TESTS } from '../useSidebarCollapsed'
import { noteBody, paragraph, text } from './noteFixtures'

const KIEW: NoteView = {
    id: 7,
    updatedAt: '2026-10-01T10:00:00.000Z',
    entry: null,
    body: noteBody(paragraph(text('Kiew 1240')), paragraph(text('Mongolen'))),
}

const NOWGOROD: NoteView = {
    id: 8,
    updatedAt: '2026-10-02T10:00:00.000Z',
    entry: null,
    body: noteBody(paragraph(text('Nowgorod'))),
}

function fakeActions(overrides: Partial<NotesActions> = {}): NotesActions {
    return {
        createNote: async () => ({ stored: false, signedOut: false }),
        updateNote: async () => ({ stored: false, signedOut: false }),
        deleteNote: async () => ({ deleted: true, signedOut: false }),
        linkNote: async () => ({ stored: false, signedOut: false }),
        searchEntries: async () => ({ searched: true, entries: [] }),
        ...overrides,
    }
}

const LOADED: NotesLoad = { notes: [NOWGOROD, KIEW], loadFailed: false }

function renderSidebar(actions: NotesActions, initialLoad = LOADED) {
    return render(
        <NotesProvider initialLoad={initialLoad} actions={actions}>
            <NotesSidebar />
        </NotesProvider>,
        { wrapper: inLocale('de') }
    )
}

afterEach(() => {
    window.localStorage.clear()
})

describe('NotesSidebar', () => {
    it('renders nothing outside a reader’s notes provider', () => {
        const { container } = render(<NotesSidebar />, {
            wrapper: inLocale('de'),
        })

        expect(container).toBeEmptyDOMElement()
    })

    it('lists the notes with their first line as title, newest first', async () => {
        const signedInActions = fakeActions()
        renderSidebar(signedInActions)

        const sidebar = await screen.findByRole('complementary', {
            name: 'Notizen',
        })

        expect(
            within(sidebar)
                .getAllByRole('heading', { level: 3 })
                .map((title) => title.textContent)
        ).toEqual(['Nowgorod', 'Kiew 1240'])
        expect(within(sidebar).getByText('Mongolen')).toBeInTheDocument()
        await expectNoAxeViolations(sidebar)
    })

    it('remembers the collapse across a reload', async () => {
        const firstVisit = fakeActions()
        const reload = fakeActions()
        const { unmount } = renderSidebar(firstVisit)
        fireEvent.click(
            await screen.findByRole('button', { name: 'Notizen ausblenden' })
        )
        unmount()

        renderSidebar(reload)

        const expand = await screen.findByRole('button', {
            name: 'Notizen einblenden',
        })
        expect(expand).toHaveAttribute('aria-expanded', 'false')
        expect(
            window.localStorage.getItem(PRIVATE_UNDER_TESTS.STORAGE_KEY)
        ).toBe('collapsed')
    })

    it('deletes a note only after confirmation', async () => {
        const deleteNote = vi.fn(async () => ({
            deleted: true,
            signedOut: false,
        }))
        const deletingActions = fakeActions({ deleteNote })
        renderSidebar(deletingActions)

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Notiz löschen: Kiew 1240',
            })
        )
        expect(deleteNote).not.toHaveBeenCalled()
        fireEvent.click(
            within(
                screen.getByRole('group', { name: 'Diese Notiz löschen?' })
            ).getByRole('button', { name: 'Löschen' })
        )

        await waitFor(() =>
            expect(screen.queryByText('Kiew 1240')).not.toBeInTheDocument()
        )
        expect(deleteNote).toHaveBeenCalledWith(7)
    })

    it('puts the focus on cancel when asking to delete, and back on the button after', async () => {
        const quietActions = fakeActions()
        renderSidebar(quietActions)
        const deleteButton = await screen.findByRole('button', {
            name: 'Notiz löschen: Kiew 1240',
        })

        fireEvent.click(deleteButton)
        const cancel = within(
            screen.getByRole('group', { name: 'Diese Notiz löschen?' })
        ).getByRole('button', { name: 'Abbrechen' })
        expect(cancel).toHaveFocus()
        fireEvent.click(cancel)

        expect(
            screen.getByRole('button', { name: 'Notiz löschen: Kiew 1240' })
        ).toHaveFocus()
    })

    it('edits a note in place and moves it to the top', async () => {
        const edited: NoteView = {
            ...KIEW,
            updatedAt: '2026-10-03T10:00:00.000Z',
            body: noteBody(paragraph(text('Kiew 1240, geändert'))),
        }
        const updateNote = vi.fn(async () => ({
            stored: true as const,
            note: edited,
        }))
        const updatingActions = fakeActions({ updateNote })
        renderSidebar(updatingActions)

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Notiz bearbeiten: Kiew 1240',
            })
        )
        fireEvent.click(
            within(
                screen.getByRole('group', {
                    name: 'Notiz bearbeiten: Kiew 1240',
                })
            ).getByRole('button', { name: 'Sichern' })
        )

        await waitFor(() =>
            expect(
                screen
                    .getAllByRole('heading', { level: 3 })
                    .map((title) => title.textContent)
            ).toEqual(['Kiew 1240, geändert', 'Nowgorod'])
        )
        expect(updateNote).toHaveBeenCalledWith(7, expect.anything())
        expect(
            screen.getByRole('button', {
                name: 'Notiz bearbeiten: Kiew 1240, geändert',
            })
        ).toHaveFocus()
    })

    it('says so when a change fails', async () => {
        const deleteNote = vi.fn(async () => {
            throw new Error('offline')
        })
        const offlineActions = fakeActions({ deleteNote })
        renderSidebar(offlineActions)

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Notiz löschen: Kiew 1240',
            })
        )
        fireEvent.click(
            within(
                screen.getByRole('group', { name: 'Diese Notiz löschen?' })
            ).getByRole('button', { name: 'Löschen' })
        )

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Die Notiz konnte nicht gelöscht werden.'
        )
        expect(screen.getByText('Kiew 1240')).toBeInTheDocument()
    })

    it('tells a signed-in user when the notes could not be loaded', async () => {
        const failedLoad: NotesLoad = { notes: [], loadFailed: true }
        const quietActions = fakeActions()

        renderSidebar(quietActions, failedLoad)

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Deine Notizen konnten nicht geladen werden.'
        )
    })

    it('keeps Escape on a sidebar control from closing an open post', async () => {
        const signedInActions = fakeActions()
        const escape = { key: 'Escape' }
        const reachedWindow = vi.fn((e: KeyboardEvent) => e.defaultPrevented)
        window.addEventListener('keydown', reachedWindow)
        renderSidebar(signedInActions)
        const collapse = await screen.findByRole('button', {
            name: 'Notizen ausblenden',
        })

        fireEvent.keyDown(collapse, escape)

        window.removeEventListener('keydown', reachedWindow)
        expect(reachedWindow).toHaveReturnedWith(true)
    })

    it('asks to sign in again when the session has ended', async () => {
        const updateNote = async (): Promise<NoteChange> => ({
            stored: false,
            signedOut: true,
        })
        const signedOutActions = fakeActions({ updateNote })
        renderSidebar(signedOutActions)

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Notiz bearbeiten: Kiew 1240',
            })
        )
        fireEvent.click(
            within(
                screen.getByRole('group', {
                    name: 'Notiz bearbeiten: Kiew 1240',
                })
            ).getByRole('button', { name: 'Sichern' })
        )

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Du bist nicht mehr angemeldet.'
        )
    })

    it('asks to sign in again when the session ended before a delete', async () => {
        const deleteNote = async (): Promise<NoteDeletion> => ({
            deleted: false,
            signedOut: true,
        })
        const signedOutActions = fakeActions({ deleteNote })
        renderSidebar(signedOutActions)

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Notiz löschen: Kiew 1240',
            })
        )
        fireEvent.click(
            within(
                screen.getByRole('group', { name: 'Diese Notiz löschen?' })
            ).getByRole('button', { name: 'Löschen' })
        )

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Du bist nicht mehr angemeldet.'
        )
        expect(screen.getByText('Kiew 1240')).toBeInTheDocument()
    })
})

describe('linking a note to an entry', () => {
    const NOWGOROD_ENTRY = { id: 31, title: 'Nowgorod wird Republik' }
    const KIEW_ENTRY = { id: 32, title: 'Mongolen erobern Kiew' }

    function pickerOf(noteTitle: string) {
        return screen.getByRole('group', {
            name: `Notiz mit einem Eintrag verknüpfen: ${noteTitle}`,
        })
    }

    it('searches the entries by title and links the picked one', async () => {
        const searchEntries = vi.fn(async () => ({
            searched: true as const,
            entries: [KIEW_ENTRY, NOWGOROD_ENTRY],
        }))
        const linked: NoteView = {
            ...KIEW,
            updatedAt: '2026-10-03T10:00:00.000Z',
            entry: KIEW_ENTRY,
        }
        const linkNote = vi.fn(async () => ({
            stored: true as const,
            note: linked,
        }))
        const linkingActions = fakeActions({ searchEntries, linkNote })
        renderSidebar(linkingActions)

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Notiz mit einem Eintrag verknüpfen: Kiew 1240',
            })
        )
        const search = within(pickerOf('Kiew 1240')).getByRole('searchbox', {
            name: 'Eintrag suchen',
        })
        expect(search).toHaveFocus()
        const typedKiew = { target: { value: '  Kiew ' } }
        fireEvent.change(search, typedKiew)
        fireEvent.click(
            await within(pickerOf('Kiew 1240')).findByRole('button', {
                name: KIEW_ENTRY.title,
            })
        )

        const unlink = await screen.findByRole('button', {
            name: `Verknüpfung mit ${KIEW_ENTRY.title} entfernen`,
        })
        expect(searchEntries).toHaveBeenCalledWith('Kiew')
        expect(linkNote).toHaveBeenCalledWith(KIEW.id, KIEW_ENTRY.id)
        expect(
            screen
                .getAllByRole('article')
                .map((note) => within(note).queryByText(KIEW_ENTRY.title))
        ).toEqual([expect.anything(), null])
        await waitFor(() => expect(unlink).toHaveFocus())
    })

    it('says when no entry matches', async () => {
        const searchEntries = async () => ({
            searched: true as const,
            entries: [],
        })
        const emptyActions = fakeActions({ searchEntries })
        renderSidebar(emptyActions)

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Notiz mit einem Eintrag verknüpfen: Kiew 1240',
            })
        )
        const typedByzanz = { target: { value: 'Byzanz' } }
        fireEvent.change(
            within(pickerOf('Kiew 1240')).getByRole('searchbox'),
            typedByzanz
        )

        await waitFor(() =>
            expect(
                within(pickerOf('Kiew 1240')).getByRole('status')
            ).toHaveTextContent('Kein Eintrag gefunden.')
        )
        await expectNoAxeViolations(pickerOf('Kiew 1240'))
    })

    it('removes the link and offers linking again', async () => {
        const linkedKiew: NoteView = { ...KIEW, entry: KIEW_ENTRY }
        const unlinked: NoteView = {
            ...KIEW,
            updatedAt: '2026-10-03T10:00:00.000Z',
        }
        const linkNote = vi.fn(async () => ({
            stored: true as const,
            note: unlinked,
        }))
        const unlinkingActions = fakeActions({ linkNote })
        const linkedLoad: NotesLoad = {
            notes: [NOWGOROD, linkedKiew],
            loadFailed: false,
        }
        renderSidebar(unlinkingActions, linkedLoad)

        fireEvent.click(
            await screen.findByRole('button', {
                name: `Verknüpfung mit ${KIEW_ENTRY.title} entfernen`,
            })
        )

        const linkAgain = await screen.findByRole('button', {
            name: 'Notiz mit einem Eintrag verknüpfen: Kiew 1240',
        })
        expect(linkNote).toHaveBeenCalledWith(KIEW.id, null)
        expect(screen.queryByText(KIEW_ENTRY.title)).not.toBeInTheDocument()
        await waitFor(() => expect(linkAgain).toHaveFocus())
    })

    it('says so when the link could not be saved', async () => {
        const searchEntries = async () => ({
            searched: true as const,
            entries: [KIEW_ENTRY],
        })
        const linkNote = async (): Promise<NoteChange> => ({
            stored: false,
            signedOut: false,
        })
        const failingActions = fakeActions({ searchEntries, linkNote })
        renderSidebar(failingActions)

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Notiz mit einem Eintrag verknüpfen: Kiew 1240',
            })
        )
        const typedKiew = { target: { value: 'Kiew' } }
        fireEvent.change(
            within(pickerOf('Kiew 1240')).getByRole('searchbox'),
            typedKiew
        )
        fireEvent.click(
            await within(pickerOf('Kiew 1240')).findByRole('button', {
                name: KIEW_ENTRY.title,
            })
        )

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Die Verknüpfung konnte nicht gesichert werden.'
        )
        expect(pickerOf('Kiew 1240')).toBeInTheDocument()
    })
})
