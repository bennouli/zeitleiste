import type { ReactNode } from 'react'
import './(frontend)/globals.css'
import { fontVariables } from './fonts'

/** The `<html>` and `<body>` every root layout renders. */
export function Document({
    lang,
    children,
}: {
    lang: string
    children: ReactNode
}) {
    return (
        <html lang={lang} className={fontVariables}>
            <body className="min-h-screen bg-surface font-sans text-fg antialiased">
                {children}
            </body>
        </html>
    )
}
