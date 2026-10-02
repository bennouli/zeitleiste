'use client'

import type { Messages } from '@/i18n/messages'
import type { EntrySearch, LinkedEntry } from '@/lib/noteSchema'
import { useEffect, useState } from 'react'

const SEARCH_DELAY_MS = 250

export type EntrySearchOutcome =
    | { status: 'idle' }
    | { status: 'searching' }
    | { status: 'found'; entries: ReadonlyArray<LinkedEntry> }
    | { status: 'failed' }
    | { status: 'signedOut' }

export type EntrySearchState = {
    query: string
    setQuery: (query: string) => void
    outcome: EntrySearchOutcome
}

type SettledSearch = { query: string; outcome: EntrySearchOutcome }

const IDLE: EntrySearchOutcome = { status: 'idle' }
const SEARCHING: EntrySearchOutcome = { status: 'searching' }
const NOT_SEARCHED: EntrySearch = { searched: false, signedOut: false }

/**
 * The entries whose title matches what the user types, searched once typing pauses.
 * Only the answer for the latest text is kept.
 */
export function useEntrySearch(
    search: (query: string) => Promise<EntrySearch>
): EntrySearchState {
    const [query, setQuery] = useState('')
    const [settledSearch, setSettledSearch] = useState<SettledSearch | null>(
        null
    )
    const searchedText = query.trim()

    useEffect(() => {
        if (searchedText === '') return
        let isLatest = true
        const timer = setTimeout(async () => {
            const entrySearch = await search(searchedText).catch(
                () => NOT_SEARCHED
            )
            if (isLatest)
                setSettledSearch({
                    query: searchedText,
                    outcome: outcomeOf(entrySearch),
                })
        }, SEARCH_DELAY_MS)
        return () => {
            isLatest = false
            clearTimeout(timer)
        }
    }, [searchedText, search])

    return {
        query,
        setQuery,
        outcome: currentOutcome(searchedText, settledSearch),
    }
}

/** What the search is doing or found, in words for its status line. */
export function entrySearchStatus(
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

function currentOutcome(
    searchedText: string,
    settledSearch: SettledSearch | null
): EntrySearchOutcome {
    if (searchedText === '') return IDLE
    return settledSearch?.query === searchedText
        ? settledSearch.outcome
        : SEARCHING
}

function outcomeOf(entrySearch: EntrySearch): EntrySearchOutcome {
    if (entrySearch.searched)
        return { status: 'found', entries: entrySearch.entries }
    return { status: entrySearch.signedOut ? 'signedOut' : 'failed' }
}

export const PRIVATE_UNDER_TESTS = { SEARCH_DELAY_MS }
