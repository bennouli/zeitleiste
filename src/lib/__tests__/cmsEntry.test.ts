import { entries } from '@/data/entries'
import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import {
    CmsEntry,
    CmsPost,
    entryOf,
    hasTexts,
    postIdOf,
    type TextedCmsEntry,
} from '../cmsEntry'
import type { Entry } from '../entry'
import { paragraphsToLexical } from '../richText'

const decodeCmsEntry = Schema.decodeUnknownSync(CmsEntry)
const decodePost = Schema.decodeUnknownSync(CmsPost)

function decodeEntry(doc: unknown): TextedCmsEntry {
    const decoded = decodeCmsEntry(doc)
    if (!hasTexts(decoded)) throw new Error('entry without texts')
    return decoded
}
/** The Local API's depth-1 document for a sample entry, with ids for everything a visitor may not read. */
function cmsDocOf(entry: Entry, index: number) {
    const end = entry.end === 'ongoing' ? undefined : entry.end
    return {
        id: index + 1,
        slug: entry.id,
        generateSlug: false,
        title: entry.title,
        summary: entry.summary,
        startYear: entry.start.year,
        startMonth: entry.start.month ?? null,
        startDay: entry.start.day ?? null,
        endYear: end?.year ?? null,
        endMonth: end?.month ?? null,
        endDay: end?.day ?? null,
        ongoing: entry.end === 'ongoing',
        startAt: '1700-01-01T00:00:00.000Z',
        endAt: null,
        type: entry.type,
        subject: entry.subject ? { id: 1, slug: entry.subject } : null,
        tags: entry.tags.map((name, i) => ({ id: i + 1, name })),
        partOf: entry.partOf ? { id: 99, slug: entry.partOf } : null,
        post: entry.post ? 500 + index : null,
        updatedAt: '2026-09-29T00:00:00.000Z',
        createdAt: '2026-09-29T00:00:00.000Z',
        _status: 'published',
    }
}

const withoutPost = (entry: Entry): Entry => {
    const { post, ...rest } = entry
    return post === undefined ? entry : rest
}

describe('entryOf', () => {
    it('gives back every sample entry, post aside', () => {
        const docs = entries.map(cmsDocOf)
        const decoded = docs.map((doc) => entryOf(decodeEntry(doc)))
        expect(decoded).toEqual(entries.map(withoutPost))
    })

    it('attaches the post it is handed', () => {
        const post = { body: paragraphsToLexical('Text') }
        const doc = decodeEntry(cmsDocOf(entries[0]!, 0))
        expect(entryOf(doc, post).post).toBe(post)
    })

    it('leaves out relations the visitor may not read', () => {
        const doc = {
            ...cmsDocOf(entries[0]!, 0),
            tags: [7, { id: 8, name: 'Russland' }],
            subject: 3,
            partOf: 4,
        }
        const decoded = decodeEntry(doc)
        const entry = entryOf(decoded)
        expect(entry.tags).toEqual(['Russland'])
        expect(entry).not.toHaveProperty('subject')
        expect(entry).not.toHaveProperty('partOf')
    })

    it('reads an ongoing span, ignoring a stale end', () => {
        const doc = {
            ...cmsDocOf(entries[0]!, 0),
            ongoing: true,
            endYear: 1720,
        }
        const decoded = decodeEntry(doc)
        expect(entryOf(decoded).end).toBe('ongoing')
    })

    it('rejects an entry without a slug', () => {
        const noSlug = { ...cmsDocOf(entries[0]!, 0), slug: null }
        const emptySlug = { ...cmsDocOf(entries[0]!, 0), slug: '' }
        expect(() => decodeEntry(noSlug)).toThrow()
        expect(() => decodeEntry(emptySlug)).toThrow()
    })

    it('rejects an unknown entry type', () => {
        const doc = { ...cmsDocOf(entries[0]!, 0), type: 'battle' }
        expect(() => decodeEntry(doc)).toThrow()
    })
})

describe('hasTexts', () => {
    it('holds for an entry with its title and summary', () => {
        const doc = decodeCmsEntry(cmsDocOf(entries[0]!, 0))
        expect(hasTexts(doc)).toBe(true)
    })

    it('fails for an entry read in a locale it has no texts in', () => {
        const doc = cmsDocOf(entries[0]!, 0)
        const noTitle = decodeCmsEntry({ ...doc, title: null })
        const noSummary = decodeCmsEntry({ ...doc, summary: undefined })
        const emptyTitle = decodeCmsEntry({ ...doc, title: '' })
        expect(hasTexts(noTitle)).toBe(false)
        expect(hasTexts(noSummary)).toBe(false)
        expect(hasTexts(emptyTitle)).toBe(false)
    })
})

describe('postIdOf', () => {
    it('reads the id of a bare or populated post', () => {
        const doc = cmsDocOf(entries[0]!, 0)
        const barePost = decodeEntry({ ...doc, post: 12 })
        const populatedPost = decodeEntry({ ...doc, post: { id: 13 } })
        const noPost = decodeEntry({ ...doc, post: null })
        expect(postIdOf(barePost)).toBe(12)
        expect(postIdOf(populatedPost)).toBe(13)
        expect(postIdOf(noPost)).toBeUndefined()
    })
})

describe('CmsPost', () => {
    it('keeps a rich-text body as stored', () => {
        const body = paragraphsToLexical('Erster Absatz.\n\nZweiter Absatz.')
        const post = { id: 1, body, updatedAt: '', createdAt: '' }
        expect(decodePost(post).body).toEqual(body)
    })

    it('keeps an image in the body, populated or left as the id of a deleted one', () => {
        const media = {
            id: 3,
            url: '/api/media/file/zar.png',
            width: 1200,
            height: 800,
            alt: 'Der Zar',
            caption: null,
            credit: 'Wikimedia Commons',
            sizes: {
                w480: { url: '/api/media/file/zar-480x320.png', width: 480 },
                w1600: { url: '/api/media/file/zar.png' },
            },
            updatedAt: '',
            createdAt: '',
        }
        const body = withRootChildren([uploadNode(media), uploadNode(4)])
        const post = { id: 1, body }
        expect(decodePost(post).body).toEqual(body)
    })

    it('rejects an image without its dimensions', () => {
        const media = { id: 3, url: '/api/media/file/zar.png' }
        const body = withRootChildren([uploadNode(media)])
        const post = { id: 1, body }
        expect(() => decodePost(post)).toThrow()
    })

    it('rejects a post without a body', () => {
        const post = { id: 1 }
        expect(() => decodePost(post)).toThrow()
    })
})

function uploadNode(value: unknown) {
    return {
        type: 'upload',
        version: 3,
        format: '',
        id: 'node-1',
        relationTo: 'media',
        value,
        fields: null,
    }
}

function withRootChildren(children: unknown[]) {
    const { root } = paragraphsToLexical('Ein Absatz.')
    return { root: { ...root, children: [...root.children, ...children] } }
}
