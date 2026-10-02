'use client'

import { formattedText, LINK_CLASS } from '@/components/richTextFormat'
import type { PostBody } from '@/lib/richText'
import type { Media } from '@/payload-types'
import type {
    DefaultNodeTypes,
    SerializedHeadingNode,
    SerializedLinkNode,
    SerializedListNode,
} from '@payloadcms/richtext-lexical'
import {
    type JSXConverterArgs,
    type JSXConvertersFunction,
    RichText,
} from '@payloadcms/richtext-lexical/react'
import Image, { type ImageLoader } from 'next/image'
import { postImageSource } from './postImage'

const READING_CLASS = 'text-body text-pretty'

const HEADING_CLASS: Partial<Record<SerializedHeadingNode['tag'], string>> = {
    h3: 'pt-3 text-lead font-medium',
    h4: 'pt-1.5 text-body font-medium',
}

/** Mirrors `max-w-reading` (41.25rem) and the article's `mx-8` in Post.tsx; change them together. */
const IMAGE_SIZES = '(min-width: 45.25rem) 41.25rem, calc(100vw - 4rem)'

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
    upload: ({ node }) =>
        node.relationTo === 'media' && typeof node.value === 'object' ? (
            <PostImage media={node.value} />
        ) : null,
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

function PostImage({ media }: { media: Media }) {
    const source = postImageSource(media)
    if (source === undefined) return null
    const loader: ImageLoader = ({ width }) => source.urlForWidth(width)
    const hasFigcaption = Boolean(media.caption || media.credit)
    return (
        <figure className="flex flex-col gap-2 py-1.5">
            <Image
                loader={loader}
                src={source.src}
                width={source.width}
                height={source.height}
                alt={media.alt ?? ''}
                sizes={IMAGE_SIZES}
                className="h-auto w-full"
            />
            {hasFigcaption && (
                <figcaption className="text-meta text-fg-muted">
                    {media.caption}
                    {media.caption && media.credit && (
                        <>
                            <span aria-hidden="true"> · </span>
                            <span className="sr-only">, </span>
                        </>
                    )}
                    {media.credit && (
                        <span className="small-caps font-medium tracking-meta">
                            {media.credit}
                        </span>
                    )}
                </figcaption>
            )}
        </figure>
    )
}

/** A post's rich text, set in the site's reading typography. */
export function PostRichText({ body }: { body: PostBody }) {
    return <RichText data={body} converters={postConverters} disableContainer />
}
