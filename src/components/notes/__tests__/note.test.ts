import { describe, expect, it } from 'vitest'
import { withNote, withoutNote, type NoteView } from '../note'
import { noteBody, paragraph, text } from './noteFixtures'

function noteAt(
    id: number,
    updatedAt: string,
    words = `Notiz ${id}`
): NoteView {
    return { id, updatedAt, body: noteBody(paragraph(text(words))) }
}

describe('withNote', () => {
    it('puts a new note first', () => {
        const older = noteAt(1, '2026-10-01T10:00:00.000Z')
        const created = noteAt(2, '2026-10-02T10:00:00.000Z')

        expect(withNote([older], created)).toEqual([created, older])
    })

    it('replaces an edited note and moves it to the top', () => {
        const first = noteAt(1, '2026-10-01T10:00:00.000Z')
        const second = noteAt(2, '2026-10-01T11:00:00.000Z')
        const edited = noteAt(1, '2026-10-02T09:00:00.000Z', 'Geändert')

        expect(withNote([second, first], edited)).toEqual([edited, second])
    })
})

describe('withoutNote', () => {
    it('drops the note with that id', () => {
        const kept = noteAt(1, '2026-10-01T10:00:00.000Z')
        const deleted = noteAt(2, '2026-10-01T11:00:00.000Z')

        expect(withoutNote([deleted, kept], 2)).toEqual([kept])
    })
})
