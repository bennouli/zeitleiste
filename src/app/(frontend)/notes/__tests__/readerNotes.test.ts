import { paragraphsToLexical } from '@/lib/richText'
import type { User } from '@/payload-types'
import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadReaderNotes } from '../readerNotes'

const payloadStub = vi.hoisted(() => ({ find: vi.fn() }))

vi.mock('payload', () => ({ getPayload: async () => payloadStub }))
vi.mock('@/payload.config', () => ({ default: {} }))

const READER = {
    id: 4,
    collection: 'users',
    email: 'reader@example.test',
} as User
const BODY = paragraphsToLexical('Kiew 1240')
const STORED = {
    id: 7,
    body: BODY,
    updatedAt: '2026-10-02T10:00:00.000Z',
    entry: null,
}

beforeEach(() => {
    vi.resetAllMocks()
})

describe('loadReaderNotes', () => {
    it('reads only through access control, newest change first', async () => {
        const foundNotes = { docs: [STORED] }
        payloadStub.find.mockResolvedValue(foundNotes)

        const notesLoad = await Effect.runPromise(loadReaderNotes(READER))

        expect(notesLoad).toEqual({ notes: [STORED], loadFailed: false })
        expect(payloadStub.find).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'notes',
                user: READER,
                overrideAccess: false,
                sort: '-updatedAt',
                where: {},
            })
        )
    })

    it('brings the title of each linked entry along', async () => {
        const entry = { id: 31, title: 'Mongolen erobern Kiew' }
        const foundNotes = { docs: [{ ...STORED, entry }] }
        payloadStub.find.mockResolvedValue(foundNotes)

        const notesLoad = await Effect.runPromise(loadReaderNotes(READER))

        expect(notesLoad.notes).toEqual([{ ...STORED, entry }])
        expect(payloadStub.find).toHaveBeenCalledWith(
            expect.objectContaining({
                select: expect.objectContaining({ entry: true }),
                populate: { entries: { title: true } },
            })
        )
    })

    it('reports a failed load instead of failing the page', async () => {
        const databaseDown = new Error('database down')
        payloadStub.find.mockRejectedValue(databaseDown)

        const notesLoad = await Effect.runPromise(loadReaderNotes(READER))

        expect(notesLoad).toEqual({ notes: [], loadFailed: true })
    })

    it('skips a stored note it cannot read and keeps the others', async () => {
        const unreadable = { ...STORED, id: 8, body: { root: 'kaputt' } }
        const foundNotes = { docs: [unreadable, STORED] }
        payloadStub.find.mockResolvedValue(foundNotes)

        const notesLoad = await Effect.runPromise(loadReaderNotes(READER))

        expect(notesLoad).toEqual({ notes: [STORED], loadFailed: false })
    })
})
