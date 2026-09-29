import { LOCALES } from '@/i18n/locales'
import { documentLocale } from '@/i18n/routeLocale'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Site } from '../Site'

export const metadata: Metadata = {
    title: 'Zeitleiste',
    description: 'Interaktive Zeitleiste: Russland und der Westen seit 1700',
}

export function generateStaticParams() {
    return LOCALES.map((lang) => ({ lang }))
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: ReactNode
    params: Promise<{ lang: string }>
}) {
    const locale = documentLocale((await params).lang)
    return <Site locale={locale}>{children}</Site>
}
