import { I18nProvider } from '@/components/I18nContext'
import { TimelineShell } from '@/components/TimelineShell'
import type { Locale } from '@/i18n/locales'
import { loadEntries } from '@/lib/entries'
import { Effect } from 'effect'
import type { ReactNode } from 'react'
import { Document } from '../Document'

/** The public site in one locale: the timeline, with the page below it. */
export async function Site({
    locale,
    children,
}: {
    locale: Locale
    children: ReactNode
}) {
    const entries = await Effect.runPromise(loadEntries(locale))
    return (
        <Document lang={locale}>
            <I18nProvider locale={locale}>
                <TimelineShell entries={entries}>{children}</TimelineShell>
            </I18nProvider>
        </Document>
    )
}
