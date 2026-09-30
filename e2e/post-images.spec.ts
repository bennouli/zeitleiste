import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { Payload } from 'payload'
import { paragraphsToLexical } from '../src/lib/richText'
import { localPayload } from './payload'

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const QUIET = { disableRevalidate: true }
const FIXTURE = 'e2e/fixtures/image.png'
const ALT = `Ein braunes Rechteck ${RUN}`
const CAPTION = 'Ein Bild, das der e2e-Lauf anlegt und wieder löscht.'
const CREDIT = 'e2e-Fixture'

type Created = { collection: 'entries' | 'posts' | 'media'; id: number }

let payload: Payload
const created: Created[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
    payload = await localPayload()
})

test.afterAll(async () => {
    for (const { collection, id } of created.reverse()) {
        await payload.delete({ collection, id, context: QUIET })
    }
})

async function createImage() {
    const data = await readFile(FIXTURE)
    const file = {
        data,
        name: `e2e-${RUN}.png`,
        mimetype: 'image/png',
        size: data.length,
    }
    const doc = await payload.create({
        collection: 'media',
        locale: 'de',
        data: { alt: ALT, caption: CAPTION, credit: CREDIT },
        file,
    })
    created.push({ collection: 'media', id: doc.id })
    return doc
}

async function createPostWithImage(mediaId: number) {
    const { root } = paragraphsToLexical('Ein Absatz über dem Bild.')
    const imageNode = {
        type: 'upload',
        version: 3,
        format: '',
        id: `e2e-${RUN}`,
        relationTo: 'media',
        value: mediaId,
        fields: {},
    }
    const body = { root: { ...root, children: [...root.children, imageNode] } }
    const doc = await payload.create({
        collection: 'posts',
        locale: 'de',
        data: { body },
        context: QUIET,
    })
    created.push({ collection: 'posts', id: doc.id })
    return doc
}

async function createEntry(post: number) {
    const data = {
        title: `E2E Bild ${RUN}`,
        summary: 'Ein Eintrag, den der e2e-Lauf anlegt und wieder löscht.',
        startYear: 1995,
        type: 'event' as const,
        post,
        _status: 'published' as const,
    }
    const doc = await payload.create({
        collection: 'entries',
        locale: 'de',
        data,
        context: QUIET,
    })
    created.push({ collection: 'entries', id: doc.id })
    return doc
}

test('an image in a post shows with its alt text, caption and a srcset', async ({
    page,
}) => {
    const media = await createImage()
    const post = await createPostWithImage(media.id)
    const entry = await createEntry(post.id)

    await page.goto(`/de/post/${entry.slug}`)

    const figure = page.getByRole('article').getByRole('figure')
    const image = figure.getByRole('img', { name: ALT })
    await expect(image).toHaveAttribute('srcset', /\d+w/)
    await expect(figure).toContainText(CAPTION)
    await expect(figure).toContainText(CREDIT)
    await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0)
})
