import { MS_PER_DAY } from './time'

export const INVITATION_VALID_MS = 7 * MS_PER_DAY

export const isInvitationCurrent = (invitedAt: Date, now: Date): boolean =>
    now.getTime() - invitedAt.getTime() <= INVITATION_VALID_MS
