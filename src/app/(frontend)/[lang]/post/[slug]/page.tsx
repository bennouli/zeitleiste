import { Post } from '@/components/post/Post'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import { loadEntries, loadPost } from '@/lib/entries'
import { postSlugs } from '@/lib/posts'
import { Effect } from 'effect'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

type Props = {
    params: Promise<{ slug: string }>
}

export const dynamicParams = true

const publishedPost = cache((slug: string) =>
    Effect.runPromise(loadPost(slug, DEFAULT_LOCALE))
)

export async function generateStaticParams() {
    const entries = await Effect.runPromise(loadEntries(DEFAULT_LOCALE))
    return postSlugs(entries).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const entry = await publishedPost((await params).slug)
    if (!entry) return {}
    return { title: `${entry.title} – Zeitleiste`, description: entry.summary }
}

export default async function PostPage({ params }: Props) {
    const entry = await publishedPost((await params).slug)
    if (!entry) notFound()
    return <Post entry={entry} />
}
