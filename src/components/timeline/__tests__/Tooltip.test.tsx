import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    PRIVATE_UNDER_TESTS,
    Tooltip,
    TooltipBody,
    TooltipMeta,
    TooltipTitle,
} from '../Tooltip'

const {
    anchoredNotePosition,
    cursorNotePosition,
    anchorHidden,
    CURSOR_OFFSET_PX,
    VIEWPORT_MARGIN_PX,
} = PRIVATE_UNDER_TESTS

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

    it('positions by placement, flush with the left edge', () => {
        const { rerender } = render(
            <Tooltip id="tip" open placement="top">
                x
            </Tooltip>
        )
        expect(screen.getByRole('tooltip')).toHaveClass('bottom-full', 'left-0')
        rerender(
            <Tooltip id="tip" open placement="bottom">
                x
            </Tooltip>
        )
        expect(screen.getByRole('tooltip')).toHaveClass('top-full', 'left-0')
    })

    it('is a 288 px note on the page colour with only an ink rule on its left, appearing without a fade', () => {
        const anchorRef = { current: document.createElement('div') }
        render(
            <Tooltip id="tip" open placement="top" anchorRef={anchorRef}>
                x
            </Tooltip>
        )
        const note = screen.getByRole('tooltip')
        expect(note).toHaveClass(
            'w-72',
            'bg-surface',
            'border-l',
            'border-fg',
            'py-2',
            'pl-2.5',
            'pr-0',
            'gap-1.5'
        )
        const boxClasses = [...note.classList].filter((c) =>
            /^(border|rounded|shadow|ring|transition|duration)/.test(c)
        )
        expect(boxClasses).toEqual(['border-l', 'border-fg'])
    })

    it('portals the open note into the main landmark', () => {
        const main = document.body.appendChild(document.createElement('main'))
        const anchorRef = {
            current: main.appendChild(document.createElement('div')),
        }
        try {
            render(
                <Tooltip id="tip" open placement="top" anchorRef={anchorRef}>
                    x
                </Tooltip>
            )
            expect(screen.getByRole('tooltip').parentElement).toBe(main)
        } finally {
            main.remove()
        }
    })

    it('sets meta, title and body lines in their type styles', () => {
        render(
            <Tooltip id="tip" open placement="top">
                <TooltipMeta>1917 · Revolution</TooltipMeta>
                <TooltipTitle>Oktoberrevolution</TooltipTitle>
                <TooltipBody>Die Bolschewiki übernehmen die Macht.</TooltipBody>
            </Tooltip>
        )
        expect(screen.getByText('1917 · Revolution')).toHaveClass(
            'small-caps',
            'text-label',
            'tracking-label',
            'font-medium',
            'text-fg'
        )
        expect(screen.getByText('Oktoberrevolution')).toHaveClass(
            'font-serif',
            'text-note-title'
        )
        expect(
            screen.getByText('Die Bolschewiki übernehmen die Macht.')
        ).toHaveClass('font-serif', 'text-note', 'text-fg-soft')
    })
})

describe('anchoredNotePosition', () => {
    const anchor = { left: 100, top: 400, right: 276, bottom: 456 }
    const note = { width: 250, height: 100 }
    const viewportWidth = 1000

    it.each([
        ['top', { left: 100, top: 292 }],
        ['bottom', { left: 100, top: 464 }],
    ] as const)('places it %s, 8 px off the anchor', (placement, expected) => {
        expect(
            anchoredNotePosition(anchor, note, viewportWidth, placement)
        ).toEqual(expected)
    })

    it('keeps the viewport margin on the right', () => {
        const rightAnchor = { left: 900, top: 400, right: 1076, bottom: 456 }
        expect(
            anchoredNotePosition(rightAnchor, note, viewportWidth, 'top')
        ).toEqual({ left: 742, top: 292 })
    })

    it('keeps the viewport margin on the left', () => {
        const leftAnchor = { left: 0, top: 400, right: 176, bottom: 456 }
        expect(
            anchoredNotePosition(leftAnchor, note, viewportWidth, 'top')
        ).toEqual({ left: 8, top: 292 })
    })
})

describe('cursorNotePosition', () => {
    const note = { width: 250, height: 100 }
    const viewport = { width: 1000, height: 800 }

    it('sits the offset right of and below the cursor', () => {
        const cursor = { x: 300, y: 200 }
        expect(cursorNotePosition(cursor, note, viewport)).toEqual({
            left: 300 + CURSOR_OFFSET_PX,
            top: 200 + CURSOR_OFFSET_PX,
        })
    })

    it('stays inside the right and bottom edges', () => {
        const nearCorner = { x: 990, y: 790 }
        expect(cursorNotePosition(nearCorner, note, viewport)).toEqual({
            left: 1000 - 250 - VIEWPORT_MARGIN_PX,
            top: 800 - 100 - VIEWPORT_MARGIN_PX,
        })
    })

    it('keeps the left and top margin in a viewport smaller than the note', () => {
        const cursor = { x: 50, y: 20 }
        const tinyViewport = { width: 200, height: 80 }
        expect(cursorNotePosition(cursor, note, tinyViewport)).toEqual({
            left: VIEWPORT_MARGIN_PX,
            top: VIEWPORT_MARGIN_PX,
        })
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
