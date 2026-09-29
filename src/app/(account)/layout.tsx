import { I18nProvider } from '@/components/I18nContext'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import type { ReactNode } from 'react'
import { Document } from '../Document'

export default function AccountLayout({ children }: { children: ReactNode }) {
    return (
        <Document lang={DEFAULT_LOCALE}>
            <I18nProvider locale={DEFAULT_LOCALE}>{children}</I18nProvider>
        </Document>
    )
}
