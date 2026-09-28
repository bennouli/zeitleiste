import { entries } from '@/data/entries'
import { postSlugs } from '@/lib/posts'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PostPage, {
    dynamicParams,
    generateMetadata,
    generateStaticParams,
} from './page'

vi.mock('next/navigation', () => ({
    notFound: () => {
        throw new Error('NEXT_NOT_FOUND')
    },
}))

const params = (slug: string) => ({ params: Promise.resolve({ slug }) })
const noPost = entries.find((e) => !e.post)!

describe('post page', () => {
    it('prebuilds exactly the posts', () => {
        expect(generateStaticParams()).toEqual(
            postSlugs(entries).map((slug) => ({ slug }))
        )
        expect(dynamicParams).toBe(false)
    })

    it('renders the post', async () => {
        render(await PostPage(params('oktoberrevolution')))
        expect(
            screen.getByRole('heading', { level: 2, name: 'Oktoberrevolution' })
        ).toBeInTheDocument()
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
        const okt = entries.find((e) => e.id === 'oktoberrevolution')!
        expect(await generateMetadata(params('oktoberrevolution'))).toEqual({
            title: 'Oktoberrevolution – Zeitleiste',
            description: okt.summary,
        })
        expect(await generateMetadata(params('gibt-es-nicht'))).toEqual({})
    })
})
