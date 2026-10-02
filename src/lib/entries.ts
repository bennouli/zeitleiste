import type { User } from '@/payload-types'
import config from '@/payload.config'
import { Data, Effect, Schema } from 'effect'
import { getPayload, type Payload, type Where } from 'payload'
import {
    CmsEntry,
    CmsPost,
    entryOf,
    hasTexts,
    postIdOf,
    postOf,
} from './cmsEntry'
import type { Post } from './entry'
import { paragraphsToLexical } from './richText'

class LoadError extends Data.TaggedError('LoadError')<{
    readonly operation: string
    readonly cause: unknown
}> {}

const POST_NOT_LOADED: Post = { body: paragraphsToLexical('') }

/**
 * Every published entry of the reader, sorted by start. An entry's post is only
 * marked as present; `loadPost` loads its body.
 */
export const loadEntries = Effect.fn('loadEntries')(function* (reader: User) {
    const docs = yield* findPublishedEntries(reader)
    return docs.map((doc) =>
        entryOf(doc, postIdOf(doc) === undefined ? undefined : POST_NOT_LOADED)
    )
})

/** The reader's published entry at `slug` with its post; undefined if there is none or it has no post. */
export const loadPost = Effect.fn('loadPost')(function* (
    reader: User,
    slug: string
) {
    const [doc] = yield* findPublishedEntries(reader, {
        slug: { equals: slug },
    })
    const postId = doc && postIdOf(doc)
    if (doc === undefined || postId === undefined) return undefined
    const post = yield* findPost(reader, postId)
    return post && entryOf(doc, postOf(post))
})

const PUBLISHED: Where = { _status: { equals: 'published' } }

function findPublishedEntries(reader: User, ...constraints: Where[]) {
    return payloadCall('find entries', (payload) =>
        payload.find({
            collection: 'entries',
            where: { and: [PUBLISHED, ...constraints] },
            user: reader,
            overrideAccess: false,
            draft: false,
            depth: 1,
            populate: { posts: {} },
            sort: 'startAt',
            pagination: false,
        })
    ).pipe(
        Effect.flatMap(({ docs }) => decode(Schema.Array(CmsEntry), docs)),
        Effect.map((docs) => docs.filter(hasTexts))
    )
}

function findPost(reader: User, id: number) {
    return payloadCall('find post', (payload) =>
        payload.find({
            collection: 'posts',
            where: { id: { equals: id } },
            user: reader,
            overrideAccess: false,
            select: { body: true, sources: true },
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
