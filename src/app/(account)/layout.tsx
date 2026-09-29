import type { ReactNode } from 'react'
import { Document } from '../Document'

export default function AccountLayout({ children }: { children: ReactNode }) {
    return <Document lang="de">{children}</Document>
}
