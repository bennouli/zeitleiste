import { Post } from '@/components/post/Post'
import type { Locale } from '@/i18n/locales'
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

const publishedPost = cache((slug: string, locale: Locale) =>
    Effect.runPromise(loadPost(slug, locale))
)

async function postOfRoute({ params }: Props) {
    const { lang, slug } = await params
    return publishedPost(slug, routeLocale(lang))
}

export async function generateStaticParams({
    params,
}: {
    params: { lang: string }
}) {
    const entries = await Effect.runPromise(
        loadEntries(routeLocale(params.lang))
    )
    return postSlugs(entries).map((slug) => ({ slug }))
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const entry = await postOfRoute(props)
    if (!entry) return {}
    return { title: `${entry.title} – Zeitleiste`, description: entry.summary }
}

export default async function PostPage(props: Props) {
    const entry = await postOfRoute(props)
    if (!entry) notFound()
    return <Post entry={entry} />
}
