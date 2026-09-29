import { TimelineShell } from '@/components/TimelineShell'
import { entries } from '@/data/entries'
import { paragraphsToLexical } from '@/lib/richText'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import './globals.css'

// The timeline only needs to know that a post exists; post bodies are loaded by the post pages.
const timelineEntries = entries.map((e) =>
    e.post ? { ...e, post: { body: paragraphsToLexical('') } } : e
)

// Footgun: the order of `src` decides which file the fallback metrics are measured on (DESIGN.md § Fonts).
const ebGaramond = localFont({
    src: [
        {
            path: '../../fonts/eb-garamond/eb-garamond-latin-ext-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../../fonts/eb-garamond/eb-garamond-latin-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../../fonts/eb-garamond/eb-garamond-latin-ext-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
        {
            path: '../../fonts/eb-garamond/eb-garamond-latin-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
    ],
    display: 'swap',
    adjustFontFallback: 'Times New Roman',
    variable: '--font-eb-garamond',
})

const ebGaramondItalic = localFont({
    src: [
        {
            path: '../../fonts/eb-garamond/eb-garamond-latin-400-italic.woff2',
            weight: '400',
            style: 'italic',
        },
        {
            path: '../../fonts/eb-garamond/eb-garamond-latin-ext-400-italic.woff2',
            weight: '400',
            style: 'italic',
        },
    ],
    display: 'swap',
    adjustFontFallback: 'Times New Roman',
    preload: false,
    variable: '--font-eb-garamond-italic',
})

const ibmPlexSans = localFont({
    src: [
        {
            path: '../../fonts/ibm-plex-sans/ibm-plex-sans-latin-ext-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../../fonts/ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../../fonts/ibm-plex-sans/ibm-plex-sans-latin-ext-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
        {
            path: '../../fonts/ibm-plex-sans/ibm-plex-sans-latin-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
    ],
    display: 'swap',
    adjustFontFallback: 'Arial',
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
            className={`${ebGaramond.variable} ${ebGaramondItalic.variable} ${ibmPlexSans.variable}`}
        >
            <body className="min-h-screen bg-surface font-sans text-fg antialiased">
                <TimelineShell entries={timelineEntries}>
                    {children}
                </TimelineShell>
            </body>
        </html>
    )
}
