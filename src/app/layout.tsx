import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zeitleiste',
  description: 'Interaktive Zeitleiste: Russland und der Westen seit 1700',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-surface font-sans text-fg antialiased">{children}</body>
    </html>
  )
}
