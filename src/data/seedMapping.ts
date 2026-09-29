import type { Entry, EntryType } from '@/lib/entry'
import type { PostBody } from '@/lib/richText'
import type { Tag } from '@/payload-types'

/** A sample entry's own fields, in the admin's layout. */
export type EntryFields = {
    slug: string
    title: string
    summary: string
    startYear: number
    startMonth?: number
    startDay?: number
    endYear?: number
    endMonth?: number
    endDay?: number
    ongoing: boolean
    type: EntryType
}

/** A sample entry for the admin, its references still named by slug or tag name. */
export type SeedEntry = {
    fields: EntryFields
    tagNames: readonly string[]
    subjectSlug?: string
    partOfSlug?: string
    postBody?: PostBody
}

export type TagKind = Tag['kind']

const PLACE_TAGS: ReadonlySet<string> = new Set([
    'Sankt Petersburg',
    'Berlin',
    'Krim',
])

export function seedEntryOf(entry: Entry): SeedEntry {
    const end = entry.end === 'ongoing' ? undefined : entry.end
    return {
        fields: {
            slug: entry.id,
            title: entry.title,
            summary: entry.summary,
            startYear: entry.start.year,
            startMonth: entry.start.month,
            startDay: entry.start.day,
            endYear: end?.year,
            endMonth: end?.month,
            endDay: end?.day,
            ongoing: entry.end === 'ongoing',
            type: entry.type,
        },
        tagNames: entry.tags,
        subjectSlug: entry.subject,
        partOfSlug: entry.partOf,
        postBody: entry.post?.body,
    }
}

/** Every tag name the entries use, once, in order of first use. */
export function tagNamesOf(seedEntries: readonly SeedEntry[]): string[] {
    return [...new Set(seedEntries.flatMap((e) => e.tagNames))]
}

/** Places are the cities and regions among the sample tags; every other sample tag names a state or alliance. */
export function tagKindOf(name: string): TagKind {
    return PLACE_TAGS.has(name) ? 'place' : 'actor'
}
