import type { FieldHookArgs } from 'payload'
import { describe, expect, it } from 'vitest'
import { ownedBy, ownerField } from '../ownership'

const stampOwner = ownerField.hooks!.beforeValidate![0]!

const stampArgs = (
    operation: 'create' | 'update',
    user: object | null,
    value: unknown
) => ({ operation, req: { user }, value }) as unknown as FieldHookArgs

describe('ownerField', () => {
    it('stores the logged-in user on create, whatever the request sends', () => {
        const args = stampArgs('create', { id: 2 }, 7)
        expect(stampOwner(args)).toBe(2)
    })

    it('keeps the owner a request without a user passes on create', () => {
        const args = stampArgs('create', null, 7)
        expect(stampOwner(args)).toBe(7)
    })

    it('leaves the owner alone on update', () => {
        const args = stampArgs('update', { id: 2 }, 7)
        expect(stampOwner(args)).toBe(7)
    })
})

describe('ownedBy', () => {
    it('offers a user only their own documents', () => {
        const user = { id: 2 }
        expect(ownedBy(user)).toEqual({ owner: { equals: 2 } })
    })

    it('offers a request without a user every document', () => {
        expect(ownedBy(null)).toEqual({})
    })
})
