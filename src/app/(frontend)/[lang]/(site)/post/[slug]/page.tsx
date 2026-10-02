import { requireReader } from '@/app/(frontend)/reader'
import { Post } from '@/components/post/Post'
import { messages } from '@/i18n/messages'
import { routeLocale } from '@/i18n/routeLocale'
import { loadPost } from '@/lib/entries'
import { Effect } from 'effect'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

type Props = {
    params: Promise<{ lang: string; slug: string }>
}

const publishedPost = cache((slug: string) => Effect.runPromise(loadPost(slug)))

async function postOfRoute({ params }: Props) {
    const { lang, slug } = await params
    await requireReader(lang)
    routeLocale(lang)
    return publishedPost(slug)
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
