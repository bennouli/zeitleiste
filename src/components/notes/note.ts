import type { NoteView } from './noteSchema'

export type { NoteView } from './noteSchema'

/** The notes with `note` added or replaced, most recently changed first. */
export function withNote(notes: NoteView[], note: NoteView): NoteView[] {
    return byRecentChange([
        note,
        ...notes.filter((other) => other.id !== note.id),
    ])
}

export function withoutNote(notes: NoteView[], id: number): NoteView[] {
    return notes.filter((note) => note.id !== id)
}

function byRecentChange(notes: NoteView[]): NoteView[] {
    return notes.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
