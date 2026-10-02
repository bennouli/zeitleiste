import { Schema } from 'effect'

export const NoteId = Schema.Int.check(Schema.isGreaterThan(0))

export const NoteNode = Schema.StructWithRest(
    Schema.Struct({ type: Schema.String, version: Schema.Number }),
    [Schema.Record(Schema.String, Schema.Unknown)]
)
export type NoteNode = typeof NoteNode.Type

const isAnyNode = () => true

const NOTE_EDITOR_NODE_CHECKS: Readonly<
    Record<string, (node: NoteNode) => boolean>
> = {
    paragraph: isAnyNode,
    quote: isAnyNode,
    listitem: isAnyNode,
    linebreak: isAnyNode,
    tab: isAnyNode,
    text: (node) => typeof node.text === 'string',
    heading: (node) => node.tag === 'h3' || node.tag === 'h4',
    list: (node) =>
        (node.tag === 'ul' && node.listType === 'bullet') ||
        (node.tag === 'ol' && node.listType === 'number'),
    link: hasLinkFields,
    autolink: hasLinkFields,
}

function hasLinkFields(node: NoteNode): boolean {
    const { fields } = node
    return (
        typeof fields === 'object' &&
        fields !== null &&
        'url' in fields &&
        typeof fields.url === 'string'
    )
}

function holdsOnlyNoteEditorNodes(nodes: ReadonlyArray<unknown>): boolean {
    return nodes.every(
        (node) =>
            Schema.is(NoteNode)(node) &&
            (NOTE_EDITOR_NODE_CHECKS[node.type]?.(node) ?? false) &&
            holdsOnlyNoteEditorNodes(
                Array.isArray(node.children) ? node.children : []
            )
    )
}

const onlyNoteEditorNodes = Schema.makeFilter(
    (nodes: ReadonlyArray<NoteNode>) =>
        holdsOnlyNoteEditorNodes(nodes) ||
        'a note holds only the nodes noteEditor writes',
    { title: 'noteEditor nodes' }
)

/** A note's rich text in the format Payload stores and its converters render. */
export const NoteBody = Schema.Struct({
    root: Schema.Struct({
        type: Schema.String.check(
            Schema.makeFilter((type) => type === 'root' || 'expected root')
        ),
        children: Schema.mutable(Schema.Array(NoteNode)).check(
            onlyNoteEditorNodes
        ),
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
    Schema.Struct({
        stored: Schema.Literal(false),
        /** The session has ended; retrying will not help. */
        signedOut: Schema.Boolean,
    }),
])
export type NoteChange = typeof NoteChange.Type

export const NoteDeletion = Schema.Struct({
    deleted: Schema.Boolean,
    /** The session has ended; retrying will not help. */
    signedOut: Schema.Boolean,
})
export type NoteDeletion = typeof NoteDeletion.Type
