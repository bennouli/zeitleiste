'use client'

import type { Entry } from '@/lib/entry'

export interface TimelineProps {
  entries: Entry[]
  /** Collapsed to about half height while a post is open. */
  collapsed: boolean
  /** Entry to center and highlight, e.g. the open post's entry. */
  focusEntryId: string | null
  onOpenEntry: (id: string) => void
}

/** Stub: replaced by the real timeline in a later issue. */
export function Timeline({ entries }: TimelineProps) {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-2 border-b border-border bg-surface-raised text-fg">
      <p className="font-serif text-2xl">Zeitleiste</p>
      <p className="text-fg-muted">
        {entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'}
      </p>
    </div>
  )
}
