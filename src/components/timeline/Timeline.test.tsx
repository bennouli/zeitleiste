import { entries } from '@/data/entries'
import type { Entry } from '@/lib/entry'
import { entryAnchor, MS_PER_YEAR, startOf } from '@/lib/time'
import { MAX_VISIBLE_MS, ZOOM_STEP_FACTOR } from '@/lib/viewport'
import { expectNoAxeViolations } from '@/test/axe'
import { sampleEntry } from '@/test/entries'
import { stubReducedMotion } from '@/test/motion'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANIMATION_MS, COLLAPSED_HEIGHT, FOCUS_VISIBLE_MS } from './constants'
import { revealDelta, Timeline } from './Timeline'

const WIDTH = 1000
const HEIGHT = 800
const NOW = Date.UTC(2026, 8, 27, 12)
/** A point in time with a post that stands alone at the widest zoom. */
const POST_POINT = sampleEntry('fall-der-berliner-mauer')
/** The first sample entry (a span) plus one card that is never grouped. */
const FEW: Entry[] = [entries[0]!, POST_POINT]

class ResizeObserverStub {
    constructor(private cb: ResizeObserverCallback) {}
    observe() {
        this.cb([], this as unknown as ResizeObserver)
    }
    unobserve() {}
    disconnect() {}
}

function renderTimeline(
    props: Partial<React.ComponentProps<typeof Timeline>> = {}
) {
    const onOpenEntry = vi.fn()
    const utils = render(
        <Timeline
            entries={entries}
            collapsed={false}
            focusEntryId={null}
            onOpenEntry={onOpenEntry}
            {...props}
        />
    )
    const region = screen.getByRole('region', { name: 'Zeitleiste' })
    return { ...utils, region, onOpenEntry }
}

function view(region: HTMLElement) {
    const start = Number(region.dataset.viewStart)
    const end = Number(region.dataset.viewEnd)
    return { start, end, span: end - start, center: (start + end) / 2 }
}

function flush(ms = ANIMATION_MS + 100) {
    act(() => {
        vi.advanceTimersByTime(ms)
    })
}

const pointer = (
    pointerId: number,
    clientX: number,
    pointerType = 'mouse'
) => ({
    pointerId,
    clientX,
    pointerType,
    button: 0,
    buttons: 1,
    isPrimary: pointerId === 1,
})

beforeEach(() => {
    vi.useFakeTimers({
        toFake: [
            'requestAnimationFrame',
            'cancelAnimationFrame',
            'performance',
            'setTimeout',
            'clearTimeout',
            'Date',
        ],
    })
    vi.setSystemTime(NOW)
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(WIDTH)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
        HEIGHT
    )
    stubReducedMotion(false)
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('Timeline', () => {
    it('renders the region with ticks, the "Heute" mark and entry markers', () => {
        const { region, container } = renderTimeline()
        expect(region).toHaveAttribute('tabindex', '0')
        expect(
            container.querySelectorAll('[data-tick]').length
        ).toBeGreaterThan(2)
        expect(
            container.querySelectorAll('[data-tick="major"]').length
        ).toBeGreaterThan(0)
        expect(screen.getByText('Heute')).toBeInTheDocument()
        for (const layer of ['above', 'axis', 'below', 'spans']) {
            expect(
                container.querySelector(`[data-layer="${layer}"]`)
            ).not.toBeNull()
        }
        expect(
            screen.getByRole('button', { name: new RegExp(POST_POINT.title) })
        ).toHaveClass('cursor-pointer')
        // The span band shows the first entry (a span without a post) as a bar.
        expect(
            screen.getByRole('group', { name: new RegExp(entries[0]!.title) })
        ).toHaveClass('cursor-pointer')
        expect(region).toHaveClass(
            'cursor-grab',
            'overflow-clip',
            'touch-pan-y',
            'select-none'
        )
    })

    it('axis runs from the earliest entry to today; an earlier entry moves the start', () => {
        const { region, rerender } = renderTimeline()
        const earliest = Math.min(...entries.map((e) => startOf(e.start)))
        const today = Date.UTC(2026, 8, 27)
        const v = view(region)
        expect(v.end).toBe(today)
        expect(v.start).toBeCloseTo(
            Math.max(earliest, today - MAX_VISIBLE_MS),
            -3
        )
        expect(
            screen.getByRole('button', { name: 'Herauszoomen' })
        ).toHaveAttribute('aria-disabled', 'true')

        const early: Entry = {
            ...entries[0]!,
            id: 'early',
            title: 'Früh',
            start: { year: 1600 },
            end: undefined,
        }
        rerender(
            <Timeline
                entries={[early, ...entries]}
                collapsed={false}
                focusEntryId={null}
                onOpenEntry={() => {}}
            />
        )
        // Range now exceeds MAX_VISIBLE_MS: still right-aligned to today, but zooming out is limited by MAX.
        expect(view(region).end).toBe(today)
    })

    it('has no axe violations', async () => {
        vi.useRealTimers()
        const { container } = renderTimeline()
        await expectNoAxeViolations(container)
    })

    it('zoom buttons zoom around the center with animation and disable at the limit', () => {
        const { region } = renderTimeline()
        const zoomIn = screen.getByRole('button', { name: 'Hineinzoomen' })
        const zoomOut = screen.getByRole('button', { name: 'Herauszoomen' })
        const before = view(region)
        fireEvent.click(zoomIn)
        flush()
        const after = view(region)
        expect(after.span).toBeCloseTo(before.span / ZOOM_STEP_FACTOR, -3)
        expect(after.center).toBeCloseTo(before.center, -3)
        expect(zoomOut).toHaveAttribute('aria-disabled', 'false')
        fireEvent.click(zoomOut)
        flush()
        expect(view(region).span).toBeCloseTo(before.span, -3)
        expect(zoomOut).toHaveAttribute('aria-disabled', 'true')
    })

    it('keyboard: + / - zoom, arrows pan, ctrl/meta combos are left to the browser', () => {
        stubReducedMotion(true)
        const { region } = renderTimeline()
        const before = view(region)
        fireEvent.keyDown(region, { key: '+', ctrlKey: true })
        expect(view(region).span).toBe(before.span)
        fireEvent.keyDown(region, { key: '+' })
        expect(view(region).span).toBeCloseTo(before.span / 2, -3)
        const zoomed = view(region)
        fireEvent.keyDown(region, { key: 'ArrowLeft' })
        expect(view(region).start).toBeCloseTo(
            zoomed.start - zoomed.span * 0.1,
            -3
        )
        fireEvent.keyDown(region, { key: '-' })
        expect(view(region).span).toBeCloseTo(before.span, -3)
    })

    it('wheel events do not change the viewport and are not prevented', () => {
        const { region } = renderTimeline()
        const before = view(region)
        const plain = new WheelEvent('wheel', {
            deltaY: 100,
            bubbles: true,
            cancelable: true,
        })
        const ctrl = new WheelEvent('wheel', {
            deltaY: -100,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        })
        region.dispatchEvent(plain)
        region.dispatchEvent(ctrl)
        flush()
        expect(plain.defaultPrevented).toBe(false)
        expect(ctrl.defaultPrevented).toBe(false)
        expect(view(region)).toEqual(before)
    })

    it('dragging pans by dx, shows grabbing cursor, glides after release', () => {
        const { region } = renderTimeline()
        fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }))
        flush()
        const before = view(region)
        fireEvent.pointerDown(region, pointer(1, 500))
        vi.advanceTimersByTime(16)
        fireEvent.pointerMove(region, pointer(1, 520))
        expect(region).toHaveClass('cursor-grabbing')
        vi.advanceTimersByTime(16)
        fireEvent.pointerMove(region, pointer(1, 560))
        const dragged = view(region)
        expect(dragged.start).toBeCloseTo(
            before.start - (before.span / WIDTH) * 60,
            -3
        )
        vi.advanceTimersByTime(16)
        fireEvent.pointerUp(region, pointer(1, 580))
        expect(region).toHaveClass('cursor-grab')
        flush(3000)
        // Glided further to the past than the release position.
        expect(view(region).start).toBeLessThan(
            before.start - (before.span / WIDTH) * 80
        )
    })

    it('a press that moves < 6 px opens the entry; a drag from an entry does not', () => {
        const { onOpenEntry } = renderTimeline({ entries: FEW })
        const marker = screen.getByRole('button', {
            name: new RegExp(POST_POINT.title),
        })
        fireEvent.pointerDown(marker, pointer(1, 300))
        fireEvent.pointerMove(marker, pointer(1, 304))
        fireEvent.pointerUp(marker, pointer(1, 304))
        fireEvent.click(marker, { detail: 1 })
        expect(onOpenEntry).toHaveBeenCalledWith(POST_POINT.id)

        onOpenEntry.mockClear()
        fireEvent.pointerDown(marker, pointer(1, 300))
        fireEvent.pointerMove(marker, pointer(1, 310))
        fireEvent.pointerUp(marker, pointer(1, 310))
        fireEvent.click(marker, { detail: 1 })
        expect(onOpenEntry).not.toHaveBeenCalled()

        // A later keyboard activation is not treated as a drag.
        act(() => {
            vi.advanceTimersByTime(10)
        })
        fireEvent.click(marker, { detail: 0 })
        expect(onOpenEntry).toHaveBeenCalledTimes(1)
    })

    it('vertical swipe cancel ends the gesture without gliding', () => {
        const { region } = renderTimeline()
        fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }))
        flush()
        fireEvent.pointerDown(region, pointer(1, 500, 'touch'))
        fireEvent.pointerMove(region, pointer(1, 540, 'touch'))
        const afterMove = view(region)
        fireEvent.pointerCancel(region, pointer(1, 540, 'touch'))
        flush(2000)
        expect(view(region)).toEqual(afterMove)
        expect(region).toHaveClass('cursor-grab')
    })

    it('pinch hands over to a drag when one finger lifts, without momentum after the pinch', () => {
        const { region } = renderTimeline()
        fireEvent.pointerDown(region, pointer(1, 400, 'touch'))
        fireEvent.pointerDown(region, pointer(2, 600, 'touch'))
        fireEvent.pointerMove(region, pointer(2, 800, 'touch'))
        fireEvent.pointerUp(region, pointer(1, 400, 'touch'))
        const afterPinch = view(region)
        fireEvent.pointerMove(region, pointer(2, 850, 'touch'))
        expect(view(region).start).toBeCloseTo(
            afterPinch.start - (afterPinch.span / WIDTH) * 50,
            -3
        )
    })

    it('recovers from a lost pointerup and does not pan on plain hover', () => {
        const { region } = renderTimeline()
        fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }))
        flush()
        fireEvent.pointerDown(region, pointer(1, 500))
        // Released outside the window: next move reports no buttons.
        const before = view(region)
        fireEvent.pointerMove(region, { ...pointer(1, 560), buttons: 0 })
        expect(view(region)).toEqual(before)
        fireEvent.pointerDown(region, pointer(1, 500))
        fireEvent.pointerMove(region, { ...pointer(1, 540), buttons: 1 })
        expect(view(region).start).toBeLessThan(before.start)
    })

    it('a new entries array does not refocus', () => {
        stubReducedMotion(true)
        const entry = sampleEntry('russlandfeldzug-1812')
        const { region, rerender } = renderTimeline({
            focusEntryId: entry.id,
            collapsed: true,
        })
        fireEvent.keyDown(region, { key: 'ArrowRight' })
        const moved = view(region)
        rerender(
            <Timeline
                entries={[...entries]}
                collapsed
                focusEntryId={entry.id}
                onOpenEntry={() => {}}
            />
        )
        expect(view(region)).toEqual(moved)
    })

    it('pressing a zoom button does not cancel a running zoom animation', () => {
        const { region } = renderTimeline()
        const zoomIn = screen.getByRole('button', { name: 'Hineinzoomen' })
        const before = view(region)
        fireEvent.click(zoomIn)
        act(() => {
            vi.advanceTimersByTime(50)
        })
        fireEvent.pointerDown(zoomIn, pointer(1, 900))
        fireEvent.pointerUp(zoomIn, pointer(1, 900))
        fireEvent.click(zoomIn)
        flush()
        expect(view(region).span).toBeCloseTo(
            before.span / ZOOM_STEP_FACTOR ** 2,
            -3
        )
    })

    it('pinch with two fingers zooms in when they spread', () => {
        const { region } = renderTimeline()
        const before = view(region)
        fireEvent.pointerDown(region, pointer(1, 400, 'touch'))
        fireEvent.pointerDown(region, pointer(2, 600, 'touch'))
        fireEvent.pointerMove(region, pointer(1, 300, 'touch'))
        fireEvent.pointerMove(region, pointer(2, 700, 'touch'))
        expect(view(region).span).toBeLessThan(before.span * 0.6)
        fireEvent.pointerUp(region, pointer(1, 300, 'touch'))
        fireEvent.pointerUp(region, pointer(2, 700, 'touch'))
        const end = view(region)
        flush(2000)
        expect(view(region)).toEqual(end)
    })

    it('a mostly vertical touch move is left to the page instead of starting a drag', () => {
        const { region } = renderTimeline()
        const before = view(region)
        fireEvent.pointerDown(region, {
            ...pointer(1, 300, 'touch'),
            clientY: 100,
        })
        fireEvent.pointerMove(region, {
            ...pointer(1, 304, 'touch'),
            clientY: 140,
        })
        fireEvent.pointerMove(region, {
            ...pointer(1, 360, 'touch'),
            clientY: 160,
        })
        expect(region).toHaveClass('cursor-grab')
        expect(view(region)).toEqual(before)
        fireEvent.pointerUp(region, {
            ...pointer(1, 360, 'touch'),
            clientY: 160,
        })
    })

    it('focusEntryId centers the entry at FOCUS_VISIBLE_MS and highlights it', () => {
        const entry = POST_POINT
        const { region, rerender, container } = renderTimeline({ entries: FEW })
        rerender(
            <Timeline
                entries={FEW}
                collapsed
                focusEntryId={entry.id}
                onOpenEntry={() => {}}
            />
        )
        flush()
        const v = view(region)
        expect(v.span).toBeCloseTo(FOCUS_VISIBLE_MS, -3)
        expect(v.center).toBeCloseTo(entryAnchor(entry), -3)
        expect(
            container.querySelector(`[data-entry-id="${entry.id}"]`)
        ).toHaveAttribute('data-highlighted', 'true')
    })

    it('collapsed toggles the height', () => {
        const { region, rerender } = renderTimeline()
        expect(region.style.height).toBe('100dvh')
        expect(region).toHaveAttribute('data-collapsed', 'false')
        rerender(
            <Timeline
                entries={entries}
                collapsed
                focusEntryId={null}
                onOpenEntry={() => {}}
            />
        )
        expect(region.style.height).toBe(COLLAPSED_HEIGHT)
        expect(region).toHaveClass(
            'transition-[height]',
            'motion-reduce:transition-none'
        )
    })

    it('works with no entries', () => {
        render(
            <Timeline
                entries={[]}
                collapsed={false}
                focusEntryId={null}
                onOpenEntry={() => {}}
            />
        )
        const v = view(screen.getByRole('region'))
        expect(v.span).toBeCloseTo(100 * MS_PER_YEAR, -3)
    })

    describe('keyboard access', () => {
        const points = entries.filter((e) => e.end === undefined)
        const tabbables = (container: HTMLElement) =>
            [
                ...container.querySelectorAll<HTMLElement>(
                    '[data-layer="points"] :is(button, [tabindex="0"])'
                ),
            ].filter((el) => !el.closest('[inert]'))
        const tOf = (el: HTMLElement) =>
            Number(el.closest<HTMLElement>('[data-t]')!.dataset.t)
        // jsdom never treats programmatic focus as :focus-visible (keyboard focus).
        const asKeyboardFocus = (el: HTMLElement) =>
            vi
                .spyOn(el, 'matches')
                .mockImplementation(
                    (sel) =>
                        sel === ':focus-visible' ||
                        Element.prototype.matches.call(el, sel)
                )

        it('renders every point entry, off-screen ones too, in chronological DOM order', () => {
            const { container } = renderTimeline()
            fireEvent.click(
                screen.getByRole('button', { name: 'Hineinzoomen' })
            )
            fireEvent.click(
                screen.getByRole('button', { name: 'Hineinzoomen' })
            )
            flush()
            const holders = [
                ...container.querySelectorAll<HTMLElement>(
                    '[data-layer="points"] [data-entry-ids]'
                ),
            ]
            const covered = new Set(
                holders.flatMap((h) => h.dataset.entryIds!.split(' '))
            )
            for (const e of points) expect(covered).toContain(e.id)
            const times = tabbables(container).map(tOf)
            expect(times.length).toBeGreaterThan(0)
            expect(times).toEqual([...times].sort((a, b) => a - b))
        })

        it('names a group stack and its marker differently', () => {
            renderTimeline()
            const stacks = screen.getAllByRole('group', {
                name: /^Gruppe mit \d+ Einträgen, \d{4}/,
            })
            expect(stacks.length).toBeGreaterThan(0)
            const name = stacks[0]!.getAttribute('aria-label')!
            expect(
                screen.getByRole('button', { name: `Hineinzoomen: ${name}` })
            ).toBeInTheDocument()
        })

        it('keys typed into a form control neither zoom nor pan', () => {
            const { region } = renderTimeline()
            const before = view(region)
            // Any form control inside the region, e.g. a future filter box.
            const input = document.createElement('input')
            region.appendChild(input)
            for (const key of ['+', '-', 'ArrowLeft', 'ArrowRight'])
                fireEvent.keyDown(input, { key })
            flush()
            expect(view(region)).toEqual(before)
        })

        it('keyboard focus on an off-screen entry pans the timeline to it', () => {
            stubReducedMotion(true)
            const { region, container } = renderTimeline()
            fireEvent.click(
                screen.getByRole('button', { name: 'Hineinzoomen' })
            )
            const before = view(region)
            const target = tabbables(container)[0]!
            vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(
                new DOMRect(0, 0, WIDTH, HEIGHT)
            )
            vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
                new DOMRect(-500, 100, 176, 56)
            )
            asKeyboardFocus(target)
            act(() => target.focus())
            const after = view(region)
            // Moved right by 516 px: the card's left edge lands on the 16 px margin.
            expect(after.span).toBeCloseTo(before.span, -3)
            expect(after.start).toBeCloseTo(
                before.start - 516 * (before.span / WIDTH),
                -3
            )
        })

        it('does not pan for an entry that is already visible', () => {
            stubReducedMotion(true)
            const { region, container } = renderTimeline()
            fireEvent.click(
                screen.getByRole('button', { name: 'Hineinzoomen' })
            )
            const before = view(region)
            const target = tabbables(container)[0]!
            vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(
                new DOMRect(0, 0, WIDTH, HEIGHT)
            )
            vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
                new DOMRect(300, 100, 176, 56)
            )
            asKeyboardFocus(target)
            act(() => target.focus())
            expect(view(region)).toEqual(before)
        })

        it('does not pan when a press (not the keyboard) focuses an entry', () => {
            stubReducedMotion(true)
            const { region, container } = renderTimeline()
            fireEvent.click(
                screen.getByRole('button', { name: 'Hineinzoomen' })
            )
            const before = view(region)
            const target = tabbables(container)[0]!
            vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(
                new DOMRect(0, 0, WIDTH, HEIGHT)
            )
            vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
                new DOMRect(-100, 100, 176, 56)
            )
            act(() => target.focus())
            expect(view(region)).toEqual(before)
        })

        it('keeps focus on the same entry when a relayout replaces its card', () => {
            stubReducedMotion(true)
            const { region, container } = renderTimeline()
            const id = 'februarrevolution'
            const ownCard = () =>
                container.querySelector<HTMLElement>(
                    `[data-item-id="${id}"] [data-entry-id="${id}"] [tabindex="0"]`
                )
            const zoomIn = screen.getByRole('button', { name: 'Hineinzoomen' })
            for (let i = 0; i < 12 && !ownCard(); i++) fireEvent.click(zoomIn)
            const card = ownCard()!
            expect(card).not.toBeNull()
            act(() => card.focus())
            // Zoom out from the card until it is merged into a group.
            for (let i = 0; i < 12 && card.isConnected; i++)
                fireEvent.keyDown(card, { key: '-' })
            expect(card.isConnected).toBe(false)
            const active = document.activeElement as HTMLElement
            expect(region.contains(active)).toBe(true)
            expect(active).not.toBe(region)
            const holder = active.closest<HTMLElement>('[data-entry-ids]')!
            expect(holder.dataset.entryIds!.split(' ')).toContain(id)
        })
    })

    describe('revealDelta', () => {
        it.each([
            ['visible', 100, 276, 0],
            ['cut off left', -50, 126, 66],
            ['off to the right', 1200, 1376, 1000 - 16 - 1376],
            ['wide and visible enough', -2000, 100, 0],
            ['wide and just off the left', -2000, 30, 16 + 2000],
            ['wide and off the right', 990, 3000, 16 - 990],
        ])('%s', (_, left, right, expected) => {
            expect(revealDelta(left, right, 1000)).toBe(expected)
        })
    })
})
