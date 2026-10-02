import { TimelineShell } from '@/components/TimelineShell'
import type { Locale } from '@/i18n/locales'
import { messages } from '@/i18n/messages'
import { loadEntries } from '@/lib/entries'
import { Effect } from 'effect'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { requireReader } from './reader'

/** Title and description of the site in one locale. */
export function siteMetadata(locale: Locale): Metadata {
    const { name, description } = messages[locale].site
    return { title: name, description }
}

/** The site for a logged-in reader: the timeline, with the page below it. */
export async function Site({
    lang,
    children,
}: {
    lang: string
    children: ReactNode
}) {
    await requireReader(lang)
    const entries = await Effect.runPromise(loadEntries())
    return <TimelineShell entries={entries}>{children}</TimelineShell>
}
