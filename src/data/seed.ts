import config from '@payload-config'
import { Console, Data, Effect, Exit } from 'effect'
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import { entries } from './entries'
import {
    acceptsSeed,
    decodeSeedEnv,
    missingKeys,
    seedEntryOf,
    seedScopeOf,
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

const NOTHING_SEEDED = 'entries present, nothing seeded'
const NO_TAGS_SEEDED = 'production: tags present, nothing seeded'
const NO_OWNER = 'no admin account yet, nothing seeded'

function payloadCall<A>(operation: string, run: () => Promise<A>) {
    return Effect.tryPromise({
        try: run,
        catch: (cause) => new PayloadCallFailed({ operation, cause }),
    })
}

const seedSampleContent = Effect.fn('seedSampleContent')(function* (
    payload: Payload,
    req: Transaction,
    owner: number
) {
    const storedEntries = yield* payloadCall('count entries', () =>
        payload.count({ collection: 'entries', req })
    )
    if (!acceptsSeed(storedEntries.totalDocs)) return NOTHING_SEEDED
    const seedEntries = entries.map(seedEntryOf)
    const tagNames = tagNamesOf(seedEntries)
    const storedTagIds = yield* tagIdsByName(payload, req, owner)
    const missingTagNames = missingKeys(tagNames, storedTagIds)
    const createdTagIds = yield* Effect.forEach(missingTagNames, (name) =>
        createTag(payload, req, owner, name)
    )
    const tagIds = new Map([...storedTagIds, ...createdTagIds])
    const subjectIds = yield* subjectIdsBySlug(payload, req, owner)
    const storedEntryIds = yield* entryIdsBySlug(payload, req, owner)
    const newSlugs = new Set(
        missingKeys(
            seedEntries.map((e) => e.fields.slug),
            storedEntryIds
        )
    )
    const newEntries = seedEntries.filter((e) => newSlugs.has(e.fields.slug))
    const createdEntryIds = new Map(
        yield* Effect.forEach(newEntries, (seedEntry) =>
            createEntry(payload, req, owner, seedEntry, tagIds, subjectIds)
        )
    )
    const partOfLinks = yield* linkPartOf(
        payload,
        req,
        newEntries,
        createdEntryIds,
        new Map([...storedEntryIds, ...createdEntryIds])
    )
    return [
        'sample content: tags, entries and posts',
        `tags: ${missingTagNames.length} created, ${tagNames.length - missingTagNames.length} skipped`,
        `entries: ${newEntries.length} created, ${seedEntries.length - newEntries.length} skipped`,
        `posts: ${newEntries.filter((e) => e.postBody !== undefined).length} created`,
        `partOf links: ${partOfLinks} set`,
    ].join('\n')
})

const seedTags = Effect.fn('seedTags')(function* (
    payload: Payload,
    req: Transaction,
    owner: number
) {
    const storedTags = yield* payloadCall('count tags', () =>
        payload.count({ collection: 'tags', req })
    )
    if (!acceptsSeed(storedTags.totalDocs)) return NO_TAGS_SEEDED
    const tagNames = tagNamesOf(entries.map(seedEntryOf))
    yield* Effect.forEach(tagNames, (name) =>
        createTag(payload, req, owner, name)
    )
    return [
        'production: tags only, entries and posts are the owner’s',
        `tags: ${tagNames.length} created`,
    ].join('\n')
})

const tagIdsByName = Effect.fn('tagIdsByName')(function* (
    payload: Payload,
    req: Transaction,
    owner: number
) {
    const storedTags = yield* payloadCall('find tags', () =>
        payload.find({
            collection: 'tags',
            where: { owner: { equals: owner } },
            pagination: false,
            depth: 0,
            req,
        })
    )
    return new Map(storedTags.docs.map((tag) => [tag.name, tag.id]))
})

function createTag(
    payload: Payload,
    req: Transaction,
    owner: number,
    name: string
) {
    return payloadCall(`create tag ${name}`, () =>
        payload.create({
            collection: 'tags',
            req,
            data: { owner, name, kind: tagKindOf(name) },
        })
    ).pipe(Effect.map((tag) => [name, tag.id] as const))
}

const subjectIdsBySlug = Effect.fn('subjectIdsBySlug')(function* (
    payload: Payload,
    req: Transaction,
    owner: number
) {
    const storedSubjects = yield* payloadCall('find subjects', () =>
        payload.find({
            collection: 'subjects',
            where: { owner: { equals: owner } },
            pagination: false,
            depth: 0,
            req,
        })
    )
    return idsBySlug(storedSubjects.docs)
})

const entryIdsBySlug = Effect.fn('entryIdsBySlug')(function* (
    payload: Payload,
    req: Transaction,
    owner: number
) {
    const storedEntries = yield* payloadCall('find entries', () =>
        payload.find({
            collection: 'entries',
            where: { owner: { equals: owner } },
            pagination: false,
            depth: 0,
            req,
        })
    )
    return idsBySlug(storedEntries.docs)
})

function idsBySlug(
    docs: readonly { id: number; slug?: string | null }[]
): Map<string, number> {
    return new Map(
        docs.flatMap((doc) => (doc.slug ? [[doc.slug, doc.id] as const] : []))
    )
}

const createEntry = Effect.fn('createEntry')(function* (
    payload: Payload,
    req: Transaction,
    owner: number,
    seedEntry: SeedEntry,
    tagIds: IdByKey,
    subjectIds: IdByKey
) {
    const { slug } = seedEntry.fields
    const subject = yield* idOfReference(seedEntry, 'subject', subjectIds)
    const post = yield* createPost(payload, req, owner, seedEntry)
    const entryDocument = yield* payloadCall(`create entry ${slug}`, () =>
        payload.create({
            collection: 'entries',
            req,
            context: { disableRevalidate: true },
            data: {
                ...seedEntry.fields,
                owner,
                tags: seedEntry.tagNames.map((name) => tagIds.get(name)!),
                subject,
                post,
                _status: 'published',
            },
        })
    )
    return [slug, entryDocument.id] as const
})

function idOfReference(
    seedEntry: SeedEntry,
    field: 'subject' | 'partOf',
    ids: IdByKey
): Effect.Effect<number | undefined, ReferenceMissing> {
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

function createPost(
    payload: Payload,
    req: Transaction,
    owner: number,
    seedEntry: SeedEntry
) {
    const body = seedEntry.postBody
    if (body === undefined) return Effect.succeed(undefined)
    return payloadCall(`create post for ${seedEntry.fields.slug}`, () =>
        payload.create({
            collection: 'posts',
            req,
            context: { disableRevalidate: true },
            data: { owner, body },
        })
    ).pipe(Effect.map((post) => post.id))
}

const linkPartOf = Effect.fn('linkPartOf')(function* (
    payload: Payload,
    req: Transaction,
    newEntries: readonly SeedEntry[],
    createdEntryIds: IdByKey,
    entryIds: IdByKey
) {
    const parts = newEntries.filter((e) => e.partOfSlug !== undefined)
    yield* Effect.forEach(parts, (part) =>
        idOfReference(part, 'partOf', entryIds).pipe(
            Effect.flatMap((partOf) =>
                payloadCall(
                    `link ${part.fields.slug} to ${part.partOfSlug}`,
                    () =>
                        payload.update({
                            collection: 'entries',
                            id: createdEntryIds.get(part.fields.slug)!,
                            req,
                            context: { disableRevalidate: true },
                            data: { partOf },
                        })
                )
            )
        )
    )
    return parts.length
})

const oldestAdminId = Effect.fn('oldestAdminId')(function* (payload: Payload) {
    const admins = yield* payloadCall('find oldest admin', () =>
        payload.find({
            collection: 'users',
            where: { role: { equals: 'admin' } },
            sort: ['createdAt', 'id'],
            limit: 1,
            depth: 0,
            pagination: false,
        })
    )
    return admins.docs[0]?.id
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
    const { VERCEL_ENV } = yield* decodeSeedEnv(process.env)
    const payload = yield* payloadCall('start payload', () =>
        getPayload({ config })
    )
    const owner = yield* oldestAdminId(payload)
    const summary =
        owner === undefined
            ? NO_OWNER
            : yield* inTransaction(payload, (req) =>
                  seedScopeOf(VERCEL_ENV) === 'tags'
                      ? seedTags(payload, req, owner)
                      : seedSampleContent(payload, req, owner)
              )
    yield* Console.log(summary)
})

await Effect.runPromise(seed)
