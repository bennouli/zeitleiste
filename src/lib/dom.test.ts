import { stubReducedMotion } from '@/test/motion'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasNoLayout, isTypingTarget, prefersReducedMotion } from './dom'

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('hasNoLayout', () => {
    it('is true only for a rect with neither width nor height', () => {
        const zeroSize = { width: 0, height: 0 }
        const zeroWidth = { width: 0, height: 20 }
        const zeroHeight = { width: 20, height: 0 }

        expect(hasNoLayout(zeroSize)).toBe(true)
        expect(hasNoLayout(zeroWidth)).toBe(false)
        expect(hasNoLayout(zeroHeight)).toBe(false)
    })
})

describe('isTypingTarget', () => {
    it.each(['input', 'textarea', 'select'])('is true for a <%s>', (tag) => {
        const control = document.createElement(tag)
        expect(isTypingTarget(control)).toBe(true)
    })

    it('is true for a contentEditable element', () => {
        const editable = document.createElement('div')
        Object.defineProperty(editable, 'isContentEditable', { value: true })
        expect(isTypingTarget(editable)).toBe(true)
    })

    it('is false for other elements, non-HTML targets and null', () => {
        const button = document.createElement('button')
        const svg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg'
        )
        expect(isTypingTarget(button)).toBe(false)
        expect(isTypingTarget(svg)).toBe(false)
        expect(isTypingTarget(window)).toBe(false)
        expect(isTypingTarget(null)).toBe(false)
    })
})

describe('prefersReducedMotion', () => {
    it('follows the reduced-motion media query', () => {
        stubReducedMotion(true)
        expect(prefersReducedMotion()).toBe(true)
        stubReducedMotion(false)
        expect(prefersReducedMotion()).toBe(false)
    })

    it('is false where matchMedia is unavailable', () => {
        vi.stubGlobal('matchMedia', undefined)
        expect(prefersReducedMotion()).toBe(false)
    })
})
