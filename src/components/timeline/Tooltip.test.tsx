import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRIVATE_UNDER_TESTS, Tooltip } from './Tooltip'

const { bubblePosition, anchorHidden } = PRIVATE_UNDER_TESTS

describe('Tooltip', () => {
    it('is hidden while closed but keeps its id for aria-describedby', () => {
        const { container } = render(
            <Tooltip id="tip" open={false} placement="top">
                Inhalt
            </Tooltip>
        )
        expect(screen.queryByRole('tooltip')).toBeNull()
        const el = container.querySelector('#tip')
        expect(el).not.toBeNull()
        expect(el).toHaveAttribute('hidden')
    })

    it('shows its content while open', () => {
        render(
            <Tooltip id="tip" open placement="bottom">
                Inhalt
            </Tooltip>
        )
        expect(screen.getByRole('tooltip')).toHaveTextContent('Inhalt')
    })

    it('positions by placement and alignment', () => {
        const { rerender } = render(
            <Tooltip id="tip" open placement="top">
                x
            </Tooltip>
        )
        expect(screen.getByRole('tooltip')).toHaveClass('bottom-full', 'left-0')
        rerender(
            <Tooltip id="tip" open placement="bottom" align="end">
                x
            </Tooltip>
        )
        expect(screen.getByRole('tooltip')).toHaveClass('top-full', 'right-0')
    })
})

describe('bubblePosition', () => {
    const anchor = { left: 100, top: 400, right: 276, bottom: 456 }
    const bubble = { width: 288, height: 100 }
    const viewportWidth = 1000

    it.each([
        ['top', 'start', { left: 100, top: 300 }],
        ['bottom', 'start', { left: 100, top: 456 }],
        ['top', 'end', { left: 8, top: 300 }],
    ] as const)('places it %s, %s', (placement, align, expected) => {
        expect(
            bubblePosition(anchor, bubble, viewportWidth, placement, align)
        ).toEqual(expected)
    })

    it('flushes an end-aligned bubble with the anchor’s right edge', () => {
        const wideAnchor = { left: 500, top: 400, right: 900, bottom: 456 }
        expect(
            bubblePosition(wideAnchor, bubble, viewportWidth, 'top', 'end')
        ).toEqual({ left: 612, top: 300 })
    })

    it('keeps the viewport margin on the right', () => {
        const rightAnchor = { left: 900, top: 400, right: 1076, bottom: 456 }
        expect(
            bubblePosition(rightAnchor, bubble, viewportWidth, 'top', 'start')
        ).toEqual({ left: 704, top: 300 })
    })
})

describe('anchorHidden', () => {
    const anchor = document.createElement('div')

    function clipperAt(rect: DOMRect): HTMLElement {
        const el = document.createElement('div')
        el.getBoundingClientRect = () => rect
        return el
    }

    beforeEach(() => {
        const root = document.documentElement
        vi.spyOn(root, 'clientWidth', 'get').mockReturnValue(1000)
        vi.spyOn(root, 'clientHeight', 'get').mockReturnValue(800)
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('shows an anchor inside the viewport', () => {
        const inside = new DOMRect(100, 100, 176, 56)
        expect(anchorHidden(anchor, inside, [])).toBe(false)
    })

    it('hides an anchor outside the viewport', () => {
        const leftOfViewport = new DOMRect(-400, 100, 176, 56)
        expect(anchorHidden(anchor, leftOfViewport, [])).toBe(true)
    })

    it('hides an anchor outside the intersection of its clippers', () => {
        const clippers = [
            clipperAt(new DOMRect(0, 0, 500, 800)),
            clipperAt(new DOMRect(0, 300, 1000, 500)),
        ]
        const inFirstOnly = new DOMRect(100, 100, 176, 56)
        const inBoth = new DOMRect(100, 400, 176, 56)
        expect(anchorHidden(anchor, inFirstOnly, clippers)).toBe(true)
        expect(anchorHidden(anchor, inBoth, clippers)).toBe(false)
    })

    it('judges no anchor without layout', () => {
        const unlaidOut = new DOMRect(-400, -400, 0, 0)
        expect(anchorHidden(anchor, unlaidOut, [])).toBe(false)
    })

    it('hides an anchor inside an inert subtree', () => {
        const inertParent = document.createElement('div')
        inertParent.setAttribute('inert', '')
        const inertAnchor = document.createElement('div')
        inertParent.append(inertAnchor)
        const inside = new DOMRect(100, 100, 176, 56)
        expect(anchorHidden(inertAnchor, inside, [])).toBe(true)
    })
})
