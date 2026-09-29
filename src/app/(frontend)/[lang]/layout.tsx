import { LOCALES } from '@/i18n/locales'
import { documentLocale } from '@/i18n/routeLocale'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Site, siteMetadata } from '../Site'

type LayoutParams = { params: Promise<{ lang: string }> }

export async function generateMetadata({
    params,
}: LayoutParams): Promise<Metadata> {
    return siteMetadata(documentLocale((await params).lang))
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
