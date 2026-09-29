import { TimelineShell } from '@/components/TimelineShell'
import { entries } from '@/data/entries'
import { paragraphsToLexical } from '@/lib/richText'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { fontVariables } from '../fonts'
import './globals.css'

// The timeline only needs to know that a post exists; post bodies are loaded by the post pages.
const timelineEntries = entries.map((e) =>
    e.post ? { ...e, post: { body: paragraphsToLexical('') } } : e
)

export const metadata: Metadata = {
    title: 'Zeitleiste',
    description: 'Interaktive Zeitleiste: Russland und der Westen seit 1700',
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="de" className={fontVariables}>
            <body className="min-h-screen bg-surface font-sans text-fg antialiased">
                <TimelineShell entries={timelineEntries}>
                    {children}
                </TimelineShell>
            </body>
        </html>
    )
}
