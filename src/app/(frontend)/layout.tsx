import { TimelineShell } from '@/components/TimelineShell'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import { loadEntries } from '@/lib/entries'
import { Effect } from 'effect'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { fontVariables } from '../fonts'
import './globals.css'

export const metadata: Metadata = {
    title: 'Zeitleiste',
    description: 'Interaktive Zeitleiste: Russland und der Westen seit 1700',
}

export default async function RootLayout({
    children,
}: {
    children: ReactNode
}) {
    const entries = await Effect.runPromise(loadEntries(DEFAULT_LOCALE))
    return (
        <html lang="de" className={fontVariables}>
            <body className="min-h-screen bg-surface font-sans text-fg antialiased">
                <TimelineShell entries={entries}>{children}</TimelineShell>
            </body>
        </html>
    )
}
