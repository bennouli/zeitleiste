import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../I18nContext'
import { LanguageSwitch } from '../LanguageSwitch'

const nav = vi.hoisted(() => ({ pathname: '/de' }))

vi.mock('next/navigation', () => ({
    usePathname: () => nav.pathname,
}))

describe('LanguageSwitch', () => {
    it('links a German post to the same post in English', () => {
        nav.pathname = '/de/post/oktoberrevolution'
        render(
            <I18nProvider locale="de">
                <LanguageSwitch />
            </I18nProvider>
        )
        const link = screen.getByRole('link', { name: 'English' })
        expect(link).toHaveAttribute('href', '/en/post/oktoberrevolution')
        expect(link).toHaveAttribute('hreflang', 'en')
        expect(link).toHaveAttribute('lang', 'en')
    })

    it('links the English start page to the German one', () => {
        nav.pathname = '/en'
        render(
            <I18nProvider locale="en">
                <LanguageSwitch />
            </I18nProvider>
        )
        const link = screen.getByRole('link', { name: 'Deutsch' })
        expect(link).toHaveAttribute('href', '/de')
        expect(link).toHaveAttribute('hreflang', 'de')
    })
})
