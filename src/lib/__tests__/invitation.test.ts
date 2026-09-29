import { describe, expect, it } from 'vitest'
import { INVITATION_VALID_MS, isInvitationCurrent } from '../invitation'

const invitedAt = new Date('2026-09-01T12:00:00Z')

describe('isInvitationCurrent', () => {
    it('is current right after the invitation', () => {
        const now = new Date('2026-09-01T12:00:01Z')
        expect(isInvitationCurrent(invitedAt, now)).toBe(true)
    })

    it('is current at exactly 7 days', () => {
        const now = new Date(invitedAt.getTime() + INVITATION_VALID_MS)
        expect(isInvitationCurrent(invitedAt, now)).toBe(true)
    })

    it('has expired a millisecond after 7 days', () => {
        const now = new Date(invitedAt.getTime() + INVITATION_VALID_MS + 1)
        expect(isInvitationCurrent(invitedAt, now)).toBe(false)
    })

    it('lasts 7 days', () => {
        expect(INVITATION_VALID_MS).toBe(7 * 24 * 60 * 60 * 1000)
    })
})
