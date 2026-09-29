import { Schema } from 'effect'
import { ENTRY_TYPES, type Entry, type HDate, type Post } from './entry'

const Id = Schema.Number
const OptionalNumber = Schema.optional(Schema.NullOr(Schema.Number))
const OptionalString = Schema.optional(Schema.NullOr(Schema.String))

const LexicalNode = Schema.StructWithRest(
    Schema.Struct({ type: Schema.String, version: Schema.Number }),
    [Schema.Record(Schema.String, Schema.Unknown)]
)

const CmsPostBody = Schema.StructWithRest(
    Schema.Struct({
        root: Schema.Struct({
            type: Schema.String,
            children: Schema.mutable(Schema.Array(LexicalNode)),
            direction: Schema.NullOr(Schema.Literals(['ltr', 'rtl'])),
            format: Schema.Literals([
                'left',
                'start',
                'center',
                'right',
                'end',
                'justify',
                '',
            ]),
            indent: Schema.Number,
            version: Schema.Number,
        }),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)]
)

/** A post as the Local API returns it. */
export const CmsPost = Schema.Struct({ body: CmsPostBody })

const Slugged = Schema.Struct({
    slug: Schema.optional(Schema.NullOr(Schema.String)),
})

/** A relationship the reader may not see arrives as its bare id. */
const SluggedRelation = Schema.optional(
    Schema.NullOr(Schema.Union([Id, Slugged]))
)

/** A published entry as the Local API returns it at depth 1; its texts may be missing in the locale read. */
export const CmsEntry = Schema.Struct({
    slug: Schema.NonEmptyString,
    title: OptionalString,
    summary: OptionalString,
    startYear: Schema.Number,
    startMonth: OptionalNumber,
    startDay: OptionalNumber,
    endYear: OptionalNumber,
    endMonth: OptionalNumber,
    endDay: OptionalNumber,
    ongoing: Schema.optional(Schema.NullOr(Schema.Boolean)),
    type: Schema.Literals(ENTRY_TYPES),
    tags: Schema.optional(
        Schema.NullOr(
            Schema.Array(
                Schema.Union([Id, Schema.Struct({ name: Schema.String })])
            )
        )
    ),
    subject: SluggedRelation,
    partOf: SluggedRelation,
    post: Schema.optional(
        Schema.NullOr(Schema.Union([Id, Schema.Struct({ id: Id })]))
    ),
})
export type CmsEntry = typeof CmsEntry.Type

/** A CMS entry with its title and summary in the locale it was read in. */
export type TextedCmsEntry = CmsEntry & { title: string; summary: string }

type DateParts = {
    year: number
    month?: number | null
    day?: number | null
}

/** Whether a CMS entry has its title and summary in the locale it was read in. */
export function hasTexts(doc: CmsEntry): doc is TextedCmsEntry {
    return Boolean(doc.title) && Boolean(doc.summary)
}

/** The timeline entry of a CMS entry, with the post it links to if that is loaded. */
export function entryOf(doc: TextedCmsEntry, post?: Post): Entry {
    const end = endOf(doc)
    const subject = slugOf(doc.subject)
    const partOf = slugOf(doc.partOf)
    return {
        id: doc.slug,
        title: doc.title,
        summary: doc.summary,
        start: hDateOf({
            year: doc.startYear,
            month: doc.startMonth,
            day: doc.startDay,
        }),
        ...(end !== undefined && { end }),
        type: doc.type,
        tags: (doc.tags ?? []).flatMap((tag) =>
            typeof tag === 'number' ? [] : [tag.name]
        ),
        ...(subject !== undefined && { subject }),
        ...(partOf !== undefined && { partOf }),
        ...(post !== undefined && { post }),
    }
}

/** The id of the post an entry links to, if any. */
export function postIdOf(doc: CmsEntry): number | undefined {
    if (doc.post === null || doc.post === undefined) return undefined
    return typeof doc.post === 'number' ? doc.post : doc.post.id
}

function endOf(doc: CmsEntry): Entry['end'] {
    if (doc.ongoing) return 'ongoing'
    if (doc.endYear === null || doc.endYear === undefined) return undefined
    return hDateOf({ year: doc.endYear, month: doc.endMonth, day: doc.endDay })
}

function hDateOf({ year, month, day }: DateParts): HDate {
    if (month === null || month === undefined) return { year }
    if (day === null || day === undefined) return { year, month }
    return { year, month, day }
}

function slugOf(relation: CmsEntry['subject']): string | undefined {
    if (relation === null || relation === undefined) return undefined
    if (typeof relation === 'number') return undefined
    return relation.slug || undefined
}
