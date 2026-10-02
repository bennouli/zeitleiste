'use server'

import {
    EntryId,
    EntryQuery,
    LinkedEntry,
    NoteBody,
    NoteId,
    NoteView,
    type EntrySearch,
    type NoteChange,
    type NoteDeletion,
    type NotesLoad,
} from '@/lib/noteSchema'
import config from '@/payload.config'
import { Cause, Data, Effect, Schema } from 'effect'
import { getPayload } from 'payload'
import { currentReader } from '../reader'
import {
    attempt,
    decode,
    NOTE_VIEW_QUERY,
    type NotesFailed,
} from './notesPayload'
import { loadReaderNotes } from './readerNotes'

class NotSignedIn extends Data.TaggedError('NotSignedIn') {}

const NOT_STORED: NoteChange = { stored: false, signedOut: false }
const SIGNED_OUT_CHANGE: NoteChange = { stored: false, signedOut: true }
const NOT_DELETED: NoteDeletion = { deleted: false, signedOut: false }
const SIGNED_OUT_DELETION: NoteDeletion = { deleted: false, signedOut: true }
const NOT_SEARCHED: EntrySearch = { searched: false, signedOut: false }
const SIGNED_OUT_SEARCH: EntrySearch = { searched: false, signedOut: true }
const NOT_LOADED: NotesLoad = { notes: [], loadFailed: true }

const ENTRY_SEARCH_LIMIT = 10

export async function createNote(body: unknown): Promise<NoteChange> {
    const program = Effect.gen(function* () {
        const noteBody = yield* decode(NoteBody, body)
        const { payload, user } = yield* signedInSession
        const note = yield* attempt('create note', () =>
            payload.create({
                collection: 'notes',
                data: { owner: user.id, body: noteBody },
                user,
                overrideAccess: false,
                ...NOTE_VIEW_QUERY,
            })
        )
        return yield* storedChange(note)
    })
    return runAtEdge(program, NOT_STORED, SIGNED_OUT_CHANGE)
}

export async function updateNote(
    id: unknown,
    body: unknown
): Promise<NoteChange> {
    const program = Effect.gen(function* () {
        const noteId = yield* decode(NoteId, id)
        const noteBody = yield* decode(NoteBody, body)
        const { payload, user } = yield* signedInSession
        const note = yield* attempt('update note', () =>
            payload.update({
                collection: 'notes',
                id: noteId,
                data: { body: noteBody },
                user,
                overrideAccess: false,
                ...NOTE_VIEW_QUERY,
            })
        )
        return yield* storedChange(note)
    })
    return runAtEdge(program, NOT_STORED, SIGNED_OUT_CHANGE)
}

export async function deleteNote(id: unknown): Promise<NoteDeletion> {
    const program = Effect.gen(function* () {
        const noteId = yield* decode(NoteId, id)
        const { payload, user } = yield* signedInSession
        yield* attempt('delete note', () =>
            payload.delete({
                collection: 'notes',
                id: noteId,
                user,
                overrideAccess: false,
            })
        )
        return { deleted: true, signedOut: false }
    })
    return runAtEdge(program, NOT_DELETED, SIGNED_OUT_DELETION)
}

/** Links the note to the entry, or removes its link when `entryId` is null. */
export async function linkNote(
    id: unknown,
    entryId: unknown
): Promise<NoteChange> {
    const program = Effect.gen(function* () {
        const noteId = yield* decode(NoteId, id)
        const linkedEntryId = yield* decode(Schema.NullOr(EntryId), entryId)
        const { payload, user } = yield* signedInSession
        if (linkedEntryId !== null)
            yield* attempt('find entry to link', () =>
                payload.findByID({
                    collection: 'entries',
                    id: linkedEntryId,
                    user,
                    overrideAccess: false,
                    select: { title: true },
                    depth: 0,
                })
            )
        const note = yield* attempt('link note', () =>
            payload.update({
                collection: 'notes',
                id: noteId,
                data: { entry: linkedEntryId },
                user,
                overrideAccess: false,
                ...NOTE_VIEW_QUERY,
            })
        )
        return yield* storedChange(note)
    })
    return runAtEdge(program, NOT_STORED, SIGNED_OUT_CHANGE)
}

/** The entries the reader may read whose title holds every word of `query`, by title. */
export async function searchEntries(query: unknown): Promise<EntrySearch> {
    const program = Effect.gen(function* () {
        const entryQuery = yield* decode(EntryQuery, query)
        const { payload, user } = yield* signedInSession
        const { docs } = yield* attempt('search entries', () =>
            payload.find({
                collection: 'entries',
                where: { title: { like: entryQuery } },
                user,
                overrideAccess: false,
                select: { title: true },
                sort: 'title',
                limit: ENTRY_SEARCH_LIMIT,
                depth: 0,
            })
        )
        const entries = yield* decode(Schema.Array(LinkedEntry), docs)
        return { searched: true, entries } satisfies EntrySearch
    })
    return runAtEdge(program, NOT_SEARCHED, SIGNED_OUT_SEARCH)
}

/** The reader's own notes linked to the entry, most recently changed first. */
export async function listEntryNotes(entryId: unknown): Promise<NotesLoad> {
    const program = Effect.gen(function* () {
        const linkedEntryId = yield* decode(EntryId, entryId)
        const { user } = yield* signedInSession
        return yield* loadReaderNotes(user, linkedEntryId)
    })
    return runAtEdge(program, NOT_LOADED, NOT_LOADED)
}

const signedInSession = Effect.gen(function* () {
    const reader = yield* attempt('authenticate', () => currentReader())
    if (reader === null) return yield* new NotSignedIn()
    const payload = yield* attempt('load payload', () => getPayload({ config }))
    return { payload, user: reader }
})

function storedChange(note: unknown) {
    return decode(NoteView, note).pipe(
        Effect.map((storedNote): NoteChange => ({
            stored: true,
            note: storedNote,
        }))
    )
}

function runAtEdge<A>(
    program: Effect.Effect<A, NotesFailed | NotSignedIn>,
    fallback: A,
    signedOutAnswer: A
): Promise<A> {
    return Effect.runPromise(
        program.pipe(
            Effect.tapErrorTag('NotesFailed', ({ operation, cause }) =>
                Effect.logError(`Notes: ${operation} failed`, cause)
            ),
            Effect.catchTag('NotSignedIn', () =>
                Effect.logWarning(
                    'Notes: a change arrived without a session'
                ).pipe(Effect.as(signedOutAnswer))
            ),
            Effect.catchCause((cause) =>
                Cause.hasFails(cause)
                    ? Effect.succeed(fallback)
                    : Effect.logError('Notes: defect', cause).pipe(
                          Effect.as(fallback)
                      )
            )
        )
    )
}
