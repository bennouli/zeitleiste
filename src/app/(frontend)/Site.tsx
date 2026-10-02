import { NotesProvider } from '@/components/notes/NotesContext'
import { NotesSidebar } from '@/components/notes/NotesSidebar'
import { TimelineShell } from '@/components/TimelineShell'
import type { Locale } from '@/i18n/locales'
import { messages } from '@/i18n/messages'
import { loadEntries } from '@/lib/entries'
import { Effect } from 'effect'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createNote, deleteNote, listNotes, updateNote } from './notes/actions'
import { requireReader } from './reader'

const NOTES_ACTIONS = { listNotes, createNote, updateNote, deleteNote }

/** Title and description of the site in one locale. */
export function siteMetadata(locale: Locale): Metadata {
    const { name, description } = messages[locale].site
    return { title: name, description }
}

/** The site for a logged-in reader: the timeline, with the page below it and the reader's notes beside it. */
export async function Site({
    lang,
    children,
}: {
    lang: string
    children: ReactNode
}) {
    await requireReader(lang)
    const entries = await Effect.runPromise(loadEntries())
    return (
        <NotesProvider actions={NOTES_ACTIONS}>
            <div className="lg:flex">
                <div className="min-w-0 flex-1">
                    <TimelineShell entries={entries}>{children}</TimelineShell>
                </div>
                <NotesSidebar />
            </div>
        </NotesProvider>
    )
}
