import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HomePage from '../page'

vi.mock('next/navigation', () => ({
    notFound: () => {
        throw new Error('NEXT_NOT_FOUND')
    },
}))

const params = (lang: string) => ({ params: Promise.resolve({ lang }) })

describe('start page', () => {
    it('renders no post (the timeline lives in the layout)', async () => {
        const { container } = render(await HomePage(params('en')))
        expect(container).toBeEmptyDOMElement()
    })

    it('is a 404 under an address without a known locale', async () => {
        await expect(HomePage(params('xx'))).rejects.toThrow('NEXT_NOT_FOUND')
    })
})
