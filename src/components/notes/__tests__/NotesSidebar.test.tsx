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
import type { NoteView } from '../note'
import { NotesProvider, type NotesActions } from '../NotesContext'
import { NotesSidebar } from '../NotesSidebar'
import { PRIVATE_UNDER_TESTS } from '../useSidebarCollapsed'
import { noteBody, paragraph, text } from './noteFixtures'

const KIEW: NoteView = {
    id: 7,
    updatedAt: '2026-10-01T10:00:00.000Z',
    body: noteBody(paragraph(text('Kiew 1240')), paragraph(text('Mongolen'))),
}

const NOWGOROD: NoteView = {
    id: 8,
    updatedAt: '2026-10-02T10:00:00.000Z',
    body: noteBody(paragraph(text('Nowgorod'))),
}

function fakeActions(overrides: Partial<NotesActions> = {}): NotesActions {
    return {
        listNotes: async () => ({ signedIn: true, notes: [NOWGOROD, KIEW] }),
        createNote: async () => ({ stored: false }),
        updateNote: async () => ({ stored: false }),
        deleteNote: async () => ({ deleted: true }),
        ...overrides,
    }
}

function renderSidebar(actions: NotesActions) {
    return render(
        <NotesProvider actions={actions}>
            <NotesSidebar />
        </NotesProvider>,
        { wrapper: inLocale('de') }
    )
}

afterEach(() => {
    window.localStorage.clear()
})

describe('NotesSidebar', () => {
    it('renders nothing for a visitor', async () => {
        const listNotes = vi.fn(async () => ({ signedIn: false }) as const)
        const visitorActions = fakeActions({ listNotes })

        const { container } = renderSidebar(visitorActions)

        await waitFor(() => expect(listNotes).toHaveBeenCalled())
        expect(container).toBeEmptyDOMElement()
    })

    it('lists the notes with their first line as title, newest first', async () => {
        renderSidebar(fakeActions())

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
        const { unmount } = renderSidebar(fakeActions())
        fireEvent.click(
            await screen.findByRole('button', { name: 'Notizen ausblenden' })
        )
        unmount()

        renderSidebar(fakeActions())

        const expand = await screen.findByRole('button', {
            name: 'Notizen einblenden',
        })
        expect(expand).toHaveAttribute('aria-expanded', 'false')
        expect(
            window.localStorage.getItem(PRIVATE_UNDER_TESTS.STORAGE_KEY)
        ).toBe('collapsed')
    })

    it('deletes a note only after confirmation', async () => {
        const deleteNote = vi.fn(async () => ({ deleted: true }))
        renderSidebar(fakeActions({ deleteNote }))

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
        renderSidebar(fakeActions({ updateNote }))

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
    })

    it('says so when a change fails', async () => {
        const deleteNote = vi.fn(async () => {
            throw new Error('offline')
        })
        renderSidebar(fakeActions({ deleteNote }))

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

        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(screen.getByText('Kiew 1240')).toBeInTheDocument()
    })
})
