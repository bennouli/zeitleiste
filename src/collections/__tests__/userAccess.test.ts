import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import {
    adminOnly,
    adminOrFirstUser,
    adminOrSelf,
    loggedIn,
    ownerOnly,
} from '../userAccess'

const admin = { id: 1, role: 'admin' }
const editor = { id: 2, role: 'editor' }

const requestFor = (user: object | null, userCount = 1) =>
    ({
        req: {
            user,
            payload: {
                count: vi.fn().mockResolvedValue({ totalDocs: userCount }),
            },
        } as unknown as PayloadRequest,
    }) as Parameters<typeof adminOnly>[0]

describe('adminOnly', () => {
    it('allows an admin', () => {
        const args = requestFor(admin)
        expect(adminOnly(args)).toBe(true)
    })

    it('denies an editor', () => {
        const args = requestFor(editor)
        expect(adminOnly(args)).toBe(false)
    })

    it('denies a visitor', () => {
        const args = requestFor(null)
        expect(adminOnly(args)).toBe(false)
    })
})

describe('adminOrFirstUser', () => {
    it('allows an admin', async () => {
        const args = requestFor(admin)
        expect(await adminOrFirstUser(args)).toBe(true)
    })

    it('denies an editor', async () => {
        const args = requestFor(editor)
        expect(await adminOrFirstUser(args)).toBe(false)
    })

    it('denies a visitor once a user exists', async () => {
        const args = requestFor(null, 1)
        expect(await adminOrFirstUser(args)).toBe(false)
    })

    it('allows a visitor on an empty database', async () => {
        const args = requestFor(null, 0)
        expect(await adminOrFirstUser(args)).toBe(true)
    })
})

describe('adminOrSelf', () => {
    it('allows an admin every user', () => {
        const args = requestFor(admin)
        expect(adminOrSelf(args)).toBe(true)
    })

    it('limits an editor to their own document', () => {
        const args = requestFor(editor)
        expect(adminOrSelf(args)).toEqual({
            id: { equals: 2 },
        })
    })

    it('denies a visitor', () => {
        const args = requestFor(null)
        expect(adminOrSelf(args)).toBe(false)
    })
})

describe('loggedIn', () => {
    it('allows any logged-in user', () => {
        const args = requestFor(editor)
        expect(loggedIn(args)).toBe(true)
    })

    it('denies a visitor', () => {
        const args = requestFor(null)
        expect(loggedIn(args)).toBe(false)
    })
})

describe('ownerOnly', () => {
    it('limits an editor to the documents they own', () => {
        const args = requestFor(editor)
        expect(ownerOnly(args)).toEqual({ owner: { equals: 2 } })
    })

    it('limits an admin to the documents they own', () => {
        const args = requestFor(admin)
        expect(ownerOnly(args)).toEqual({ owner: { equals: 1 } })
    })

    it('denies a visitor', () => {
        const args = requestFor(null)
        expect(ownerOnly(args)).toBe(false)
    })
})
