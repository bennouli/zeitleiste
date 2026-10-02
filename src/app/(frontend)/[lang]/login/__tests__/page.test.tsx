import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '../page'

const currentReader = vi.hoisted(() => vi.fn())

vi.mock('@/app/(frontend)/reader', () => ({ currentReader }))
vi.mock('../actions', () => ({ logInAction: vi.fn() }))
vi.mock('next/navigation', () => ({
    notFound: () => {
        throw new Error('NEXT_NOT_FOUND')
    },
    redirect: (href: string) => {
        throw new Error(`NEXT_REDIRECT ${href}`)
    },
}))

const propsFor = (lang: string, redirect?: string) => ({
    params: Promise.resolve({ lang }),
    searchParams: Promise.resolve({ redirect }),
})

beforeEach(() => {
    currentReader.mockReset()
})

describe('login page', () => {
    it('shows a visitor the login form', async () => {
        currentReader.mockResolvedValue(null)
        const englishProps = propsFor('en', '/en/post/x')
        render(await LoginPage(englishProps))
        expect(
            screen.getByRole('heading', { level: 1, name: 'Sign in' })
        ).toBeInTheDocument()
    })

    it('sends a logged-in user on to the requested page', async () => {
        currentReader.mockResolvedValue({ id: 1 })
        const englishProps = propsFor('en', '/en/post/x')
        await expect(LoginPage(englishProps)).rejects.toThrow(
            /^NEXT_REDIRECT \/en\/post\/x$/
        )
    })

    it('sends a logged-in user to the start page instead of another host', async () => {
        currentReader.mockResolvedValue({ id: 1 })
        const foreignProps = propsFor('de', 'https://evil.example/de')
        await expect(LoginPage(foreignProps)).rejects.toThrow(
            /^NEXT_REDIRECT \/de$/
        )
    })

    it('is a 404 under an address without a known locale', async () => {
        const unknownProps = propsFor('xx')
        await expect(LoginPage(unknownProps)).rejects.toThrow('NEXT_NOT_FOUND')
    })
})
