'use server'

import {
    NoteBody,
    NoteId,
    NoteView,
    type NoteChange,
    type NoteDeletion,
} from '@/lib/noteSchema'
import config from '@/payload.config'
import { Cause, Data, Effect } from 'effect'
import { getPayload } from 'payload'
import { currentReader } from '../reader'
import { attempt, decode, type NotesFailed } from './notesPayload'

class NotSignedIn extends Data.TaggedError('NotSignedIn') {}

const NOT_STORED: NoteChange = { stored: false, signedOut: false }
const SIGNED_OUT_CHANGE: NoteChange = { stored: false, signedOut: true }
const NOT_DELETED: NoteDeletion = { deleted: false, signedOut: false }
const SIGNED_OUT_DELETION: NoteDeletion = { deleted: false, signedOut: true }

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
                depth: 0,
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
                depth: 0,
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
