'use client'

import { useState } from 'react'
import { Timeline } from '@/components/timeline/Timeline'
import { entries } from '@/data/entries'

export default function HomePage() {
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)

  return (
    <main>
      <h1 className="sr-only">Zeitleiste: Russland und der Westen</h1>
      <Timeline
        entries={entries}
        collapsed={openEntryId !== null}
        focusEntryId={openEntryId}
        onOpenEntry={setOpenEntryId}
      />
    </main>
  )
}
