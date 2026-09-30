import type { Field, PayloadRequest, TextField } from 'payload'
import { describe, expect, it } from 'vitest'
import { mediaCollection } from '../Media'

const requestIn = (locale: string, user: object | null = null) =>
    ({
        locale,
        user,
        t: (key: string) => key,
        payload: { config: {} },
    }) as unknown as PayloadRequest

const isText = (field: Field): field is TextField =>
    'name' in field && field.type === 'text'

function validateAlt(value: string, req: PayloadRequest) {
    const media = mediaCollection({ canStoreUploads: true })
    const alt = media.fields.filter(isText).find((f) => f.name === 'alt')
    return alt!.validate!(value as never, { req } as never)
}

const createAccess = (canStoreUploads: boolean, req: PayloadRequest) =>
    mediaCollection({ canStoreUploads }).access!.create!({ req } as never)

describe('media', () => {
    it('refuses an image without German alt text', () => {
        const req = requestIn('de')
        expect(validateAlt('', req)).not.toBe(true)
    })

    it('accepts an image with German alt text', () => {
        const req = requestIn('de')
        expect(validateAlt('Der Zar', req)).toBe(true)
    })

    it('accepts an image without English alt text', () => {
        const req = requestIn('en')
        expect(validateAlt('', req)).toBe(true)
    })

    it('lets a logged-in editor upload where uploads can be stored', () => {
        const req = requestIn('de', { id: 1 })
        expect(createAccess(true, req)).toBe(true)
    })

    it('refuses every upload where uploads cannot be stored', () => {
        const req = requestIn('de', { id: 1 })
        expect(createAccess(false, req)).toBe(false)
    })

    it('refuses an upload by a visitor', () => {
        const req = requestIn('de')
        expect(createAccess(true, req)).toBe(false)
    })
})
