import { DEFAULT_LOCALE, type Locale } from '@/i18n/locales'
import config from '@/payload.config'
import { Data, Effect, Schema } from 'effect'
import { getPayload, type Payload, type Where } from 'payload'
import { CmsEntry, CmsPost, entryOf, postIdOf } from './cmsEntry'
import type { Post } from './entry'
import { paragraphsToLexical } from './richText'

class LoadError extends Data.TaggedError('LoadError')<{
    readonly operation: string
    readonly cause: unknown
}> {}

/** Stands in for a post body the timeline does not render. */
const POST_NOT_LOADED: Post = { body: paragraphsToLexical('') }

/**
 * Every published entry, sorted by start. An entry's post is only marked as
 * present; `loadPost` loads its body.
 */
export const loadEntries = Effect.fn('loadEntries')(function* (locale: Locale) {
    const docs = yield* findPublishedEntries(locale, {})
    return docs.map((doc) =>
        entryOf(doc, postIdOf(doc) === undefined ? undefined : POST_NOT_LOADED)
    )
})

/** The published entry at `slug` with its post; undefined if there is none or it has no post. */
export const loadPost = Effect.fn('loadPost')(function* (
    slug: string,
    locale: Locale
) {
    const [doc] = yield* findPublishedEntries(locale, {
        slug: { equals: slug },
    })
    const postId = doc && postIdOf(doc)
    if (doc === undefined || postId === undefined) return undefined
    const post = yield* findPost(postId, locale)
    return post && entryOf(doc, post)
})

function findPublishedEntries(locale: Locale, where: Where) {
    return payloadCall('find entries', (payload) =>
        payload.find({
            collection: 'entries',
            where,
            overrideAccess: false,
            draft: false,
            locale,
            fallbackLocale: DEFAULT_LOCALE,
            depth: 1,
            sort: 'startAt',
            pagination: false,
        })
    ).pipe(Effect.flatMap(({ docs }) => decode(Schema.Array(CmsEntry), docs)))
}

/**
 * Posts are readable by editors only, so the Local API leaves an anonymous
 * entry's `post` as an id. Only ids taken from a published entry reach here.
 */
function findPost(id: number, locale: Locale) {
    return payloadCall('find post', (payload) =>
        payload.find({
            collection: 'posts',
            where: { id: { equals: id } },
            overrideAccess: true,
            locale,
            fallbackLocale: DEFAULT_LOCALE,
            depth: 0,
            limit: 1,
            pagination: false,
        })
    ).pipe(
        Effect.flatMap(({ docs }) => decode(Schema.Array(CmsPost), docs)),
        Effect.map(([post]) => post)
    )
}

function payloadCall<A>(
    operation: string,
    run: (payload: Payload) => Promise<A>
) {
    return Effect.tryPromise({
        try: async () => run(await getPayload({ config })),
        catch: (cause) => new LoadError({ operation, cause }),
    })
}

function decode<S extends Schema.Top>(schema: S, input: unknown) {
    return Schema.decodeUnknownEffect(schema)(input).pipe(
        Effect.mapError(
            (cause) => new LoadError({ operation: 'decode', cause })
        )
    )
}
