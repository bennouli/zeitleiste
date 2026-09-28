import { TimelineShell } from '@/components/TimelineShell'
import { entries } from '@/data/entries'
import type { Metadata } from 'next'
import { EB_Garamond, IBM_Plex_Sans } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'

// The timeline only needs to know that a post exists; post bodies are loaded by the post pages.
const timelineEntries = entries.map((e) =>
    e.post ? { ...e, post: { body: '' } } : e
)

const ebGaramond = EB_Garamond({
    subsets: ['latin'],
    weight: ['400', '500'],
    style: ['normal', 'italic'],
    display: 'swap',
    variable: '--font-eb-garamond',
})

const ibmPlexSans = IBM_Plex_Sans({
    subsets: ['latin'],
    weight: ['400', '500'],
    display: 'swap',
    variable: '--font-ibm-plex-sans',
})

export const metadata: Metadata = {
    title: 'Zeitleiste',
    description: 'Interaktive Zeitleiste: Russland und der Westen seit 1700',
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html
            lang="de"
            className={`${ebGaramond.variable} ${ibmPlexSans.variable}`}
        >
            <body className="min-h-screen bg-surface font-sans text-fg antialiased">
                <TimelineShell entries={timelineEntries}>
                    {children}
                </TimelineShell>
            </body>
        </html>
    )
}
