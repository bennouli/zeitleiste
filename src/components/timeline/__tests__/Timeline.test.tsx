import { entries } from '@/data/entries'
import type { Entry } from '@/lib/entry'
import { entryAnchor, MS_PER_YEAR, startOf } from '@/lib/time'
import {
    PRIVATE_UNDER_TESTS as VIEWPORT_UNDER_TESTS,
    ZOOM_STEP_FACTOR,
} from '@/lib/viewport'
import { expectNoAxeViolations } from '@/test/axe'
import { sampleEntry } from '@/test/entries'
import { stubFocusVisible } from '@/test/focus'
import { stubReducedMotion } from '@/test/motion'
import {
    act,
    fireEvent,
    render,
    renderHook,
    screen,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    CARD_GAP_PX,
    COLLAPSE_ANIMATION_MS,
    COLLAPSED_HEIGHT,
    FOCUS_VISIBLE_MS,
} from '../constants'
import { LABEL_MAX_WIDTH_PX } from '../labelMetrics'
import { PRIVATE_UNDER_TESTS, Timeline } from '../Timeline'

const { dataBounds, useSnapshotPerKey } = PRIVATE_UNDER_TESTS
const { MAX_VISIBLE_MS } = VIEWPORT_UNDER_TESTS

const WIDTH = 1000
const HEIGHT = 800
/** Room before the earliest entry and after today, as a fraction of the visible span. */
const ROOM = (LABEL_MAX_WIDTH_PX + CARD_GAP_PX) / WIDTH
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

/** x of `t` in the region's current view. */
function xOf(region: HTMLElement, t: number) {
    const v = view(region)
    return ((t - v.start) / v.span) * WIDTH
}

function flush(ms = COLLAPSE_ANIMATION_MS + 100) {
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
        for (const layer of ['above', 'axis', 'below']) {
            expect(
                container.querySelector(`[data-layer="${layer}"]`)
            ).not.toBeNull()
        }
        expect(
            screen.getByRole('button', { name: new RegExp(POST_POINT.title) })
        ).toHaveClass('cursor-pointer')
        // The first entry (a span without a post) lies on the axis as a bar.
        expect(
            container.querySelector(
                `[data-layer="axis"] > [data-layer="spans"] [data-span-id="${entries[0]!.id}"]`
            )
        ).not.toBeNull()
        expect(region).toHaveClass(
            'cursor-grab',
            'overflow-clip',
            'touch-pan-y',
            'select-none'
        )
    })

    it('lays out the entries for the measured height from the first render on', () => {
        const itemPositions = (container: HTMLElement) =>
            [
                ...container.querySelectorAll<HTMLElement>(
                    '[data-layer="cards"] [data-entry-id]'
                ),
            ].map((el) => `${el.dataset.entryId} ${el.getAttribute('style')}`)
        const { container } = renderTimeline()
        const firstLayout = itemPositions(container)

        flush()

        expect(firstLayout.length).toBeGreaterThan(0)
        expect(itemPositions(container)).toEqual(firstLayout)
    })

    it('draws no entries before the timeline has a height', () => {
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
            0
        )
        const { container } = renderTimeline()
        expect(container.querySelector('[data-layer="cards"]')).toBeNull()
        expect(container.querySelector('[data-layer="spans"]')).toBeNull()
    })

    it('keeps ticking past today up to the end of the view', () => {
        const { region, container } = renderTimeline()
        const today = Date.UTC(2026, 8, 27)
        expect(view(region).end).toBeGreaterThan(today)
        const tickTimes = [
            ...container.querySelectorAll<HTMLElement>('[data-tick]'),
        ].map((tick) => Number(tick.dataset.t))
        expect(tickTimes.length).toBeGreaterThan(2)
        expect(tickTimes.some((t) => t > today)).toBe(true)
    })

    it('axis runs from the earliest entry to today plus room for a card at each end; an earlier entry moves the start', () => {
        const { region, rerender } = renderTimeline()
        const earliest = Math.min(...entries.map((e) => startOf(e.start)))
        const today = Date.UTC(2026, 8, 27)
        const v = view(region)
        expect(xOf(region, today)).toBeCloseTo(
            WIDTH - LABEL_MAX_WIDTH_PX - CARD_GAP_PX,
            6
        )
        expect(v.span).toBeCloseTo(
            Math.min((today - earliest) / (1 - 2 * ROOM), MAX_VISIBLE_MS),
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
        // Range now exceeds MAX_VISIBLE_MS: still right-aligned to today's room, but zooming out is limited by MAX.
        expect(xOf(region, today)).toBeCloseTo(
            WIDTH - LABEL_MAX_WIDTH_PX - CARD_GAP_PX,
            6
        )
        expect(view(region).span).toBeCloseTo(MAX_VISIBLE_MS, -3)
    })

    it('panning to the end stops with today one card before the right edge', () => {
        stubReducedMotion(true)
        const { region } = renderTimeline()
        const today = Date.UTC(2026, 8, 27)
        const zoomIn = { key: '+' }
        const panLeft = { key: 'ArrowLeft' }
        const panRight = { key: 'ArrowRight' }
        const stepsPastTheEnd = 20
        fireEvent.keyDown(region, zoomIn)
        fireEvent.keyDown(region, panLeft)
        expect(xOf(region, today)).toBeGreaterThan(WIDTH)
        for (let i = 0; i < stepsPastTheEnd; i++)
            fireEvent.keyDown(region, panRight)
        expect(xOf(region, today)).toBeCloseTo(
            WIDTH - LABEL_MAX_WIDTH_PX - CARD_GAP_PX,
            6
        )
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

    describe('wheel', () => {
        const wheel = (init: WheelEventInit) =>
            new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                ...init,
            })

        it('zooms around the pointer without scrolling the page', () => {
            const { region } = renderTimeline()
            const before = view(region)
            const pointerX = 300
            const timeUnderPointer =
                before.start + (pointerX / WIDTH) * before.span
            const scrollUp = wheel({ deltaY: -120, clientX: pointerX })
            act(() => {
                region.dispatchEvent(scrollUp)
            })
            flush()
            expect(scrollUp.defaultPrevented).toBe(true)
            expect(view(region).span).toBeLessThan(before.span)
            expect(xOf(region, timeUnderPointer)).toBeCloseTo(pointerX, 3)
        })

        it.each([
            ['Shift + wheel down', { deltaY: 100, shiftKey: true }],
            ['a leftward swipe', { deltaX: 100 }],
        ])(
            'pans towards later dates on %s without changing the span',
            (_, init) => {
                const { region } = renderTimeline()
                fireEvent.click(
                    screen.getByRole('button', { name: 'Hineinzoomen' })
                )
                flush()
                const before = view(region)
                const panScroll = wheel(init)
                act(() => {
                    region.dispatchEvent(panScroll)
                })
                flush()
                expect(panScroll.defaultPrevented).toBe(true)
                expect(view(region).start).toBeCloseTo(
                    before.start + (before.span / WIDTH) * 100,
                    -3
                )
                expect(view(region).span).toBeCloseTo(before.span, -3)
            }
        )

        it('leaves Ctrl + wheel to the browser', () => {
            const { region } = renderTimeline()
            const before = view(region)
            const ctrlScroll = wheel({ deltaY: -100, ctrlKey: true })
            act(() => {
                region.dispatchEvent(ctrlScroll)
            })
            flush()
            expect(ctrlScroll.defaultPrevented).toBe(false)
            expect(view(region)).toEqual(before)
        })
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
            'duration-500',
            'ease-in-out',
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
        expect(v.span).toBeCloseTo((100 * MS_PER_YEAR) / (1 - 2 * ROOM), -3)
    })

    describe('keyboard access', () => {
        const tabbables = (container: HTMLElement) =>
            [
                ...container.querySelectorAll<HTMLElement>(
                    '[data-layer="cards"] :is(button, [tabindex="0"])'
                ),
            ].filter((el) => !el.closest('[inert]'))
        const tOf = (el: HTMLElement) =>
            Number(el.closest<HTMLElement>('[data-t]')!.dataset.t)

        it('renders every entry, spans too, off-screen ones too, in chronological DOM order', () => {
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
                    '[data-layer="cards"] [data-entry-ids]'
                ),
            ]
            const covered = new Set(
                holders.flatMap((h) => h.dataset.entryIds!.split(' '))
            )
            for (const e of entries) expect(covered).toContain(e.id)
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
            stubFocusVisible(target)
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
            stubFocusVisible(target)
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
})

describe('dataBounds', () => {
    const TODAY = Date.UTC(2026, 8, 27)
    const CENTURY_BACK = {
        min: TODAY - 100 * MS_PER_YEAR,
        max: TODAY,
        startRoom: ROOM,
        endRoom: ROOM,
    }

    it('reaches from the earliest entry start to today, with room for a card at each end', () => {
        const earliest = sampleEntry('grosser-nordischer-krieg')
        const mixed = [POST_POINT, earliest]
        const bounds = dataBounds(mixed, TODAY, WIDTH)
        expect(bounds).toEqual({
            min: startOf(earliest.start),
            max: TODAY,
            startRoom: ROOM,
            endRoom: ROOM,
        })
    })

    it('keeps no room before the width is measured', () => {
        const unmeasured = 0
        const bounds = dataBounds([POST_POINT], TODAY, unmeasured)
        expect(bounds.startRoom).toBe(0)
        expect(bounds.endRoom).toBe(0)
    })

    it('reaches a century back without entries', () => {
        const none: Entry[] = []
        expect(dataBounds(none, TODAY, WIDTH)).toEqual(CENTURY_BACK)
    })

    it('reaches a century back when every entry lies in the future', () => {
        const future: Entry[] = [{ ...POST_POINT, start: { year: 2100 } }]
        expect(dataBounds(future, TODAY, WIDTH)).toEqual(CENTURY_BACK)
    })
})

describe('useSnapshotPerKey', () => {
    it('holds the value until the key changes', () => {
        const initialProps = { value: 1, key: 'a' }
        const { result, rerender } = renderHook(
            ({ value, key }) => useSnapshotPerKey(value, key),
            { initialProps }
        )
        rerender({ value: 2, key: 'a' })
        expect(result.current).toBe(1)
        rerender({ value: 3, key: 'b' })
        expect(result.current).toBe(3)
    })
})
