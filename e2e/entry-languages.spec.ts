import { expect, test } from '@playwright/test'
import { Effect } from 'effect'
import type { Payload } from 'payload'
import type * as EntriesLoader from '../src/lib/entries'
import { paragraphsToLexical } from '../src/lib/richText'
import { localPayload } from './payload'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const QUIET = { disableRevalidate: true }

type Created = { collection: 'entries' | 'posts'; id: number }

let payload: Payload
let loader: typeof EntriesLoader
const created: Created[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
    payload = await localPayload()
    loader = await import('../src/lib/entries')
})

test.afterAll(async () => {
    for (const { collection, id } of created.reverse()) {
        await payload.delete({ collection, id, context: QUIET })
    }
})

const germanEntry = (title: string, post?: number) => ({
    title,
    summary: `Zusammenfassung ${RUN}`,
    startYear: 1995,
    type: 'event' as const,
    post,
    _status: 'published' as const,
})

async function createGermanEntry(title: string, post?: number) {
    const data = germanEntry(title, post)
    const doc = await payload.create({
        collection: 'entries',
        locale: 'de',
        data,
        context: QUIET,
    })
    created.push({ collection: 'entries', id: doc.id })
    return doc
}

async function createPost(germanText: string, englishText: string) {
    const germanBody = paragraphsToLexical(germanText)
    const englishBody = paragraphsToLexical(englishText)
    const doc = await payload.create({
        collection: 'posts',
        locale: 'de',
        data: { body: germanBody },
        context: QUIET,
    })
    created.push({ collection: 'posts', id: doc.id })
    await payload.update({
        collection: 'posts',
        id: doc.id,
        locale: 'en',
        data: { body: englishBody },
        context: QUIET,
    })
    return doc
}

async function translate(id: number, title: string, summary: string) {
    const data = { title, summary }
    return payload.update({
        collection: 'entries',
        id,
        locale: 'en',
        data,
        context: QUIET,
    })
}

const textOf = (body: { root: { children: unknown[] } }) =>
    JSON.stringify(body.root.children)

test('an entry with English texts is read in English', async () => {
    const post = await createPost(
        `Deutscher Text ${RUN}`,
        `English text ${RUN}`
    )
    const entry = await createGermanEntry(`Deutsch übersetzt ${RUN}`, post.id)
    const englishTitle = `Translated ${RUN}`
    const englishSummary = `English summary ${RUN}`
    await translate(entry.id, englishTitle, englishSummary)

    const entries = await loader.loadEntries('en').pipe(Effect.runPromise)
    const withPost = await loader
        .loadPost(entry.slug!, 'en')
        .pipe(Effect.runPromise)

    expect(entries.find((e) => e.id === entry.slug)).toMatchObject({
        title: englishTitle,
        summary: englishSummary,
    })
    expect(textOf(withPost!.post!.body)).toContain(`English text ${RUN}`)
})

test('an entry without English texts is read in German on the English site', async () => {
    const germanTitle = `Nur deutsch ${RUN}`
    const entry = await createGermanEntry(germanTitle)

    const entries = await loader.loadEntries('en').pipe(Effect.runPromise)

    expect(entries.find((e) => e.id === entry.slug)).toMatchObject({
        title: germanTitle,
        summary: `Zusammenfassung ${RUN}`,
    })
})

test('an English save keeps the address of an unlocked entry', async () => {
    const entry = await createGermanEntry(`Adresse bleibt ${RUN}`)
    const unlocked = { title: `Address stays ${RUN}`, generateSlug: true }

    const translated = await payload.update({
        collection: 'entries',
        id: entry.id,
        locale: 'en',
        data: unlocked,
        context: QUIET,
    })

    expect(translated.slug).toBe(entry.slug)
})

test('an entry without a German title or summary is not saved', async () => {
    const withoutTitle = germanEntry('')
    const withoutSummary = { ...germanEntry(`Ohne ${RUN}`), summary: '' }
    const save = (data: ReturnType<typeof germanEntry>) =>
        payload.create({
            collection: 'entries',
            locale: 'de',
            data,
            context: QUIET,
        })

    await expect(save(withoutTitle)).rejects.toMatchObject({
        data: { errors: [{ path: 'title' }] },
    })
    await expect(save(withoutSummary)).rejects.toMatchObject({
        data: { errors: [{ path: 'summary' }] },
    })
})

test('an entry without an English title is saved', async () => {
    const entry = await createGermanEntry(`Ohne Englisch ${RUN}`)
    const englishSummaryOnly = { summary: `English only summary ${RUN}` }

    const saved = payload.update({
        collection: 'entries',
        id: entry.id,
        locale: 'en',
        data: englishSummaryOnly,
        context: QUIET,
    })

    await expect(saved).resolves.toMatchObject({ id: entry.id })
})
