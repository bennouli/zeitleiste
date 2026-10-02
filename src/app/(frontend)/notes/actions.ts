'use server'

import type { NoteChange, NotesLoad } from '@/components/notes/NotesContext'
import config from '@payload-config'
import { Cause, Data, Effect, Exit, Schema } from 'effect'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

class NotesFailed extends Data.TaggedError('NotesFailed')<{
    readonly operation: string
    readonly cause: unknown
}> {}

class NotSignedIn extends Data.TaggedError('NotSignedIn') {}

const NoteId = Schema.Int.check(Schema.isGreaterThan(0))

const BodyNode = Schema.StructWithRest(
    Schema.Struct({ type: Schema.String, version: Schema.Number }),
    [Schema.Record(Schema.String, Schema.Unknown)]
)

const NoteBodyInput = Schema.Struct({
    root: Schema.Struct({
        type: Schema.Literal('root'),
        children: Schema.mutable(Schema.Array(BodyNode)),
        direction: Schema.NullOr(Schema.Literals(['ltr', 'rtl'])),
        format: Schema.Literals([
            'left',
            'start',
            'center',
            'right',
            'end',
            'justify',
            '',
        ]),
        indent: Schema.Number,
        version: Schema.Number,
    }),
})

const StoredNote = Schema.Struct({
    id: NoteId,
    body: NoteBodyInput,
    updatedAt: Schema.String,
})

const NOT_STORED: NoteChange = { stored: false }

/** The signed-in user's notes, most recently changed first; a visitor gets none. */
export async function listNotes(): Promise<NotesLoad> {
    const program = Effect.gen(function* () {
        const { payload, user } = yield* session
        if (user === null) return { signedIn: false } satisfies NotesLoad
        const userNotes = payloadCall('find notes', () =>
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
            Effect.flatMap(({ docs }) => decode(Schema.Array(StoredNote), docs))
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
        const noteBody = yield* decode(NoteBodyInput, body)
        const { payload, user } = yield* signedInSession
        const note = yield* payloadCall('create note', () =>
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
        const noteBody = yield* decode(NoteBodyInput, body)
        const { payload, user } = yield* signedInSession
        const note = yield* payloadCall('update note', () =>
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

export async function deleteNote(id: unknown): Promise<{ deleted: boolean }> {
    const program = Effect.gen(function* () {
        const noteId = yield* decode(NoteId, id)
        const { payload, user } = yield* signedInSession
        yield* payloadCall('delete note', () =>
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
    const payload = yield* payloadCall('load payload', () =>
        getPayload({ config })
    )
    const requestHeaders = yield* payloadCall('read headers', () => headers())
    const { user } = yield* payloadCall('authenticate', () =>
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
    return decode(StoredNote, note).pipe(
        Effect.map((decoded): NoteChange => ({ stored: true, note: decoded }))
    )
}

function payloadCall<A>(operation: string, run: () => Promise<A>) {
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

async function runAtEdge<A>(
    program: Effect.Effect<A, NotesFailed | NotSignedIn>,
    fallback: A
): Promise<A> {
    const exit = await Effect.runPromiseExit(
        program.pipe(
            Effect.tapErrorTag('NotesFailed', ({ operation, cause }) =>
                Effect.logError(`Notes: ${operation} failed`, cause)
            ),
            Effect.tapErrorTag('NotSignedIn', () =>
                Effect.logWarning('Notes: a change arrived without a session')
            ),
            Effect.orElseSucceed(() => fallback)
        )
    )
    if (Exit.isSuccess(exit)) return exit.value
    console.error(Cause.pretty(exit.cause))
    return fallback
}
