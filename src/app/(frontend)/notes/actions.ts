'use server'

import {
    NoteBody,
    NoteId,
    NoteView,
    type NoteChange,
    type NoteDeletion,
    type NotesLoad,
} from '@/components/notes/noteSchema'
import config from '@/payload.config'
import { Cause, Data, Effect, Schema } from 'effect'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

class NotesFailed extends Data.TaggedError('NotesFailed')<{
    readonly operation: string
    readonly cause: unknown
}> {}

class NotSignedIn extends Data.TaggedError('NotSignedIn') {}

const NOT_STORED: NoteChange = { stored: false }

/** The signed-in user's notes, most recently changed first; a visitor gets none. */
export async function listNotes(): Promise<NotesLoad> {
    const program = Effect.gen(function* () {
        const { payload, user } = yield* session
        if (user === null) return { signedIn: false } satisfies NotesLoad
        const userNotes = attempt('find notes', () =>
            payload.find({
                collection: 'notes',
                user,
                overrideAccess: false,
                sort: '-updatedAt',
                depth: 0,
                pagination: false,
                select: { body: true, updatedAt: true },
            })
        ).pipe(
            Effect.flatMap(({ docs }) => decode(Schema.Array(NoteView), docs))
        )
        return yield* userNotes.pipe(
            Effect.map((notes): NotesLoad => ({
                signedIn: true,
                notes: [...notes],
                loadFailed: false,
            })),
            Effect.tapError(({ operation, cause }) =>
                Effect.logError(`Notes: ${operation} failed`, cause)
            ),
            Effect.orElseSucceed((): NotesLoad => ({
                signedIn: true,
                notes: [],
                loadFailed: true,
            }))
        )
    })
    return runAtEdge(program, { signedIn: false })
}

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
    return runAtEdge(program, NOT_STORED)
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
    return runAtEdge(program, NOT_STORED)
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
        return { deleted: true }
    })
    return runAtEdge(program, { deleted: false })
}

const session = Effect.gen(function* () {
    const payload = yield* attempt('load payload', () => getPayload({ config }))
    const requestHeaders = yield* attempt('read headers', () => headers())
    const { user } = yield* attempt('authenticate', () =>
        payload.auth({ headers: requestHeaders })
    )
    return { payload, user }
})

const signedInSession = session.pipe(
    Effect.flatMap(({ payload, user }) =>
        user === null
            ? Effect.fail(new NotSignedIn())
            : Effect.succeed({ payload, user })
    )
)

function storedChange(note: unknown) {
    return decode(NoteView, note).pipe(
        Effect.map((storedNote): NoteChange => ({
            stored: true,
            note: storedNote,
        }))
    )
}

function attempt<A>(operation: string, run: () => Promise<A>) {
    return Effect.tryPromise({
        try: run,
        catch: (cause) => new NotesFailed({ operation, cause }),
    })
}

function decode<S extends Schema.Top>(schema: S, input: unknown) {
    return Schema.decodeUnknownEffect(schema)(input).pipe(
        Effect.mapError(
            (cause) => new NotesFailed({ operation: 'decode', cause })
        )
    )
}

function runAtEdge<A>(
    program: Effect.Effect<A, NotesFailed | NotSignedIn>,
    fallback: A
): Promise<A> {
    return Effect.runPromise(
        program.pipe(
            Effect.tapErrorTag('NotesFailed', ({ operation, cause }) =>
                Effect.logError(`Notes: ${operation} failed`, cause)
            ),
            Effect.tapErrorTag('NotSignedIn', () =>
                Effect.logWarning('Notes: a change arrived without a session')
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
