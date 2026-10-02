import type { NoteBody, NoteNode } from '@/lib/noteSchema'
import { childrenOf } from './noteBody'

export type TitledNote = {
    /** The first line with text; empty when the note has none. */
    title: string
    /** Everything after that line. */
    rest: NoteBody
}

type LineSplit = { text: string; remainder: NoteNode | null }

/** Splits a note like the iPhone's Notes app: its first line with text is the title. */
export function splitTitle(body: NoteBody): TitledNote {
    const titleSplit = splitFrom(body.root)
    return { title: titleSplit.title, rest: { ...body, root: titleSplit.root } }
}

function splitFrom(root: NoteBody['root']): {
    title: string
    root: NoteBody['root']
} {
    if (root.children.length === 0) return { title: '', root }
    const { text, remainder } = takeFirstLine(root)
    const restRoot = {
        ...root,
        children: remainder ? childrenOf(remainder) : [],
    }
    const title = text.trim()
    return title ? { title, root: restRoot } : splitFrom(restRoot)
}

function takeFirstLine(node: NoteNode): LineSplit {
    const children = childrenOf(node)
    if (!holdsBlocks(node)) return takeInlineLine(node, children)
    const [first, ...others] = children
    if (first === undefined) return { text: '', remainder: null }
    const { text, remainder } = takeFirstLine(first)
    const restChildren = remainder ? [remainder, ...others] : others
    return {
        text,
        remainder:
            restChildren.length > 0
                ? { ...node, children: restChildren }
                : null,
    }
}

function takeInlineLine(node: NoteNode, children: NoteNode[]): LineSplit {
    const breakAt = children.findIndex((child) => child.type === 'linebreak')
    const line = breakAt < 0 ? children : children.slice(0, breakAt)
    return {
        text: line.map(textOf).join(''),
        remainder:
            breakAt < 0
                ? null
                : { ...node, children: children.slice(breakAt + 1) },
    }
}

function holdsBlocks(node: NoteNode): boolean {
    return (
        node.type === 'root' ||
        node.type === 'list' ||
        childrenOf(node)[0]?.type === 'list'
    )
}

function textOf(node: NoteNode): string {
    if (node.type === 'text' && typeof node.text === 'string') return node.text
    if (node.type === 'tab') return '\t'
    return childrenOf(node).map(textOf).join('')
}
