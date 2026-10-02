import type { Payload } from 'payload'
import { entries } from '../src/data/entries'
import {
    seedEntryOf,
    tagKindOf,
    tagNamesOf,
    type SeedEntry,
} from '../src/data/seedMapping'
import { QUIET } from './payload'

/** The sample entries with their tags and posts, published and owned by `owner`: the timeline every site spec reads. */
export async function createSampleContent(payload: Payload, owner: number) {
    const seedEntries = entries.map(seedEntryOf)
    const tagIds = new Map(
        await Promise.all(
            tagNamesOf(seedEntries).map(async (name) => {
                const tag = await payload.create({
                    collection: 'tags',
                    data: { owner, name, kind: tagKindOf(name) },
                })
                return [name, tag.id] as const
            })
        )
    )
    await Promise.all(
        seedEntries.map((seedEntry) =>
            createEntry(payload, owner, seedEntry, tagIds)
        )
    )
}

async function createEntry(
    payload: Payload,
    owner: number,
    { fields, tagNames, postBody }: SeedEntry,
    tagIds: ReadonlyMap<string, number>
) {
    const post =
        postBody &&
        (await payload.create({
            collection: 'posts',
            data: { owner, body: postBody },
            context: QUIET,
        }))
    await payload.create({
        collection: 'entries',
        data: {
            ...fields,
            owner,
            tags: tagNames.map((name) => tagIds.get(name)!),
            post: post?.id,
            _status: 'published',
        },
        context: QUIET,
    })
}
