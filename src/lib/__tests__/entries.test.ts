import { Effect } from 'effect'
import { getPayload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadEntries, loadPost } from '../entries'
import { paragraphsToLexical } from '../richText'

vi.mock('@/payload.config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

const find = vi.fn()

const entryDoc = (slug: string, post: number | null) => ({
    id: 1,
    slug,
    title: 'Krimkrieg',
    summary: 'Russland kämpft gegen das Osmanische Reich.',
    startYear: 1853,
    startMonth: 10,
    type: 'war',
    tags: [],
    post,
    _status: 'published',
})
const body = paragraphsToLexical('Der Text.')
const found = (docs: object[]) => ({ docs })
const withoutPost = found([entryDoc('krimkrieg', null)])
const withPost = found([entryDoc('krimkrieg', 7)])
const post = found([{ id: 7, body }])
const nothing = found([])
const unreachable = new Error('connection refused')
const withoutSlug = found([{ ...entryDoc('krimkrieg', null), slug: null }])
const withEnglishOnlyEntry = found([
    entryDoc('krimkrieg', null),
    { ...entryDoc('crimean-war', null), title: null, summary: null },
])
const englishOnlyWithPost = found([
    { ...entryDoc('crimean-war', 7), title: null },
])
const mixed = found([
    entryDoc('krimkrieg', 7),
    entryDoc('wiener-kongress', null),
])

beforeEach(() => {
    find.mockReset()
    vi.mocked(getPayload).mockResolvedValue({ find } as never)
})

describe('loadEntries', () => {
    it('asks for published entries only, as a visitor, in start order', async () => {
        find.mockResolvedValueOnce(withoutPost)
        await Effect.runPromise(loadEntries('en'))
        expect(find).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'entries',
                overrideAccess: false,
                draft: false,
                locale: 'en',
                fallbackLocale: 'de',
                sort: 'startAt',
                pagination: false,
            })
        )
    })

    it('marks entries with a post without loading its body', async () => {
        find.mockResolvedValueOnce(mixed)
        const entries = await Effect.runPromise(loadEntries('de'))
        expect(entries.map((e) => [e.id, e.post !== undefined])).toEqual([
            ['krimkrieg', true],
            ['wiener-kongress', false],
        ])
        expect(find).toHaveBeenCalledTimes(1)
    })

    it('leaves out an entry without texts in the locale', async () => {
        find.mockResolvedValueOnce(withEnglishOnlyEntry)
        const entries = await Effect.runPromise(loadEntries('de'))
        expect(entries.map((e) => e.id)).toEqual(['krimkrieg'])
    })

    it('fails with a LoadError when the content management fails', async () => {
        find.mockRejectedValueOnce(unreachable)
        const error = await Effect.runPromise(Effect.flip(loadEntries('de')))
        expect(error._tag).toBe('LoadError')
    })

    it('fails with a LoadError on a document it cannot read', async () => {
        find.mockResolvedValueOnce(withoutSlug)
        const error = await Effect.runPromise(Effect.flip(loadEntries('de')))
        expect(error._tag).toBe('LoadError')
    })
})

describe('loadPost', () => {
    it('loads the post of the published entry at the slug, with its images', async () => {
        find.mockResolvedValueOnce(withPost)
        find.mockResolvedValueOnce(post)
        const entry = await Effect.runPromise(loadPost('krimkrieg', 'de'))
        expect(entry?.post?.body).toEqual(body)
        expect(find).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                collection: 'entries',
                where: { slug: { equals: 'krimkrieg' } },
                overrideAccess: false,
                draft: false,
            })
        )
        expect(find).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                collection: 'posts',
                where: { id: { equals: 7 } },
                locale: 'de',
                select: { body: true },
                depth: 1,
            })
        )
    })

    it('finds nothing for an unpublished or unknown slug', async () => {
        find.mockResolvedValueOnce(nothing)
        expect(
            await Effect.runPromise(loadPost('entwurf', 'de'))
        ).toBeUndefined()
        expect(find).toHaveBeenCalledTimes(1)
    })

    it('finds nothing for an entry without texts in the locale', async () => {
        find.mockResolvedValueOnce(englishOnlyWithPost)
        expect(
            await Effect.runPromise(loadPost('crimean-war', 'de'))
        ).toBeUndefined()
        expect(find).toHaveBeenCalledTimes(1)
    })

    it('finds nothing for an entry without a post', async () => {
        find.mockResolvedValueOnce(withoutPost)
        expect(
            await Effect.runPromise(loadPost('krimkrieg', 'de'))
        ).toBeUndefined()
        expect(find).toHaveBeenCalledTimes(1)
    })
})
