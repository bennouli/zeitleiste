import { DEFAULT_LOCALE } from '@/i18n/locales'
import type { ReactNode } from 'react'
import { Document } from '../Document'

export default function AccountLayout({ children }: { children: ReactNode }) {
    return <Document locale={DEFAULT_LOCALE}>{children}</Document>
}
