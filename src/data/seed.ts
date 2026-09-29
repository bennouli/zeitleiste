import config from '@payload-config'
import { Console, Data, Effect, Exit } from 'effect'
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import { entries } from './entries'
import {
    seedEntryOf,
    tagKindOf,
    tagNamesOf,
    type SeedEntry,
} from './seedMapping'

class PayloadCallFailed extends Data.TaggedError('PayloadCallFailed')<{
    readonly operation: string
    readonly cause: unknown
}> {}

class TransactionUnavailable extends Data.TaggedError(
    'TransactionUnavailable'
) {}

class ReferenceMissing extends Data.TaggedError('ReferenceMissing')<{
    readonly entry: string
    readonly field: 'subject' | 'partOf'
    readonly slug: string
}> {}

type Transaction = Pick<PayloadRequest, 'transactionID'>
type IdByKey = ReadonlyMap<string, number>
type Tally = { created: number; skipped: number }

const LOCALE = 'de'

function payloadCall<A>(operation: string, run: () => Promise<A>) {
    return Effect.tryPromise({
        try: run,
        catch: (cause) => new PayloadCallFailed({ operation, cause }),
    })
}

const seedSampleContent = Effect.fn('seedSampleContent')(function* (
    payload: Payload,
    req: Transaction
) {
    const seedEntries = entries.map(seedEntryOf)
    const tags = yield* createMissingTags(payload, req, tagNamesOf(seedEntries))
    const subjectIds = yield* subjectIdsBySlug(payload, req)
    const existingEntryIds = yield* entryIdsBySlug(payload, req)
    const newEntries = seedEntries.filter(
        (e) => !existingEntryIds.has(e.fields.slug)
    )
    const createdEntryIds = new Map<string, number>()
    for (const seedEntry of newEntries) {
        const subject = yield* idOfReference(seedEntry, 'subject', subjectIds)
        const post = yield* createPost(payload, req, seedEntry)
        const created = yield* payloadCall(
            `create entry ${seedEntry.fields.slug}`,
            () =>
                payload.create({
                    collection: 'entries',
                    locale: LOCALE,
                    req,
                    data: {
                        ...seedEntry.fields,
                        tags: seedEntry.tagNames.map((name) =>
                            tags.ids.get(name)!
                        ),
                        subject,
                        post,
                        _status: 'published',
                    },
                })
        )
        createdEntryIds.set(seedEntry.fields.slug, created.id)
    }
    const allEntryIds = new Map([...existingEntryIds, ...createdEntryIds])
    const partOfLinks = yield* linkPartOf(
        payload,
        req,
        newEntries,
        createdEntryIds,
        allEntryIds
    )
    return {
        tags: tags.tally,
        entries: {
            created: newEntries.length,
            skipped: seedEntries.length - newEntries.length,
        },
        posts: newEntries.filter((e) => e.postBody !== undefined).length,
        partOfLinks,
    }
})

const createMissingTags = Effect.fn('createMissingTags')(function* (
    payload: Payload,
    req: Transaction,
    names: readonly string[]
) {
    const existing = yield* payloadCall('find tags', () =>
        payload.find({
            collection: 'tags',
            locale: LOCALE,
            pagination: false,
            depth: 0,
            req,
        })
    )
    const ids = new Map(existing.docs.map((tag) => [tag.name, tag.id]))
    const missing = names.filter((name) => !ids.has(name))
    for (const name of missing) {
        const created = yield* payloadCall(`create tag ${name}`, () =>
            payload.create({
                collection: 'tags',
                locale: LOCALE,
                req,
                data: { name, kind: tagKindOf(name) },
            })
        )
        ids.set(name, created.id)
    }
    const tally: Tally = {
        created: missing.length,
        skipped: names.length - missing.length,
    }
    return { ids, tally }
})

const subjectIdsBySlug = Effect.fn('subjectIdsBySlug')(function* (
    payload: Payload,
    req: Transaction
) {
    const subjects = yield* payloadCall('find subjects', () =>
        payload.find({
            collection: 'subjects',
            pagination: false,
            depth: 0,
            req,
        })
    )
    return idsBySlug(subjects.docs)
})

const entryIdsBySlug = Effect.fn('entryIdsBySlug')(function* (
    payload: Payload,
    req: Transaction
) {
    const existing = yield* payloadCall('find entries', () =>
        payload.find({
            collection: 'entries',
            pagination: false,
            depth: 0,
            req,
        })
    )
    return idsBySlug(existing.docs)
})

function idsBySlug(
    docs: readonly { id: number; slug?: string | null }[]
): Map<string, number> {
    return new Map(
        docs.flatMap((doc) => (doc.slug ? [[doc.slug, doc.id] as const] : []))
    )
}

function idOfReference(
    seedEntry: SeedEntry,
    field: 'subject' | 'partOf',
    ids: IdByKey
) {
    const slug =
        field === 'subject' ? seedEntry.subjectSlug : seedEntry.partOfSlug
    if (slug === undefined) return Effect.succeed(undefined)
    const id = ids.get(slug)
    return id === undefined
        ? Effect.fail(
              new ReferenceMissing({
                  entry: seedEntry.fields.slug,
                  field,
                  slug,
              })
          )
        : Effect.succeed(id)
}

function createPost(payload: Payload, req: Transaction, seedEntry: SeedEntry) {
    const body = seedEntry.postBody
    if (body === undefined) return Effect.succeed(undefined)
    return payloadCall(`create post for ${seedEntry.fields.slug}`, () =>
        payload.create({
            collection: 'posts',
            locale: LOCALE,
            req,
            data: { body },
        })
    ).pipe(Effect.map((post) => post.id))
}

const linkPartOf = Effect.fn('linkPartOf')(function* (
    payload: Payload,
    req: Transaction,
    newEntries: readonly SeedEntry[],
    createdEntryIds: IdByKey,
    allEntryIds: IdByKey
) {
    const parts = newEntries.filter((e) => e.partOfSlug !== undefined)
    for (const part of parts) {
        const partOf = yield* idOfReference(part, 'partOf', allEntryIds)
        yield* payloadCall(
            `link ${part.fields.slug} to ${part.partOfSlug}`,
            () =>
                payload.update({
                    collection: 'entries',
                    id: createdEntryIds.get(part.fields.slug)!,
                    locale: LOCALE,
                    req,
                    data: { partOf },
                })
        )
    }
    return parts.length
})

function inTransaction<A, E>(
    payload: Payload,
    use: (req: Transaction) => Effect.Effect<A, E>
) {
    return Effect.acquireUseRelease(
        payloadCall('begin transaction', () =>
            payload.db.beginTransaction()
        ).pipe(
            Effect.flatMap((transactionID) =>
                transactionID === null
                    ? Effect.fail(new TransactionUnavailable())
                    : Effect.succeed(transactionID)
            )
        ),
        (transactionID) => use({ transactionID }),
        (transactionID, exit) =>
            Exit.isSuccess(exit)
                ? payloadCall('commit', () =>
                      payload.db.commitTransaction(transactionID)
                  )
                : payloadCall('roll back', () =>
                      payload.db.rollbackTransaction(transactionID)
                  )
    )
}

const seed = Effect.gen(function* () {
    const payload = yield* payloadCall('start payload', () =>
        getPayload({ config })
    )
    const counts = yield* inTransaction(payload, (req) =>
        seedSampleContent(payload, req)
    )
    yield* Console.log(
        [
            `tags: ${counts.tags.created} created, ${counts.tags.skipped} skipped`,
            `entries: ${counts.entries.created} created, ${counts.entries.skipped} skipped`,
            `posts: ${counts.posts} created`,
            `partOf links: ${counts.partOfLinks} set`,
        ].join('\n')
    )
})

await Effect.runPromise(seed)
