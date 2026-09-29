import type { PostBody } from '@/lib/richText'
import type {
    DefaultNodeTypes,
    SerializedHeadingNode,
    SerializedLinkNode,
    SerializedListNode,
} from '@payloadcms/richtext-lexical'
import { IS_BOLD, IS_ITALIC } from '@payloadcms/richtext-lexical/lexical'
import {
    type JSXConverterArgs,
    type JSXConvertersFunction,
    RichText,
} from '@payloadcms/richtext-lexical/react'

const READING_CLASS = 'text-body text-pretty'

const LINK_CLASS =
    'underline decoration-fg-muted underline-offset-2 hover:decoration-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

const HEADING_CLASS: Partial<Record<SerializedHeadingNode['tag'], string>> = {
    h3: 'pt-3 text-lead font-medium',
    h4: 'pt-1.5 text-body font-medium',
}

const LIST_CLASS: Record<SerializedListNode['listType'], string> = {
    bullet: 'list-disc',
    number: 'list-decimal',
    check: 'list-disc',
}

const postConverters: JSXConvertersFunction<DefaultNodeTypes> = ({
    defaultConverters,
}) => ({
    ...defaultConverters,
    paragraph: ({ node, nodesToJSX }) => (
        <p className={READING_CLASS}>{nodesToJSX({ nodes: node.children })}</p>
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
            <List
                className={`flex flex-col gap-1.5 pl-6 ${READING_CLASS} ${LIST_CLASS[node.listType]}`}
            >
                {nodesToJSX({ nodes: node.children })}
            </List>
        )
    },
    listitem: ({ node, nodesToJSX }) => (
        <li>{nodesToJSX({ nodes: node.children })}</li>
    ),
    quote: ({ node, nodesToJSX }) => (
        <blockquote
            className={`border-l-2 border-border pl-5 ${READING_CLASS}`}
        >
            {nodesToJSX({ nodes: node.children })}
        </blockquote>
    ),
    link: ({ node, nodesToJSX }) => (
        <Link node={node} nodesToJSX={nodesToJSX} />
    ),
    text: ({ node }) => formattedText(node.text, node.format),
})

function Link({
    node,
    nodesToJSX,
}: Pick<JSXConverterArgs<SerializedLinkNode>, 'node' | 'nodesToJSX'>) {
    const children = nodesToJSX({ nodes: node.children })
    const { url, newTab } = node.fields
    if (!url) return <>{children}</>
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

function formattedText(text: string, format: number) {
    const slantedText =
        format & IS_ITALIC ? (
            <em className="font-serif-italic italic">{text}</em>
        ) : (
            text
        )
    return format & IS_BOLD ? (
        <strong className="font-medium">{slantedText}</strong>
    ) : (
        slantedText
    )
}

/** A post's rich text, set in the site's reading typography. */
export function PostRichText({ body }: { body: PostBody }) {
    return <RichText data={body} converters={postConverters} disableContainer />
}
