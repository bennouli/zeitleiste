import type { ReactNode } from 'react'
import '../(frontend)/globals.css'
import { fontVariables } from '../fonts'

export default function AccountLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="de" className={fontVariables}>
            <body className="min-h-screen bg-surface font-sans text-fg antialiased">
                {children}
            </body>
        </html>
    )
}
