import { paragraphsToLexical } from '@/lib/richText'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createNote,
    deleteNote,
    linkNote,
    listEntryNotes,
    searchEntries,
    updateNote,
} from '../actions'

const payloadStub = vi.hoisted(() => ({
    auth: vi.fn(),
    find: vi.fn(),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload: async () => payloadStub }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/payload.config', () => ({ default: {} }))

const AUTHOR = { id: 4, collection: 'users', email: 'a@example.test' }
const BODY = paragraphsToLexical('Kiew 1240')
const STORED = {
    id: 7,
    body: BODY,
    updatedAt: '2026-10-02T10:00:00.000Z',
    entry: null,
}

const ENTRY = { id: 31, title: 'Mongolen erobern Kiew' }
const LINKED = { ...STORED, entry: ENTRY }

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
        const linked = await linkNote(noteId, ENTRY.id)
        const deletion = await deleteNote(noteId)

        expect([created, updated, linked, deletion]).toEqual([
            { stored: false, signedOut: true },
            { stored: false, signedOut: true },
            { stored: false, signedOut: true },
            { deleted: false, signedOut: true },
        ])
        expect(payloadStub.create).not.toHaveBeenCalled()
        expect(payloadStub.update).not.toHaveBeenCalled()
        expect(payloadStub.delete).not.toHaveBeenCalled()
    })

    it('can neither search the entries nor list the notes of one', async () => {
        const entrySearch = await searchEntries('Kiew')
        const entryNotes = await listEntryNotes(ENTRY.id)

        expect(entrySearch).toEqual({ searched: false, signedOut: true })
        expect(entryNotes).toEqual({ notes: [], loadFailed: true })
        expect(payloadStub.find).not.toHaveBeenCalled()
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

describe('linking a note to an entry', () => {
    beforeEach(() => signedInAs(AUTHOR))

    it('links only to an entry the user may read, through access control', async () => {
        payloadStub.findByID.mockResolvedValue(ENTRY)
        payloadStub.update.mockResolvedValue(LINKED)
        const noteId = STORED.id

        const change = await linkNote(noteId, ENTRY.id)

        expect(change).toEqual({ stored: true, note: LINKED })
        expect(payloadStub.findByID).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'entries',
                id: ENTRY.id,
                user: AUTHOR,
                overrideAccess: false,
            })
        )
        expect(payloadStub.update).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'notes',
                id: noteId,
                data: { entry: ENTRY.id },
                user: AUTHOR,
                overrideAccess: false,
            })
        )
    })

    it('does not link to an entry the user cannot read', async () => {
        const notFound = new Error('Not Found')
        payloadStub.findByID.mockRejectedValue(notFound)
        const noteId = STORED.id

        const change = await linkNote(noteId, ENTRY.id)

        expect(change).toEqual({ stored: false, signedOut: false })
        expect(payloadStub.update).not.toHaveBeenCalled()
    })

    it('removes the link without looking up an entry', async () => {
        payloadStub.update.mockResolvedValue(STORED)
        const noteId = STORED.id

        const change = await linkNote(noteId, null)

        expect(change).toEqual({ stored: true, note: STORED })
        expect(payloadStub.findByID).not.toHaveBeenCalled()
        expect(payloadStub.update).toHaveBeenCalledWith(
            expect.objectContaining({ id: noteId, data: { entry: null } })
        )
    })

    it('returns a body change with the linked entry still attached', async () => {
        payloadStub.update.mockResolvedValue(LINKED)
        const noteId = STORED.id

        const change = await updateNote(noteId, BODY)

        expect(change).toEqual({ stored: true, note: LINKED })
    })

    it('rejects an entry id that is not one before Payload sees it', async () => {
        const notAnId = 'Kiew'

        const change = await linkNote(STORED.id, notAnId)

        expect(change).toEqual({ stored: false, signedOut: false })
        expect(payloadStub.update).not.toHaveBeenCalled()
    })
})

describe('searching the entries', () => {
    beforeEach(() => signedInAs(AUTHOR))

    it('finds entries by title as the user, through access control', async () => {
        const foundEntries = { docs: [ENTRY] }
        payloadStub.find.mockResolvedValue(foundEntries)

        const entrySearch = await searchEntries('  Kiew ')

        expect(entrySearch).toEqual({ searched: true, entries: [ENTRY] })
        expect(payloadStub.find).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'entries',
                where: { title: { like: 'Kiew' } },
                user: AUTHOR,
                overrideAccess: false,
            })
        )
    })

    it('searches nothing for blank text', async () => {
        const blank = '   '

        const entrySearch = await searchEntries(blank)

        expect(entrySearch).toEqual({ searched: false, signedOut: false })
        expect(payloadStub.find).not.toHaveBeenCalled()
    })
})

describe('listing the notes of an entry', () => {
    beforeEach(() => signedInAs(AUTHOR))

    it('lists the user’s notes linked to the entry, through access control', async () => {
        const foundNotes = { docs: [LINKED] }
        payloadStub.find.mockResolvedValue(foundNotes)

        const entryNotes = await listEntryNotes(ENTRY.id)

        expect(entryNotes).toEqual({ notes: [LINKED], loadFailed: false })
        expect(payloadStub.find).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'notes',
                where: { entry: { equals: ENTRY.id } },
                user: AUTHOR,
                overrideAccess: false,
            })
        )
    })
})
