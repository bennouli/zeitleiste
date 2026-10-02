import type { NoteView } from '@/lib/noteSchema'
import { describe, expect, it } from 'vitest'
import { linkedEntryOf, withNote, withoutNote } from '../note'
import { noteBody, paragraph, text } from './noteFixtures'

function noteAt(
    id: number,
    updatedAt: string,
    words = `Notiz ${id}`
): NoteView {
    return {
        id,
        updatedAt,
        body: noteBody(paragraph(text(words))),
        entry: null,
    }
}

describe('withNote', () => {
    it('puts a new note first', () => {
        const older = noteAt(1, '2026-10-01T10:00:00.000Z')
        const created = noteAt(2, '2026-10-02T10:00:00.000Z')

        const notes = [older]

        expect(withNote(notes, created)).toEqual([created, older])
    })

    it('replaces an edited note and moves it to the top', () => {
        const first = noteAt(1, '2026-10-01T10:00:00.000Z')
        const second = noteAt(2, '2026-10-01T11:00:00.000Z')
        const edited = noteAt(1, '2026-10-02T09:00:00.000Z', 'Geändert')

        const notes = [second, first]

        expect(withNote(notes, edited)).toEqual([edited, second])
    })
})

describe('withoutNote', () => {
    it('drops the note with that id', () => {
        const kept = noteAt(1, '2026-10-01T10:00:00.000Z')
        const deleted = noteAt(2, '2026-10-01T11:00:00.000Z')

        const notes = [deleted, kept]

        expect(withoutNote(notes, deleted.id)).toEqual([kept])
    })
})

describe('linkedEntryOf', () => {
    it('gives the linked entry the reader may read', () => {
        const entry = { id: 32, title: 'Mongolen erobern Kiew' }
        const linked = { ...noteAt(1, '2026-10-01T10:00:00.000Z'), entry }

        expect(linkedEntryOf(linked)).toEqual(entry)
    })

    it('treats an entry hidden from the reader, given by id only, as no link', () => {
        const hiddenEntryId = 32
        const linked = {
            ...noteAt(1, '2026-10-01T10:00:00.000Z'),
            entry: hiddenEntryId,
        }

        expect(linkedEntryOf(linked)).toBeNull()
    })
})
