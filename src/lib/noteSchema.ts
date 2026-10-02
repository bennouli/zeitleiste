import { Schema } from 'effect'

const DocumentId = Schema.Int.check(Schema.isGreaterThan(0))

export const NoteId = DocumentId

export const EntryId = DocumentId

export const NoteNode = Schema.StructWithRest(
    Schema.Struct({ type: Schema.String, version: Schema.Number }),
    [Schema.Record(Schema.String, Schema.Unknown)]
)
export type NoteNode = typeof NoteNode.Type

type NodeRule = {
    hasValidFields: (node: NoteNode) => boolean
    leafOrChildTypes: 'leaf' | ReadonlySet<string>
}

const BLOCK_TYPES: ReadonlySet<string> = new Set([
    'paragraph',
    'heading',
    'quote',
    'list',
])

const LINK_CONTENT_TYPES: ReadonlySet<string> = new Set([
    'text',
    'linebreak',
    'tab',
])

const INLINE_TYPES: ReadonlySet<string> = new Set([
    ...LINK_CONTENT_TYPES,
    'link',
    'autolink',
])

const anyFields = () => true

const NOTE_EDITOR_NODE_RULES: Readonly<Record<string, NodeRule>> = {
    paragraph: { hasValidFields: anyFields, leafOrChildTypes: INLINE_TYPES },
    quote: { hasValidFields: anyFields, leafOrChildTypes: INLINE_TYPES },
    heading: {
        hasValidFields: (node) => node.tag === 'h3' || node.tag === 'h4',
        leafOrChildTypes: INLINE_TYPES,
    },
    list: {
        hasValidFields: (node) =>
            (node.tag === 'ul' && node.listType === 'bullet') ||
            (node.tag === 'ol' && node.listType === 'number'),
        leafOrChildTypes: new Set(['listitem']),
    },
    listitem: {
        hasValidFields: anyFields,
        leafOrChildTypes: new Set([...INLINE_TYPES, 'list']),
    },
    link: {
        hasValidFields: hasLinkFields,
        leafOrChildTypes: LINK_CONTENT_TYPES,
    },
    autolink: {
        hasValidFields: hasLinkFields,
        leafOrChildTypes: LINK_CONTENT_TYPES,
    },
    text: {
        hasValidFields: (node) => typeof node.text === 'string',
        leafOrChildTypes: 'leaf',
    },
    linebreak: { hasValidFields: anyFields, leafOrChildTypes: 'leaf' },
    tab: { hasValidFields: anyFields, leafOrChildTypes: 'leaf' },
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

function isNoteEditorNode(
    node: unknown,
    allowedTypes: ReadonlySet<string>
): boolean {
    if (!Schema.is(NoteNode)(node) || !allowedTypes.has(node.type)) return false
    const rule = NOTE_EDITOR_NODE_RULES[node.type]
    if (rule === undefined || !rule.hasValidFields(node)) return false
    const { leafOrChildTypes } = rule
    if (leafOrChildTypes === 'leaf') return true
    return (
        Array.isArray(node.children) &&
        node.children.every((child) =>
            isNoteEditorNode(child, leafOrChildTypes)
        )
    )
}

const onlyNoteEditorNodes = Schema.makeFilter(
    (nodes: ReadonlyArray<NoteNode>) =>
        nodes.every((node) => isNoteEditorNode(node, BLOCK_TYPES)) ||
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
/** A body as a caller hands it to an action, before decoding. */
export type NoteBodyInput = typeof NoteBody.Encoded

/** An entry as a note links to it and the entry search offers it. */
export const LinkedEntry = Schema.Struct({ id: EntryId, title: Schema.String })
export type LinkedEntry = typeof LinkedEntry.Type

/** A stored note as the client holds it. */
export const NoteView = Schema.Struct({
    id: NoteId,
    body: NoteBody,
    /** ISO timestamp of the last change. */
    updatedAt: Schema.String,
    /** The linked entry; only its id when the reader may not read it. */
    entry: Schema.NullOr(Schema.Union([LinkedEntry, EntryId])),
})
export type NoteView = typeof NoteView.Type

/** The reader's notes as the page is rendered with them. */
export const NotesLoad = Schema.Struct({
    notes: Schema.mutable(Schema.Array(NoteView)),
    loadFailed: Schema.Boolean,
})
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

/** What a search for an entry to link a note to yields. */
export const EntrySearch = Schema.Union([
    Schema.Struct({
        searched: Schema.Literal(true),
        entries: Schema.Array(LinkedEntry),
    }),
    Schema.Struct({
        searched: Schema.Literal(false),
        /** The session has ended; retrying will not help. */
        signedOut: Schema.Boolean,
    }),
])
export type EntrySearch = typeof EntrySearch.Type

/** Text typed into the entry search, trimmed. */
export const EntryQuery = Schema.Trim.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(200)
)

export const NoteDeletion = Schema.Struct({
    deleted: Schema.Boolean,
    /** The session has ended; retrying will not help. */
    signedOut: Schema.Boolean,
})
export type NoteDeletion = typeof NoteDeletion.Type
