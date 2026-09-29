import { Effect, Exit } from 'effect'
import { APIError, type Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { acceptInvitation, resendInvitation } from '../invitation'

const now = new Date('2026-09-10T12:00:00Z')
const TRANSACTION_ID = 'tx-1'

const invitee = (fields: object) => ({
    id: 5,
    email: 'editor@example.test',
    ...fields,
})

const fakePayload = (resetPassword: () => Promise<unknown>) => {
    const db = {
        beginTransaction: vi.fn().mockResolvedValue(TRANSACTION_ID),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    }
    const payload = {
        db,
        resetPassword: vi.fn(resetPassword),
        update: vi.fn().mockResolvedValue({}),
    }
    return { db, payload, asPayload: payload as unknown as Payload }
}

const acceptance = { token: 'abc123', password: 'new-password', now }

const failureTag = (exit: Exit.Exit<unknown, { _tag: string }>) =>
    Exit.isFailure(exit)
        ? exit.cause.reasons.map((reason) =>
              reason._tag === 'Fail' ? reason.error._tag : reason._tag
          )
        : []

describe('acceptInvitation', () => {
    it('sets the password and marks the invitation accepted', async () => {
        const user = invitee({ invitedAt: '2026-09-05T12:00:00Z' })
        const { db, payload, asPayload } = fakePayload(async () => ({ user }))
        const exit = await Effect.runPromiseExit(
            acceptInvitation(asPayload, acceptance)
        )
        expect(Exit.isSuccess(exit)).toBe(true)
        expect(payload.resetPassword).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { token: 'abc123', password: 'new-password' },
                context: { acceptingInvitation: true },
                req: { transactionID: TRANSACTION_ID },
            })
        )
        expect(payload.update).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 5,
                data: { invitationAcceptedAt: now.toISOString() },
                req: { transactionID: TRANSACTION_ID },
            })
        )
        expect(db.commitTransaction).toHaveBeenCalledWith(TRANSACTION_ID)
        expect(db.rollbackTransaction).not.toHaveBeenCalled()
    })

    it('rolls back an invitation older than 7 days', async () => {
        const user = invitee({ invitedAt: '2026-09-01T11:59:59Z' })
        const { db, payload, asPayload } = fakePayload(async () => ({ user }))
        const exit = await Effect.runPromiseExit(
            acceptInvitation(asPayload, acceptance)
        )
        expect(failureTag(exit)).toEqual(['InvitationUnusable'])
        expect(payload.update).not.toHaveBeenCalled()
        expect(db.rollbackTransaction).toHaveBeenCalledWith(TRANSACTION_ID)
        expect(db.commitTransaction).not.toHaveBeenCalled()
    })

    it('rolls back a reset link used by an accepted user', async () => {
        const user = invitee({
            invitedAt: '2026-09-05T12:00:00Z',
            invitationAcceptedAt: '2026-09-06T12:00:00Z',
        })
        const { db, asPayload } = fakePayload(async () => ({ user }))
        const exit = await Effect.runPromiseExit(
            acceptInvitation(asPayload, acceptance)
        )
        expect(failureTag(exit)).toEqual(['InvitationUnusable'])
        expect(db.rollbackTransaction).toHaveBeenCalledWith(TRANSACTION_ID)
    })

    it('reports an unknown or used token as unusable', async () => {
        const rejected = new APIError(
            'Token is either invalid or has expired.',
            403
        )
        const { db, asPayload } = fakePayload(() => Promise.reject(rejected))
        const exit = await Effect.runPromiseExit(
            acceptInvitation(asPayload, acceptance)
        )
        expect(failureTag(exit)).toEqual(['InvitationUnusable'])
        expect(db.rollbackTransaction).toHaveBeenCalledWith(TRANSACTION_ID)
    })

    it('reports any other failure as a failure', async () => {
        const outage = new Error('connection lost')
        const { asPayload } = fakePayload(() => Promise.reject(outage))
        const exit = await Effect.runPromiseExit(
            acceptInvitation(asPayload, acceptance)
        )
        expect(failureTag(exit)).toEqual(['InvitationAcceptFailed'])
    })
})

const pendingInvitee = { id: 9, email: 'late@example.test' }

const fakeInviter = (
    invitee: object | null,
    sendEmail: () => Promise<unknown>
) => {
    const db = {
        beginTransaction: vi.fn().mockResolvedValue(TRANSACTION_ID),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    }
    const payload = {
        db,
        config: { serverURL: 'https://zeitleiste.example' },
        findByID: vi.fn().mockResolvedValue(invitee),
        update: vi.fn().mockResolvedValue({}),
        forgotPassword: vi.fn().mockResolvedValue('tok123'),
        sendEmail: vi.fn(sendEmail),
    }
    return { db, payload, asPayload: payload as unknown as Payload }
}

describe('resendInvitation', () => {
    it('stamps invitedAt and mails a fresh link in one transaction', async () => {
        const { db, payload, asPayload } = fakeInviter(
            pendingInvitee,
            async () => ({})
        )
        const exit = await Effect.runPromiseExit(
            resendInvitation(asPayload, '9', now)
        )
        expect(Exit.isSuccess(exit)).toBe(true)
        expect(payload.update).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 9,
                data: { invitedAt: now.toISOString() },
                req: { transactionID: TRANSACTION_ID },
            })
        )
        expect(payload.forgotPassword).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { email: 'late@example.test' },
                disableEmail: true,
                req: { transactionID: TRANSACTION_ID },
            })
        )
        expect(payload.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'late@example.test',
                html: expect.stringContaining(
                    'https://zeitleiste.example/einladung/tok123'
                ),
            })
        )
        expect(db.commitTransaction).toHaveBeenCalledWith(TRANSACTION_ID)
    })

    it('rolls back the new token and date when the mail fails', async () => {
        const bounce = new Error('smtp down')
        const { db, asPayload } = fakeInviter(pendingInvitee, () =>
            Promise.reject(bounce)
        )
        const exit = await Effect.runPromiseExit(
            resendInvitation(asPayload, '9', now)
        )
        expect(failureTag(exit)).toEqual(['InvitationMailFailed'])
        expect(db.rollbackTransaction).toHaveBeenCalledWith(TRANSACTION_ID)
        expect(db.commitTransaction).not.toHaveBeenCalled()
    })

    it('reports an unknown user', async () => {
        const { asPayload } = fakeInviter(null, async () => ({}))
        const exit = await Effect.runPromiseExit(
            resendInvitation(asPayload, '9', now)
        )
        expect(failureTag(exit)).toEqual(['InvitationUserMissing'])
    })

    it('refuses an accepted invitation', async () => {
        const accepted = {
            ...pendingInvitee,
            invitationAcceptedAt: '2026-09-02T00:00:00Z',
        }
        const { payload, asPayload } = fakeInviter(accepted, async () => ({}))
        const exit = await Effect.runPromiseExit(
            resendInvitation(asPayload, '9', now)
        )
        expect(failureTag(exit)).toEqual(['InvitationAlreadyAccepted'])
        expect(payload.sendEmail).not.toHaveBeenCalled()
    })
})
