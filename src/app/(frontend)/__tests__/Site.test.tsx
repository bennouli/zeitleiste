import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { Site } from '../Site'

const requireReader = vi.hoisted(() => vi.fn())
const loadEntries = vi.hoisted(() => vi.fn())
const loadReaderNotes = vi.hoisted(() => vi.fn())

vi.mock('../reader', () => ({ requireReader }))
vi.mock('@/lib/entries', () => ({ loadEntries }))
vi.mock('../notes/readerNotes', () => ({ loadReaderNotes }))
vi.mock('../notes/actions', () => ({
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    linkNote: vi.fn(),
    searchEntries: vi.fn(),
}))

const VISITOR_REDIRECT = new Error('NEXT_REDIRECT')
const READER = { id: 4, collection: 'users' }

describe('Site', () => {
    it('loads no entries for a visitor', async () => {
        requireReader.mockRejectedValue(VISITOR_REDIRECT)
        loadEntries.mockReturnValue(Effect.succeed([]))
        const siteProps = { lang: 'en', children: null }
        await expect(Site(siteProps)).rejects.toBe(VISITOR_REDIRECT)
        expect(requireReader).toHaveBeenCalledWith('en')
        expect(loadEntries).not.toHaveBeenCalled()
        expect(loadReaderNotes).not.toHaveBeenCalled()
    })

    it('loads the entries and notes of the reader it verified', async () => {
        const notesLoad = { notes: [], loadFailed: false }
        requireReader.mockResolvedValue(READER)
        loadEntries.mockReturnValue(Effect.succeed([]))
        loadReaderNotes.mockReturnValue(Effect.succeed(notesLoad))
        const siteProps = { lang: 'de', children: null }

        await Site(siteProps)

        expect(loadEntries).toHaveBeenCalledWith(READER)
        expect(loadReaderNotes).toHaveBeenCalledWith(READER)
    })
})
