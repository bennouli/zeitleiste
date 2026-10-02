import { entries } from '@/data/entries'
import { findEntry, postSlugs } from '@/lib/posts'
import { sampleEntry } from '@/test/entries'
import { render, screen } from '@testing-library/react'
import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import PostPage, {
    dynamicParams,
    generateMetadata,
    generateStaticParams,
} from '../page'

vi.mock('next/navigation', () => ({
    notFound: () => {
        throw new Error('NEXT_NOT_FOUND')
    },
}))

const loadPost = vi.hoisted(() => vi.fn())

vi.mock('@/lib/entries', () => ({
    loadEntries: () => Effect.succeed(entries),
    loadPost,
}))

loadPost.mockImplementation((slug: string) =>
    Effect.succeed(findEntry(entries, slug))
)

const params = (slug: string, lang = 'de') => ({
    params: Promise.resolve({ lang, slug }),
})
const noPost = entries.find((e) => !e.post)!

describe('post page', () => {
    it('prebuilds the published posts and renders later ones on request', async () => {
        expect(await generateStaticParams()).toEqual(
            postSlugs(entries).map((slug) => ({ slug }))
        )
        expect(dynamicParams).toBe(true)
    })

    it('renders the same post under every locale', async () => {
        const englishParams = params('oktoberrevolution', 'en')
        render(await PostPage(englishParams))
        expect(
            screen.getByRole('heading', { level: 2, name: 'Oktoberrevolution' })
        ).toBeInTheDocument()
        expect(loadPost).toHaveBeenLastCalledWith('oktoberrevolution')
    })

    it('is a 404 under an address without a known locale', async () => {
        const unknownParams = params('oktoberrevolution', 'xx')
        await expect(PostPage(unknownParams)).rejects.toThrow('NEXT_NOT_FOUND')
    })

    it('is a 404 for unknown slugs and entries without a post', async () => {
        await expect(PostPage(params('gibt-es-nicht'))).rejects.toThrow(
            'NEXT_NOT_FOUND'
        )
        await expect(PostPage(params(noPost.id))).rejects.toThrow(
            'NEXT_NOT_FOUND'
        )
    })

    it('sets title and description', async () => {
        const okt = sampleEntry('oktoberrevolution')
        expect(await generateMetadata(params('oktoberrevolution'))).toEqual({
            title: 'Oktoberrevolution – liniya',
            description: okt.summary,
        })
        expect(await generateMetadata(params('gibt-es-nicht'))).toEqual({})
    })

    it('names the site in the language of the address', async () => {
        const englishParams = params('oktoberrevolution', 'en')
        expect(await generateMetadata(englishParams)).toMatchObject({
            title: 'Oktoberrevolution – liniya',
        })
    })
})
