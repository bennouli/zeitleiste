import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { Site } from '../Site'

const requireReader = vi.hoisted(() => vi.fn())
const loadEntries = vi.hoisted(() => vi.fn())

vi.mock('../reader', () => ({ requireReader }))
vi.mock('@/lib/entries', () => ({ loadEntries }))

const VISITOR_REDIRECT = new Error('NEXT_REDIRECT')

describe('Site', () => {
    it('loads no entries for a visitor', async () => {
        requireReader.mockRejectedValue(VISITOR_REDIRECT)
        loadEntries.mockReturnValue(Effect.succeed([]))
        const siteProps = { lang: 'en', children: null }
        await expect(Site(siteProps)).rejects.toBe(VISITOR_REDIRECT)
        expect(requireReader).toHaveBeenCalledWith('en')
        expect(loadEntries).not.toHaveBeenCalled()
    })
})
