import type { ReactNode } from 'react'
import { Site } from '../../Site'

export default async function SiteLayout({
    children,
    params,
}: {
    children: ReactNode
    params: Promise<{ lang: string }>
}) {
    return <Site lang={(await params).lang}>{children}</Site>
}
