'use client'

import { useI18n } from '@/components/I18nContext'
import type { Messages } from '@/i18n/messages'
import { useEffect, useRef } from 'react'
import { useNotes } from './NotesContext'
import { useEntrySearch, type EntrySearchOutcome } from './useEntrySearch'

/** The entry picker's search field, its status line and the entries to offer, focused on open. */
export function useEntryPicker() {
    const { t } = useI18n()
    const { searchEntries } = useNotes()
    const { query, setQuery, outcome } = useEntrySearch(searchEntries)
    const inputRef = useRef<HTMLInputElement>(null)
    useEffect(() => inputRef.current?.focus(), [])
    return {
        query,
        setQuery,
        inputRef,
        statusText: entrySearchStatus(outcome, t.notes),
        entries: outcome.status === 'found' ? outcome.entries : [],
    }
}

/** What the search is doing or found, in words for its status line. */
function entrySearchStatus(
    outcome: EntrySearchOutcome,
    notesText: Messages['notes']
): string {
    switch (outcome.status) {
        case 'idle':
            return notesText.entrySearchHint
        case 'searching':
            return notesText.entrySearching
        case 'found':
            return outcome.entries.length === 0
                ? notesText.noEntryFound
                : notesText.entriesFound(outcome.entries.length)
        case 'failed':
            return notesText.entrySearchFailed
        case 'signedOut':
            return notesText.failed.signedOut
    }
}

export const PRIVATE_UNDER_TESTS = { entrySearchStatus }
