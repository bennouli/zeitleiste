import type { NotesLoad } from '@/lib/noteSchema'
import type { User } from '@/payload-types'
import config from '@/payload.config'
import { Effect } from 'effect'
import { getPayload } from 'payload'
import { attempt, NOTE_VIEW_QUERY, readableNotes } from './notesPayload'

/**
 * The reader's notes, most recently changed first; with `entryId`, only those linked to that entry.
 * A failed load is reported, never thrown.
 */
export const loadReaderNotes = Effect.fn('loadReaderNotes')(
    function* (reader: User, entryId?: number) {
        const payload = yield* attempt('load payload', () =>
            getPayload({ config })
        )
        const { docs } = yield* attempt('find notes', () =>
            payload.find({
                collection: 'notes',
                where:
                    entryId === undefined ? {} : { entry: { equals: entryId } },
                user: reader,
                overrideAccess: false,
                sort: '-updatedAt',
                pagination: false,
                ...NOTE_VIEW_QUERY,
            })
        )
        const notes = yield* readableNotes(docs)
        return { notes: [...notes], loadFailed: false } satisfies NotesLoad
    },
    Effect.catchTag('NotesFailed', ({ operation, cause }) =>
        Effect.logError(`Notes: ${operation} failed`, cause).pipe(
            Effect.as({ notes: [], loadFailed: true } satisfies NotesLoad)
        )
    )
)
