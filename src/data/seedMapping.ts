import type { Entry } from '@/lib/entry'
import type { PostBody } from '@/lib/richText'
import type { Entry as EntryDocument, Tag } from '@/payload-types'
import { Schema } from 'effect'

type EntryFields = Pick<
    EntryDocument,
    | 'slug'
    | 'generateSlug'
    | 'title'
    | 'summary'
    | 'startYear'
    | 'startMonth'
    | 'startDay'
    | 'endYear'
    | 'endMonth'
    | 'endDay'
    | 'ongoing'
    | 'type'
>

export type SeedEntry = {
    fields: EntryFields & { slug: string; title: string; summary: string }
    tagNames: readonly string[]
    subjectSlug?: string
    partOfSlug?: string
    postBody?: PostBody
}

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
            generateSlug: false,
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

export function tagNamesOf(seedEntries: readonly SeedEntry[]): string[] {
    return [...new Set(seedEntries.flatMap((e) => e.tagNames))]
}

export function tagKindOf(name: string): Tag['kind'] {
    return PLACE_TAGS.has(name) ? 'place' : 'actor'
}

/** The keys not stored yet, in their given order. */
export function missingKeys(
    keys: readonly string[],
    storedIds: ReadonlyMap<string, number>
): string[] {
    return keys.filter((key) => !storedIds.has(key))
}

export function acceptsSeed(storedCount: number): boolean {
    return storedCount === 0
}

const VERCEL_ENVS = ['production', 'preview', 'development'] as const
type VercelEnv = (typeof VERCEL_ENVS)[number]

const isVercelEnv = (value: string): value is VercelEnv =>
    VERCEL_ENVS.some((vercelEnv) => vercelEnv === value)

const VercelEnv = Schema.String.check(
    Schema.makeFilter(
        (value) =>
            isVercelEnv(value) ||
            `Expected "production", "preview" or "development", got "${value}"`
    )
).pipe(Schema.refine(isVercelEnv))

const isVercelBuild = (vercel: string | undefined) =>
    vercel !== undefined && vercel.trim() !== ''

const SeedEnv = Schema.Struct({
    VERCEL: Schema.optional(Schema.String),
    VERCEL_ENV: Schema.optional(VercelEnv),
}).check(
    Schema.makeFilter(
        ({ VERCEL, VERCEL_ENV }) =>
            !isVercelBuild(VERCEL) ||
            VERCEL_ENV !== undefined || {
                path: ['VERCEL_ENV'],
                issue: 'Missing on a Vercel build (VERCEL is set); the seed cannot tell production from preview',
            }
    )
)

export const decodeSeedEnv = Schema.decodeUnknownEffect(SeedEnv)

type SeedScope = 'tags' | 'sample content'

export function seedScopeOf(vercelEnv: VercelEnv | undefined): SeedScope {
    return vercelEnv === 'production' ? 'tags' : 'sample content'
}
