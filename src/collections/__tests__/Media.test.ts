import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { mediaCollection } from '../Media'

const requestBy = (user: object | null) =>
    ({ user }) as unknown as PayloadRequest

const createAccess = (canStoreUploads: boolean, req: PayloadRequest) =>
    mediaCollection({ canStoreUploads }).access!.create!({ req } as never)

const updateAccess = (req: PayloadRequest) =>
    mediaCollection({ canStoreUploads: true }).access!.update!({
        req,
    } as never)

describe('media', () => {
    it('lets a logged-in editor upload where uploads can be stored', () => {
        const req = requestBy({ id: 1 })
        expect(createAccess(true, req)).toBe(true)
    })

    it('refuses every upload where uploads cannot be stored', () => {
        const req = requestBy({ id: 1 })
        expect(createAccess(false, req)).toBe(false)
    })

    it('refuses an upload by a visitor', () => {
        const req = requestBy(null)
        expect(createAccess(true, req)).toBe(false)
    })

    it('limits changing an image to its owner', () => {
        const req = requestBy({ id: 1 })
        expect(updateAccess(req)).toEqual({ owner: { equals: 1 } })
    })
})
