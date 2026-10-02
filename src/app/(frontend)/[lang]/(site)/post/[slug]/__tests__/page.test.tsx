import { entries } from '@/data/entries'
import { findEntry } from '@/lib/posts'
import { sampleEntry } from '@/test/entries'
import { render, screen } from '@testing-library/react'
import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PostPage, { generateMetadata } from '../page'

vi.mock('next/navigation', () => ({
    notFound: () => {
        throw new Error('NEXT_NOT_FOUND')
    },
}))

const loadPost = vi.hoisted(() => vi.fn())
const requireReader = vi.hoisted(() => vi.fn())

vi.mock('@/app/(frontend)/reader', () => ({ requireReader }))

vi.mock('@/lib/entries', () => ({ loadPost }))

beforeEach(() => {
    loadPost.mockReset()
    loadPost.mockImplementation((slug: string) =>
        Effect.succeed(findEntry(entries, slug))
    )
    requireReader.mockReset()
    requireReader.mockResolvedValue({ id: 1 })
})

const VISITOR_REDIRECT = new Error('NEXT_REDIRECT')

const params = (slug: string, lang = 'de') => ({
    params: Promise.resolve({ lang, slug }),
})
const noPost = entries.find((e) => !e.post)!

describe('post page', () => {
    it('sends a visitor to the login page before loading the post', async () => {
        requireReader.mockRejectedValue(VISITOR_REDIRECT)
        const englishParams = params('oktoberrevolution', 'en')
        await expect(PostPage(englishParams)).rejects.toBe(VISITOR_REDIRECT)
        await expect(generateMetadata(englishParams)).rejects.toBe(
            VISITOR_REDIRECT
        )
        expect(requireReader).toHaveBeenCalledWith('en')
        expect(loadPost).not.toHaveBeenCalled()
    })

    it('renders the post loaded by its slug alone', async () => {
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
