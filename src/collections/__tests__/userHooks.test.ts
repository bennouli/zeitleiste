import { APIError, AuthenticationError, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
    deleteOwnedContent,
    inviteNewUser,
    requireAcceptedInvitation,
    resendInvitationEndpoint,
    stampInvitation,
} from '../userHooks'

const admin = { id: 1, role: 'admin' }
const editor = { id: 2, role: 'editor' }

const fakeRequest = (fields: object) =>
    ({
        t: vi.fn(),
        payload: {
            count: vi.fn().mockResolvedValue({ totalDocs: 1 }),
            logger: { error: vi.fn() },
        },
        ...fields,
    }) as unknown as PayloadRequest

type LoginArgs = Parameters<typeof requireAcceptedInvitation>[0]
type ChangeArgs = Parameters<typeof stampInvitation>[0]
type AfterChangeArgs = Parameters<typeof inviteNewUser>[0]
type DeleteArgs = Parameters<typeof deleteOwnedContent>[0]

describe('requireAcceptedInvitation', () => {
    it('lets an accepted user log in', () => {
        const user = {
            email: 'a@example.test',
            invitationAcceptedAt: '2026-09-01T00:00:00Z',
        }
        const args = {
            context: {},
            req: fakeRequest({}),
            user,
        } as unknown as LoginArgs
        expect(requireAcceptedInvitation(args)).toBe(user)
    })

    it('refuses a pending invitee', () => {
        const user = { email: 'a@example.test', invitationAcceptedAt: null }
        const args = {
            context: {},
            req: fakeRequest({}),
            user,
        } as unknown as LoginArgs
        expect(() => requireAcceptedInvitation(args)).toThrow(
            AuthenticationError
        )
    })

    it('lets the invitation page through while it accepts', () => {
        const user = { email: 'a@example.test', invitationAcceptedAt: null }
        const context = { acceptingInvitation: true }
        const args = {
            context,
            req: fakeRequest({}),
            user,
        } as unknown as LoginArgs
        expect(requireAcceptedInvitation(args)).toBe(user)
    })
})

describe('stampInvitation', () => {
    const now = new Date('2026-09-10T12:00:00Z')
    beforeAll(() => vi.useFakeTimers({ now, toFake: ['Date'] }))
    afterAll(() => vi.useRealTimers())

    it('stamps invitedAt on a new invitee', async () => {
        const data = { email: 'new@example.test', role: 'editor' }
        const args = {
            data,
            operation: 'create',
            req: fakeRequest({}),
        } as unknown as ChangeArgs
        expect(await stampInvitation(args)).toEqual({
            ...data,
            invitedAt: now.toISOString(),
        })
    })

    it('makes the first user an accepted admin', async () => {
        const data = { email: 'first@example.test', role: 'editor' }
        const req = fakeRequest({})
        vi.mocked(req.payload.count).mockResolvedValue({ totalDocs: 0 })
        const args = { data, operation: 'create', req } as unknown as ChangeArgs
        expect(await stampInvitation(args)).toEqual({
            ...data,
            role: 'admin',
            invitationAcceptedAt: now.toISOString(),
        })
    })

    it('leaves an already accepted account alone', async () => {
        const data = {
            email: 'seed@example.test',
            invitationAcceptedAt: '2026-09-01T00:00:00Z',
        }
        const args = {
            data,
            operation: 'create',
            req: fakeRequest({}),
        } as unknown as ChangeArgs
        expect(await stampInvitation(args)).toBe(data)
    })

    it('leaves updates alone', async () => {
        const data = { role: 'editor' }
        const args = {
            data,
            operation: 'update',
            req: fakeRequest({}),
        } as unknown as ChangeArgs
        expect(await stampInvitation(args)).toBe(data)
    })
})

describe('deleteOwnedContent', () => {
    it("deletes everything the user owns, entries before what they link, inside the delete's transaction", async () => {
        const deleteOwned = vi.fn().mockResolvedValue({ docs: [], errors: [] })
        const req = fakeRequest({})
        req.payload.delete = deleteOwned
        const args = { id: editor.id, req } as unknown as DeleteArgs
        await deleteOwnedContent(args)
        const deletedCollections = deleteOwned.mock.calls.map(
            ([options]) => options.collection
        )
        expect(deletedCollections).toEqual([
            'notes',
            'entries',
            'posts',
            'tags',
            'subjects',
            'media',
        ])
        expect(deleteOwned).toHaveBeenCalledWith({
            collection: 'entries',
            where: { owner: { equals: editor.id } },
            overrideAccess: true,
            req,
        })
    })

    it('fails the user delete when an owned document cannot be deleted', async () => {
        const failedEntry = { id: 7, message: 'locked' }
        const deleteOwned = vi
            .fn()
            .mockResolvedValueOnce({ docs: [], errors: [] })
            .mockResolvedValueOnce({ docs: [], errors: [failedEntry] })
        const req = fakeRequest({})
        req.payload.delete = deleteOwned
        const args = { id: editor.id, req } as unknown as DeleteArgs
        await expect(deleteOwnedContent(args)).rejects.toThrow(APIError)
        expect(deleteOwned).toHaveBeenCalledTimes(2)
    })
})

describe('inviteNewUser', () => {
    it('fails the create with a German message when the invitation cannot be sent', async () => {
        const doc = {
            id: 3,
            email: 'new@example.test',
            invitationAcceptedAt: null,
        }
        const req = fakeRequest({})
        Object.assign(req.payload, {
            config: { serverURL: 'https://zeitleiste.example' },
            forgotPassword: vi.fn().mockResolvedValue('tok'),
            sendEmail: vi.fn().mockRejectedValue(new Error('smtp down')),
        })
        const args = {
            doc,
            operation: 'create',
            req,
        } as unknown as AfterChangeArgs
        await expect(inviteNewUser(args)).rejects.toThrow(
            'Die Einladung konnte nicht verschickt werden.'
        )
    })

    it('sends nothing for an accepted account', async () => {
        const doc = {
            id: 3,
            email: 'seed@example.test',
            invitationAcceptedAt: '2026-09-01T00:00:00Z',
        }
        const sendEmail = vi.fn()
        const req = fakeRequest({})
        Object.assign(req.payload, { sendEmail })
        const args = {
            doc,
            operation: 'create',
            req,
        } as unknown as AfterChangeArgs
        expect(await inviteNewUser(args)).toBe(doc)
        expect(sendEmail).not.toHaveBeenCalled()
    })
})

describe('resendInvitationEndpoint', () => {
    it('refuses an editor', async () => {
        const req = fakeRequest({ user: editor, routeParams: { id: '3' } })
        const res = await resendInvitationEndpoint(req)
        expect(res.status).toBe(403)
    })

    it('answers 404 for an unknown user', async () => {
        const req = fakeRequest({ user: admin, routeParams: { id: '3' } })
        Object.assign(req.payload, {
            findByID: vi.fn().mockResolvedValue(null),
        })
        const res = await resendInvitationEndpoint(req)
        expect(res.status).toBe(404)
    })

    it('answers 409 once the invitation is accepted', async () => {
        const accepted = {
            id: 3,
            email: 'a@example.test',
            invitationAcceptedAt: '2026-09-01T00:00:00Z',
        }
        const req = fakeRequest({ user: admin, routeParams: { id: '3' } })
        Object.assign(req.payload, {
            findByID: vi.fn().mockResolvedValue(accepted),
        })
        const res = await resendInvitationEndpoint(req)
        expect(res.status).toBe(409)
    })

    it('answers 500 when the store fails', async () => {
        const outage = new Error('connection lost')
        const req = fakeRequest({ user: admin, routeParams: { id: '3' } })
        Object.assign(req.payload, {
            findByID: vi.fn().mockRejectedValue(outage),
        })
        const res = await resendInvitationEndpoint(req)
        expect(res.status).toBe(500)
    })
})
