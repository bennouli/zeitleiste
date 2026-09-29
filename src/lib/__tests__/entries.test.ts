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

beforeEach(() => {
    find.mockReset()
    vi.mocked(getPayload).mockResolvedValue({ find } as never)
})

describe('loadEntries', () => {
    it('asks for published entries only, as a visitor, in start order', async () => {
        find.mockResolvedValueOnce(found([entryDoc('krimkrieg', null)]))
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
        const docs = [
            entryDoc('krimkrieg', 7),
            entryDoc('wiener-kongress', null),
        ]
        find.mockResolvedValueOnce(found(docs))
        const entries = await Effect.runPromise(loadEntries('de'))
        expect(entries.map((e) => [e.id, e.post !== undefined])).toEqual([
            ['krimkrieg', true],
            ['wiener-kongress', false],
        ])
        expect(find).toHaveBeenCalledTimes(1)
    })

    it('fails with a LoadError when the content management fails', async () => {
        find.mockRejectedValueOnce(new Error('connection refused'))
        const error = await Effect.runPromise(Effect.flip(loadEntries('de')))
        expect(error._tag).toBe('LoadError')
    })

    it('fails with a LoadError on a document it cannot read', async () => {
        const broken = { ...entryDoc('krimkrieg', null), slug: null }
        find.mockResolvedValueOnce(found([broken]))
        const error = await Effect.runPromise(Effect.flip(loadEntries('de')))
        expect(error._tag).toBe('LoadError')
    })
})

describe('loadPost', () => {
    it('loads the post of the published entry at the slug', async () => {
        find.mockResolvedValueOnce(found([entryDoc('krimkrieg', 7)]))
        find.mockResolvedValueOnce(found([{ id: 7, body }]))
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
            })
        )
    })

    it('finds nothing for an unpublished or unknown slug', async () => {
        find.mockResolvedValueOnce(found([]))
        expect(
            await Effect.runPromise(loadPost('entwurf', 'de'))
        ).toBeUndefined()
        expect(find).toHaveBeenCalledTimes(1)
    })

    it('finds nothing for an entry without a post', async () => {
        find.mockResolvedValueOnce(found([entryDoc('krimkrieg', null)]))
        expect(
            await Effect.runPromise(loadPost('krimkrieg', 'de'))
        ).toBeUndefined()
        expect(find).toHaveBeenCalledTimes(1)
    })
})
