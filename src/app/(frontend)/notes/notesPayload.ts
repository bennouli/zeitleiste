import { NoteView } from '@/lib/noteSchema'
import { Array as Arr, Data, Effect, Schema } from 'effect'

export class NotesFailed extends Data.TaggedError('NotesFailed')<{
    readonly operation: string
    readonly cause: unknown
}> {}

/** A Payload or request call that may fail, as a NotesFailed naming `operation`. */
export function attempt<A>(operation: string, run: () => Promise<A>) {
    return Effect.tryPromise({
        try: run,
        catch: (cause) => new NotesFailed({ operation, cause }),
    })
}

/** How every note leaves the server: its body, last change and the linked entry's title. */
export const NOTE_VIEW_QUERY = {
    select: { body: true, updatedAt: true, entry: true },
    depth: 1,
    populate: { entries: { title: true } },
} as const

export function decode<S extends Schema.Top>(schema: S, input: unknown) {
    return Schema.decodeUnknownEffect(schema)(input).pipe(
        Effect.mapError(
            (cause) => new NotesFailed({ operation: 'decode', cause })
        )
    )
}

/** The stored notes that decode; an unreadable one is logged and left out. */
export function readableNotes(docs: ReadonlyArray<unknown>) {
    return Effect.forEach(docs, (doc) =>
        decode(NoteView, doc).pipe(
            Effect.tapError(({ cause }) =>
                Effect.logError('Notes: a stored note is unreadable', cause)
            ),
            Effect.option
        )
    ).pipe(Effect.map(Arr.getSomes))
}
