import type { Note } from '@/payload-types'

/** A note's rich text in the format Payload stores and its converters render. */
export type NoteBody = Note['body']

export type NoteNode = NoteBody['root']['children'][number]

const NEW_TAB = '_blank'
const NEW_TAB_REL = 'noopener noreferrer'
const EDITOR_LINK_KEYS = new Set(['url', 'target', 'rel', 'title'])
const STORED_LINK_KEYS = new Set(['fields', 'id'])

export function childrenOf(node: NoteNode): NoteNode[] {
    const { children } = node
    return Array.isArray(children) ? children : []
}

/** The editor's state as Payload stores it: a link keeps its target under `fields`. */
export function toStoredBody(editorBody: NoteBody): NoteBody {
    return mapNodes(editorBody, (node) => {
        if (node.type !== 'link') return node
        const { url, target } = node
        return {
            ...omitKeys(node, EDITOR_LINK_KEYS),
            fields: {
                linkType: 'custom',
                newTab: target === NEW_TAB,
                url: typeof url === 'string' ? url : '',
            },
        }
    })
}

/** A stored note as the editor reads it: a link's target moves out of `fields`. */
export function toEditorBody(storedBody: NoteBody): NoteBody {
    return mapNodes(storedBody, (node) => {
        if (node.type !== 'link') return node
        const { url, newTab } = isRecord(node.fields) ? node.fields : {}
        return {
            ...omitKeys(node, STORED_LINK_KEYS),
            url: typeof url === 'string' ? url : '',
            target: newTab === true ? NEW_TAB : null,
            rel: newTab === true ? NEW_TAB_REL : null,
            title: null,
        }
    })
}

function mapNodes(
    body: NoteBody,
    mapNode: (node: NoteNode) => NoteNode
): NoteBody {
    const mapTree = (node: NoteNode): NoteNode => {
        const mapped = mapNode(node)
        return Array.isArray(mapped.children)
            ? { ...mapped, children: childrenOf(mapped).map(mapTree) }
            : mapped
    }
    return {
        ...body,
        root: { ...body.root, children: body.root.children.map(mapTree) },
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function omitKeys(node: NoteNode, keys: ReadonlySet<string>): NoteNode {
    const kept = Object.entries(node).filter(([key]) => !keys.has(key))
    return {
        type: node.type,
        version: node.version,
        ...Object.fromEntries(kept),
    }
}
