import type { NoteBody, NoteNode } from '@/lib/noteSchema'

export function text(value: string, format = 0): NoteNode {
    return { type: 'text', version: 1, text: value, format }
}

export const lineBreak: NoteNode = { type: 'linebreak', version: 1 }

export function paragraph(...children: NoteNode[]): NoteNode {
    return { type: 'paragraph', version: 1, children }
}

export function heading(tag: 'h3' | 'h4', ...children: NoteNode[]): NoteNode {
    return { type: 'heading', version: 1, tag, children }
}

export function list(...items: NoteNode[][]): NoteNode {
    return {
        type: 'list',
        version: 1,
        listType: 'bullet',
        tag: 'ul',
        start: 1,
        children: items.map((children) => ({
            type: 'listitem',
            version: 1,
            children,
        })),
    }
}

export function noteBody(...children: NoteNode[]): NoteBody {
    return {
        root: {
            type: 'root',
            direction: null,
            format: '',
            indent: 0,
            version: 1,
            children,
        },
    }
}
