import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Post } from '@/components/post/Post'
import { entries } from '@/data/entries'
import { findEntry, postSlugs } from '@/lib/posts'

interface Props {
  params: Promise<{ slug: string }>
}

// Only the prebuilt posts exist; any other slug is a 404.
export const dynamicParams = false

export function generateStaticParams() {
  return postSlugs(entries).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = findEntry(entries, (await params).slug)
  if (!entry) return {}
  return { title: `${entry.title} – Zeitleiste`, description: entry.summary }
}

export default async function PostPage({ params }: Props) {
  const entry = findEntry(entries, (await params).slug)
  if (!entry) notFound()
  return <Post entry={entry} />
}
