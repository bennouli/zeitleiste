'use client'

import { formattedText, LINK_CLASS } from '@/components/richTextFormat'
import type {
    DefaultNodeTypes,
    SerializedAutoLinkNode,
    SerializedHeadingNode,
    SerializedLinkNode,
    SerializedListNode,
} from '@payloadcms/richtext-lexical'
import {
    type JSXConvertersFunction,
    RichText,
} from '@payloadcms/richtext-lexical/react'
import type { NoteBody } from './noteBody'

const HEADING_CLASS: Partial<Record<SerializedHeadingNode['tag'], string>> = {
    h3: 'text-note-title font-medium',
    h4: 'text-note font-medium',
}

const LIST_CLASS: Record<SerializedListNode['listType'], string> = {
    bullet: 'list-disc',
    number: 'list-decimal',
    check: 'list-disc',
}

const SAFE_URL = /^(https?:|mailto:|\/|#)/i

const noteConverters: JSXConvertersFunction<DefaultNodeTypes> = ({
    defaultConverters,
}) => ({
    ...defaultConverters,
    paragraph: ({ node, nodesToJSX }) => (
        <p>{nodesToJSX({ nodes: node.children })}</p>
    ),
    heading: ({ node, nodesToJSX }) => {
        const Heading = node.tag
        return (
            <Heading className={HEADING_CLASS[node.tag]}>
                {nodesToJSX({ nodes: node.children })}
            </Heading>
        )
    },
    list: ({ node, nodesToJSX }) => {
        const List = node.tag
        return (
            <List className={`pl-5 ${LIST_CLASS[node.listType]}`}>
                {nodesToJSX({ nodes: node.children })}
            </List>
        )
    },
    listitem: ({ node, nodesToJSX }) => (
        <li>{nodesToJSX({ nodes: node.children })}</li>
    ),
    quote: ({ node, nodesToJSX }) => (
        <blockquote className="border-l-2 border-border pl-3">
            {nodesToJSX({ nodes: node.children })}
        </blockquote>
    ),
    link: ({ node, nodesToJSX }) => (
        <NoteLink node={node}>{nodesToJSX({ nodes: node.children })}</NoteLink>
    ),
    autolink: ({ node, nodesToJSX }) => (
        <NoteLink node={node}>{nodesToJSX({ nodes: node.children })}</NoteLink>
    ),
    text: ({ node }) => formattedText(node.text, node.format),
})

function NoteLink({
    node,
    children,
}: {
    node: SerializedLinkNode | SerializedAutoLinkNode
    children: React.ReactNode
}) {
    const { url, newTab } = node.fields
    if (!url || !SAFE_URL.test(url)) return <>{children}</>
    return (
        <a
            href={url}
            className={LINK_CLASS}
            {...(newTab && { target: '_blank', rel: 'noopener noreferrer' })}
        >
            {children}
        </a>
    )
}

/** A stored note, rendered by Payload's converters. */
export function NoteRichText({ body }: { body: NoteBody }) {
    return <RichText data={body} converters={noteConverters} disableContainer />
}
