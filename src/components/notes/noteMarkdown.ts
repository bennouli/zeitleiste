import { LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import {
    BOLD_ITALIC_STAR,
    BOLD_ITALIC_UNDERSCORE,
    BOLD_STAR,
    BOLD_UNDERSCORE,
    type ElementTransformer,
    ITALIC_STAR,
    ITALIC_UNDERSCORE,
    LINK,
    ORDERED_LIST,
    QUOTE,
    type Transformer,
    UNORDERED_LIST,
} from '@lexical/markdown'
import {
    $createHeadingNode,
    $isHeadingNode,
    HeadingNode,
    QuoteNode,
} from '@lexical/rich-text'

/** A post's body allows `h3` and `h4` only; notes share its editor config. */
const HEADING_TAG_BY_MARK = { '#': 'h3', '##': 'h4' } as const

const HEADING_MARK_BY_TAG: Record<string, string> = { h3: '#', h4: '##' }

const NOTE_HEADING: ElementTransformer = {
    dependencies: [HeadingNode],
    export: (node, exportChildren) =>
        $isHeadingNode(node)
            ? `${HEADING_MARK_BY_TAG[node.getTag()] ?? '##'} ${exportChildren(node)}`
            : null,
    regExp: /^(##?)\s/,
    replace: (parentNode, children, match, isImport) => {
        const mark = match[1] === '#' ? '#' : '##'
        const heading = $createHeadingNode(HEADING_TAG_BY_MARK[mark])
        heading.append(...children)
        parentNode.replace(heading)
        if (!isImport) heading.select(0, 0)
    },
    type: 'element',
}

/** The Markdown a note understands: what a post's editor can store. */
export const NOTE_TRANSFORMERS: Transformer[] = [
    NOTE_HEADING,
    QUOTE,
    UNORDERED_LIST,
    ORDERED_LIST,
    BOLD_ITALIC_STAR,
    BOLD_ITALIC_UNDERSCORE,
    BOLD_STAR,
    BOLD_UNDERSCORE,
    ITALIC_STAR,
    ITALIC_UNDERSCORE,
    LINK,
]

export const NOTE_NODES = [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    LinkNode,
]
