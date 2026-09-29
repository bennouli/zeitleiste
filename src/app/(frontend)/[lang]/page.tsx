import { routeLocale } from '@/i18n/routeLocale'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Zeitleiste',
}

type Props = {
    params: Promise<{ lang: string }>
}

/** The start page: only the full-screen timeline, which lives in the layout. */
export default async function HomePage({ params }: Props) {
    routeLocale((await params).lang)
    return null
}
