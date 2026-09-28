import { entries } from '@/data/entries'
import type { Entry } from '@/lib/entry'

export function sampleEntry(id: string): Entry {
    const entry = entries.find((e) => e.id === id)
    if (!entry) throw new Error(`missing sample entry ${id}`)
    return entry
}
