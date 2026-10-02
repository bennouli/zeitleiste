import { paragraphsToLexical } from '@/lib/richText'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNote, deleteNote, updateNote } from '../actions'

const payloadStub = vi.hoisted(() => ({
    auth: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload: async () => payloadStub }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/payload.config', () => ({ default: {} }))

const AUTHOR = { id: 4, collection: 'users', email: 'a@example.test' }
const BODY = paragraphsToLexical('Kiew 1240')
const STORED = { id: 7, body: BODY, updatedAt: '2026-10-02T10:00:00.000Z' }

function signedInAs(user: typeof AUTHOR | null) {
    payloadStub.auth.mockResolvedValue({ user })
}

beforeEach(() => {
    vi.resetAllMocks()
})

describe('a visitor', () => {
    beforeEach(() => signedInAs(null))

    it('cannot write, change or delete a note', async () => {
        const noteId = STORED.id

        const created = await createNote(BODY)
        const updated = await updateNote(noteId, BODY)
        const deletion = await deleteNote(noteId)

        expect([created, updated, deletion]).toEqual([
            { stored: false, signedOut: true },
            { stored: false, signedOut: true },
            { deleted: false, signedOut: true },
        ])
        expect(payloadStub.create).not.toHaveBeenCalled()
        expect(payloadStub.update).not.toHaveBeenCalled()
        expect(payloadStub.delete).not.toHaveBeenCalled()
    })
})

describe('a signed-in user', () => {
    beforeEach(() => signedInAs(AUTHOR))

    it('creates a note as itself through access control', async () => {
        payloadStub.create.mockResolvedValue(STORED)

        const change = await createNote(BODY)

        expect(change).toEqual({ stored: true, note: STORED })
        expect(payloadStub.create).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'notes',
                data: { owner: AUTHOR.id, body: BODY },
                user: AUTHOR,
                overrideAccess: false,
            })
        )
    })

    it('updates and deletes through access control', async () => {
        payloadStub.update.mockResolvedValue(STORED)
        payloadStub.delete.mockResolvedValue(STORED)
        const noteId = STORED.id

        await updateNote(noteId, BODY)
        await deleteNote(noteId)

        const throughAccess = expect.objectContaining({
            collection: 'notes',
            id: noteId,
            user: AUTHOR,
            overrideAccess: false,
        })
        expect(payloadStub.update).toHaveBeenCalledWith(throughAccess)
        expect(payloadStub.delete).toHaveBeenCalledWith(throughAccess)
    })

    it('rejects a body that is not rich text before Payload sees it', async () => {
        const notRichText = { text: 'Kiew' }

        const change = await createNote(notRichText)

        expect(change).toEqual({ stored: false, signedOut: false })
        expect(payloadStub.create).not.toHaveBeenCalled()
    })

    it('rejects an id that is not a note id before Payload sees it', async () => {
        const notAnId = '7; drop table notes'

        const change = await updateNote(notAnId, BODY)
        const deletion = await deleteNote(notAnId)

        expect([change, deletion]).toEqual([
            { stored: false, signedOut: false },
            { deleted: false, signedOut: false },
        ])
        expect(payloadStub.update).not.toHaveBeenCalled()
        expect(payloadStub.delete).not.toHaveBeenCalled()
    })

    it('reports a change Payload refuses as not stored', async () => {
        const forbidden = new Error('Forbidden')
        payloadStub.update.mockRejectedValue(forbidden)
        const noteId = STORED.id

        const change = await updateNote(noteId, BODY)

        expect(change).toEqual({ stored: false, signedOut: false })
    })
})
