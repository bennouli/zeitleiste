import { Schema } from 'effect'

export const NoteId = Schema.Int.check(Schema.isGreaterThan(0))

export const NoteNode = Schema.StructWithRest(
    Schema.Struct({ type: Schema.String, version: Schema.Number }),
    [Schema.Record(Schema.String, Schema.Unknown)]
)
export type NoteNode = typeof NoteNode.Type

type NodeRule = {
    hasValidFields: (node: NoteNode) => boolean
    /** The node types it may hold; null for a leaf. */
    childTypes: ReadonlySet<string> | null
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
    paragraph: { hasValidFields: anyFields, childTypes: INLINE_TYPES },
    quote: { hasValidFields: anyFields, childTypes: INLINE_TYPES },
    heading: {
        hasValidFields: (node) => node.tag === 'h3' || node.tag === 'h4',
        childTypes: INLINE_TYPES,
    },
    list: {
        hasValidFields: (node) =>
            (node.tag === 'ul' && node.listType === 'bullet') ||
            (node.tag === 'ol' && node.listType === 'number'),
        childTypes: new Set(['listitem']),
    },
    listitem: {
        hasValidFields: anyFields,
        childTypes: new Set([...INLINE_TYPES, 'list']),
    },
    link: { hasValidFields: hasLinkFields, childTypes: LINK_CONTENT_TYPES },
    autolink: { hasValidFields: hasLinkFields, childTypes: LINK_CONTENT_TYPES },
    text: {
        hasValidFields: (node) => typeof node.text === 'string',
        childTypes: null,
    },
    linebreak: { hasValidFields: anyFields, childTypes: null },
    tab: { hasValidFields: anyFields, childTypes: null },
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
    const { childTypes } = rule
    if (childTypes === null) return true
    return (
        Array.isArray(node.children) &&
        node.children.every((child) => isNoteEditorNode(child, childTypes))
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
