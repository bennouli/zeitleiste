import { I18nProvider } from '@/components/I18nContext'
import type { Locale } from '@/i18n/locales'
import type { ReactNode } from 'react'
import './(frontend)/globals.css'
import { fontVariables } from './fonts'

/** The `<html>` and `<body>` every root layout renders, with the interface texts of `locale`. */
export function Document({
    locale,
    children,
}: {
    locale: Locale
    children: ReactNode
}) {
    return (
        <html lang={locale} className={fontVariables}>
            <body className="min-h-screen bg-surface font-sans text-fg antialiased">
                <I18nProvider locale={locale}>{children}</I18nProvider>
            </body>
        </html>
    )
}
