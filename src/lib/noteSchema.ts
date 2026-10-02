import { Schema } from 'effect'

export const NoteId = Schema.Int.check(Schema.isGreaterThan(0))

export const NoteNode = Schema.StructWithRest(
    Schema.Struct({ type: Schema.String, version: Schema.Number }),
    [Schema.Record(Schema.String, Schema.Unknown)]
)
export type NoteNode = typeof NoteNode.Type

/** A note's rich text in the format Payload stores and its converters render. */
export const NoteBody = Schema.Struct({
    root: Schema.Struct({
        type: Schema.String,
        children: Schema.mutable(Schema.Array(NoteNode)),
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
export type NoteBody = typeof NoteBody.Type

/** A stored note as the client holds it. */
export const NoteView = Schema.Struct({
    id: NoteId,
    body: NoteBody,
    /** ISO timestamp of the last change. */
    updatedAt: Schema.String,
})
export type NoteView = typeof NoteView.Type

/** What the server hands a page: a visitor gets no notes. */
export const NotesLoad = Schema.Union([
    Schema.Struct({ signedIn: Schema.Literal(false) }),
    Schema.Struct({
        signedIn: Schema.Literal(true),
        notes: Schema.mutable(Schema.Array(NoteView)),
        loadFailed: Schema.Boolean,
    }),
])
export type NotesLoad = typeof NotesLoad.Type

export const NoteChange = Schema.Union([
    Schema.Struct({ stored: Schema.Literal(true), note: NoteView }),
    Schema.Struct({ stored: Schema.Literal(false) }),
])
export type NoteChange = typeof NoteChange.Type

export const NoteDeletion = Schema.Struct({ deleted: Schema.Boolean })
export type NoteDeletion = typeof NoteDeletion.Type
