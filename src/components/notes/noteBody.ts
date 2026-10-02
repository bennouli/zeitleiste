import type { NoteBody, NoteNode } from '@/lib/noteSchema'
import type { SerializedEditorState } from 'lexical'

const NEW_TAB = '_blank'
const NEW_TAB_REL = 'noopener noreferrer'
const EDITOR_LINK_KEYS = new Set(['url', 'target', 'rel', 'title'])
const STORED_LINK_KEYS = new Set(['fields', 'id'])
const LINK_TYPES = new Set(['link', 'autolink'])

export function childrenOf(node: NoteNode): NoteNode[] {
    const { children } = node
    return Array.isArray(children) ? children : []
}

export function toNoteBody({ root }: SerializedEditorState): NoteBody {
    return {
        root: { ...root, children: root.children.map((node) => ({ ...node })) },
    }
}

export function toStoredBody(editorBody: NoteBody): NoteBody {
    return mapNodes(editorBody, (node) => {
        if (!isLink(node)) return node
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

export function toEditorBody(storedBody: NoteBody): NoteBody {
    return mapNodes(storedBody, (node) => {
        if (!isLink(node)) return node
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
        const mappedNode = mapNode(node)
        return Array.isArray(mappedNode.children)
            ? { ...mappedNode, children: childrenOf(mappedNode).map(mapTree) }
            : mappedNode
    }
    return {
        ...body,
        root: { ...body.root, children: body.root.children.map(mapTree) },
    }
}

function isLink(node: NoteNode): boolean {
    return LINK_TYPES.has(node.type)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function omitKeys(node: NoteNode, keys: ReadonlySet<string>): NoteNode {
    const keptEntries = Object.entries(node).filter(([key]) => !keys.has(key))
    return {
        type: node.type,
        version: node.version,
        ...Object.fromEntries(keptEntries),
    }
}
