import { messages } from '@/i18n/messages'
import { describe, expect, it } from 'vitest'
import { PRIVATE_UNDER_TESTS } from '../useEntryPicker'
import type { EntrySearchOutcome } from '../useEntrySearch'

const { entrySearchStatus } = PRIVATE_UNDER_TESTS

const KIEW_ENTRY = { id: 32, title: 'Mongolen erobern Kiew' }
const NOWGOROD_ENTRY = { id: 31, title: 'Nowgorod wird Republik' }

describe('entrySearchStatus', () => {
    const notesText = messages.de.notes

    it('counts what was found and says when nothing was', () => {
        const noMatch: EntrySearchOutcome = { status: 'found', entries: [] }
        const oneMatch: EntrySearchOutcome = {
            status: 'found',
            entries: [KIEW_ENTRY],
        }
        const twoMatches: EntrySearchOutcome = {
            status: 'found',
            entries: [KIEW_ENTRY, NOWGOROD_ENTRY],
        }

        expect(
            [noMatch, oneMatch, twoMatches].map((outcome) =>
                entrySearchStatus(outcome, notesText)
            )
        ).toEqual([
            'Kein Eintrag gefunden.',
            'Ein Eintrag gefunden.',
            '2 Einträge gefunden.',
        ])
    })

    it('hints before typing and asks to sign in again once the session ended', () => {
        const idle: EntrySearchOutcome = { status: 'idle' }
        const signedOut: EntrySearchOutcome = { status: 'signedOut' }

        expect(entrySearchStatus(idle, notesText)).toBe(
            notesText.entrySearchHint
        )
        expect(entrySearchStatus(signedOut, notesText)).toBe(
            notesText.failed.signedOut
        )
    })
})
