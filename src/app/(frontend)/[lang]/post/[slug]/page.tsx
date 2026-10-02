import { Post } from '@/components/post/Post'
import { messages } from '@/i18n/messages'
import { routeLocale } from '@/i18n/routeLocale'
import { loadEntries, loadPost } from '@/lib/entries'
import { postSlugs } from '@/lib/posts'
import { Effect } from 'effect'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

type Props = {
    params: Promise<{ lang: string; slug: string }>
}

export const dynamicParams = true

const publishedPost = cache((slug: string) => Effect.runPromise(loadPost(slug)))

async function postOfRoute({ params }: Props) {
    const { lang, slug } = await params
    routeLocale(lang)
    return publishedPost(slug)
}

export async function generateStaticParams() {
    const entries = await Effect.runPromise(loadEntries())
    return postSlugs(entries).map((slug) => ({ slug }))
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const entry = await postOfRoute(props)
    if (!entry) return {}
    const { site } = messages[routeLocale((await props.params).lang)]
    return { title: site.postTitle(entry.title), description: entry.summary }
}

export default async function PostPage(props: Props) {
    const entry = await postOfRoute(props)
    if (!entry) notFound()
    return <Post entry={entry} />
}
