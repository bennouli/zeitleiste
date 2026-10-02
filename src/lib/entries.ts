import config from '@/payload.config'
import { Data, Effect, Schema } from 'effect'
import { getPayload, type Payload, type Where } from 'payload'
import { CmsEntry, CmsPost, entryOf, hasTexts, postIdOf } from './cmsEntry'
import type { Post } from './entry'
import { paragraphsToLexical } from './richText'

class LoadError extends Data.TaggedError('LoadError')<{
    readonly operation: string
    readonly cause: unknown
}> {}

const POST_NOT_LOADED: Post = { body: paragraphsToLexical('') }

/**
 * Every published entry, sorted by start. An entry's post is only marked as
 * present; `loadPost` loads its body.
 */
export const loadEntries = Effect.fn('loadEntries')(function* () {
    const docs = yield* findPublishedEntries({})
    return docs.map((doc) =>
        entryOf(doc, postIdOf(doc) === undefined ? undefined : POST_NOT_LOADED)
    )
})

/** The published entry at `slug` with its post; undefined if there is none or it has no post. */
export const loadPost = Effect.fn('loadPost')(function* (slug: string) {
    const [doc] = yield* findPublishedEntries({ slug: { equals: slug } })
    const postId = doc && postIdOf(doc)
    if (doc === undefined || postId === undefined) return undefined
    const post = yield* findPost(postId)
    return post && entryOf(doc, post)
})

function findPublishedEntries(where: Where) {
    return payloadCall('find entries', (payload) =>
        payload.find({
            collection: 'entries',
            where,
            overrideAccess: false,
            draft: false,
            depth: 1,
            sort: 'startAt',
            pagination: false,
        })
    ).pipe(
        Effect.flatMap(({ docs }) => decode(Schema.Array(CmsEntry), docs)),
        Effect.map((docs) => docs.filter(hasTexts))
    )
}

/**
 * Posts are readable by editors only, so the Local API leaves an anonymous
 * entry's `post` as an id. Only ids taken from a published entry reach here.
 */
function findPost(id: number) {
    return payloadCall('find post', (payload) =>
        payload.find({
            collection: 'posts',
            where: { id: { equals: id } },
            overrideAccess: true,
            select: { body: true },
            depth: 1,
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
