import type { LinkedEntry, NoteView } from '@/lib/noteSchema'

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

/** The entry the note links to, if the reader may read it. */
export function linkedEntryOf(note: NoteView): LinkedEntry | null {
    return typeof note.entry === 'number' ? null : note.entry
}

function byRecentChange(notes: NoteView[]): NoteView[] {
    return notes.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
