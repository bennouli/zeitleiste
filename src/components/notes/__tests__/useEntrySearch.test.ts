import type { EntrySearch } from '@/lib/noteSchema'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRIVATE_UNDER_TESTS, useEntrySearch } from '../useEntrySearch'

const { SEARCH_DELAY_MS } = PRIVATE_UNDER_TESTS

const KIEW_ENTRY = { id: 32, title: 'Mongolen erobern Kiew' }
const NOWGOROD_ENTRY = { id: 31, title: 'Nowgorod wird Republik' }

function found(...entries: (typeof KIEW_ENTRY)[]): EntrySearch {
    return { searched: true, entries }
}

async function typePausing(
    setQuery: (query: string) => void,
    query: string
): Promise<void> {
    act(() => setQuery(query))
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS))
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

describe('useEntrySearch', () => {
    it('searches nothing for blank text', async () => {
        const search = vi.fn(async () => found())
        const { result } = renderHook(() => useEntrySearch(search))

        await typePausing(result.current.setQuery, '   ')

        expect(result.current.outcome).toEqual({ status: 'idle' })
        expect(search).not.toHaveBeenCalled()
    })

    it('searches the trimmed text once typing pauses', async () => {
        const search = vi.fn(async () => found(KIEW_ENTRY))
        const { result } = renderHook(() => useEntrySearch(search))

        act(() => result.current.setQuery('Ki'))
        act(() => result.current.setQuery('Kiew '))
        expect(result.current.outcome).toEqual({ status: 'searching' })
        await act(() => vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS))

        expect(search.mock.calls).toEqual([['Kiew']])
        expect(result.current.outcome).toEqual({
            status: 'found',
            entries: [KIEW_ENTRY],
        })
    })

    it('keeps only the answer for the latest text', async () => {
        const answers = new Map<string, PromiseWithResolvers<EntrySearch>>([
            ['Kiew', Promise.withResolvers()],
            ['Nowgorod', Promise.withResolvers()],
        ])
        const search = (query: string) =>
            answers.get(query)?.promise ?? Promise.resolve(found())
        const { result } = renderHook(() => useEntrySearch(search))

        await typePausing(result.current.setQuery, 'Kiew')
        await typePausing(result.current.setQuery, 'Nowgorod')
        await act(async () => {
            answers.get('Nowgorod')?.resolve(found(NOWGOROD_ENTRY))
            answers.get('Kiew')?.resolve(found(KIEW_ENTRY))
        })

        expect(result.current.outcome).toEqual({
            status: 'found',
            entries: [NOWGOROD_ENTRY],
        })
    })

    it('tells a failed search from an ended session', async () => {
        const answers: Record<string, EntrySearch> = {
            offline: { searched: false, signedOut: false },
            expired: { searched: false, signedOut: true },
        }
        const search = vi.fn(async (query: string) => {
            if (query === 'kaputt') throw new Error('offline')
            return answers[query] ?? found()
        })
        const { result } = renderHook(() => useEntrySearch(search))

        await typePausing(result.current.setQuery, 'offline')
        const offline = result.current.outcome
        await typePausing(result.current.setQuery, 'kaputt')
        const thrown = result.current.outcome
        await typePausing(result.current.setQuery, 'expired')
        const expired = result.current.outcome

        expect([offline, thrown, expired]).toEqual([
            { status: 'failed' },
            { status: 'failed' },
            { status: 'signedOut' },
        ])
    })
})
