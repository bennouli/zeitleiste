import { revalidatePath } from 'next/cache.js'
import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    revalidateEntryChange,
    revalidateEntryDelete,
    revalidatePostChange,
    revalidatePostDelete,
} from '../revalidate'

vi.mock('next/cache.js', () => ({ revalidatePath: vi.fn() }))

type ChangeArgs = Parameters<typeof revalidateEntryChange>[0]
type DeleteArgs = Parameters<typeof revalidateEntryDelete>[0]

const requestWith = (context: object) => ({ context }) as PayloadRequest
const siteRequest = requestWith({})
const seedRequest = requestWith({ disableRevalidate: true })

const published = { id: 1, slug: 'krimkrieg', _status: 'published' }
const draft = { id: 1, slug: 'krimkrieg', _status: 'draft' }
const post = { id: 2 }

const change = (doc: object, previousDoc: object, req = siteRequest) =>
    ({ doc, previousDoc, req }) as unknown as ChangeArgs
const deletion = (doc: object, req = siteRequest) =>
    ({ doc, req }) as unknown as DeleteArgs

beforeEach(() => {
    vi.mocked(revalidatePath).mockClear()
})

describe('revalidateEntryChange', () => {
    it.each([
        ['publishing', published, draft],
        ['changing a published entry', published, published],
        ['unpublishing', draft, published],
        ['publishing a new entry', published, {}],
    ])('refreshes every page on %s', (_, doc, previousDoc) => {
        const args = change(doc, previousDoc)
        expect(revalidateEntryChange(args)).toBe(doc)
        expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/', 'layout')
    })

    it('leaves the pages alone for a draft visitors never saw', () => {
        const args = change(draft, draft)
        revalidateEntryChange(args)
        expect(revalidatePath).not.toHaveBeenCalled()
    })

    it('leaves the pages alone when the caller runs outside the site', () => {
        const args = change(published, draft, seedRequest)
        revalidateEntryChange(args)
        expect(revalidatePath).not.toHaveBeenCalled()
    })
})

describe('revalidateEntryDelete', () => {
    it('refreshes every page when a published entry goes', () => {
        const args = deletion(published)
        expect(revalidateEntryDelete(args)).toBe(published)
        expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/', 'layout')
    })

    it('leaves the pages alone when a draft goes', () => {
        const args = deletion(draft)
        revalidateEntryDelete(args)
        expect(revalidatePath).not.toHaveBeenCalled()
    })
})

describe('post hooks', () => {
    it('refresh every page on a change or a delete', () => {
        const changeArgs = change(post, post)
        const deleteArgs = deletion(post)
        revalidatePostChange(changeArgs)
        revalidatePostDelete(deleteArgs)
        expect(revalidatePath).toHaveBeenCalledTimes(2)
        expect(revalidatePath).toHaveBeenLastCalledWith('/', 'layout')
    })

    it('leave the pages alone outside the site', () => {
        const args = change(post, post, seedRequest)
        revalidatePostChange(args)
        expect(revalidatePath).not.toHaveBeenCalled()
    })
})
