import type { NoteChange, NoteView } from '@/lib/noteSchema'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NotesProvider, type NotesActions } from '../NotesContext'
import { useNoteCard } from '../useNoteCard'
import { noteBody, paragraph, text } from './noteFixtures'

const KIEW_ENTRY = { id: 32, title: 'Mongolen erobern Kiew' }

const KIEW: NoteView = {
    id: 7,
    updatedAt: '2026-10-01T10:00:00.000Z',
    body: noteBody(paragraph(text('Kiew 1240'))),
    entry: null,
}

const NOT_STORED: NoteChange = { stored: false, signedOut: false }

function cardActions(linkNote: NotesActions['linkNote']): NotesActions {
    return {
        createNote: async () => NOT_STORED,
        updateNote: async () => NOT_STORED,
        deleteNote: async () => ({ deleted: false, signedOut: false }),
        linkNote,
        searchEntries: async () => ({ searched: true, entries: [] }),
    }
}

function renderCard(note: NoteView, actions: NotesActions) {
    const initialLoad = { notes: [note], loadFailed: false }
    const wrapper = ({ children }: { children: ReactNode }) => (
        <NotesProvider initialLoad={initialLoad} actions={actions}>
            {children}
        </NotesProvider>
    )
    const onDeleted = vi.fn()
    return renderHook(() => useNoteCard(note, onDeleted), { wrapper })
}

describe('useNoteCard', () => {
    it('reads again once the picked entry is linked', async () => {
        const linkedKiewNote: NoteView = { ...KIEW, entry: KIEW_ENTRY }
        const linkNote = vi.fn(async () => ({
            stored: true as const,
            note: linkedKiewNote,
        }))
        const linkingActions = cardActions(linkNote)
        const { result } = renderCard(KIEW, linkingActions)

        act(() => result.current.startLinking())
        expect(result.current.mode).toBe('linking')
        await act(() => result.current.linkTo(KIEW_ENTRY))

        expect(linkNote).toHaveBeenCalledWith(KIEW.id, KIEW_ENTRY.id)
        expect(result.current.mode).toBe('reading')
    })

    it('stays in the picker when the link is not stored', async () => {
        const linkNote = async () => NOT_STORED
        const failingActions = cardActions(linkNote)
        const { result } = renderCard(KIEW, failingActions)

        act(() => result.current.startLinking())
        await act(() => result.current.linkTo(KIEW_ENTRY))

        expect(result.current.mode).toBe('linking')
    })

    it('gives the linked entry the reader may read', () => {
        const linkedKiewNote: NoteView = { ...KIEW, entry: KIEW_ENTRY }
        const quietActions = cardActions(async () => NOT_STORED)

        const { result } = renderCard(linkedKiewNote, quietActions)

        expect(result.current.linkedEntry).toEqual(KIEW_ENTRY)
    })
})
