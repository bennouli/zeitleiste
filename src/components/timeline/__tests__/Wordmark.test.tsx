import { APP_NAME } from '@/lib/brand'
import { inLocale } from '@/test/i18n'
import { stubReducedMotion } from '@/test/motion'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRIVATE_UNDER_TESTS } from '../useWordmarkTyping'
import { Wordmark } from '../Wordmark'

const TYPING_MS = 1500

beforeEach(() => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    PRIVATE_UNDER_TESTS.forgetTyping()
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('Wordmark', () => {
    it('is named by the Latin name while it reads «линия»', () => {
        render(<Wordmark />, { wrapper: inLocale('de') })

        expect(screen.getByRole('img', { name: APP_NAME })).toBeVisible()
    })

    it('carries the name, hidden while motion is allowed, beside the «линия» frame with a caret', () => {
        const { container } = render(<Wordmark />, { wrapper: inLocale('de') })
        const name = screen.getByText(APP_NAME, { exact: true })
        const typing = container.querySelector('[data-wordmark-typing]')!

        expect(name).toHaveClass('motion-safe:invisible')
        expect(typing).toHaveTextContent(/^линия$/)
        expect(typing).toHaveClass('motion-reduce:hidden')
        expect(typing.querySelector('[data-wordmark-caret]')).not.toBeNull()
    })

    it('ends as the plain name, without the Cyrillic or the caret', () => {
        const { container } = render(<Wordmark />, { wrapper: inLocale('de') })

        act(() => vi.advanceTimersByTime(TYPING_MS))

        expect(container).toHaveTextContent(/^liniya$/)
        expect(screen.getByText(APP_NAME, { exact: true })).not.toHaveClass(
            'motion-safe:invisible'
        )
        expect(container.querySelector('[data-wordmark-caret]')).toBeNull()
    })
})
