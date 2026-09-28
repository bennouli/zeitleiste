import { MS_PER_YEAR } from '@/lib/time'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Axis, AXIS_LINE_THICKNESS_PX } from '../Axis'
import { TimelineContext, type TimelineContextValue } from '../TimelineContext'

const WIDTH = 1000
const TODAY = Date.UTC(2026, 8, 27)

/** Renders the axis with `today` at `todayX` and a year `yearWidthPx` wide. */
function renderAxis(todayX: number, yearWidthPx: number) {
    const span = (WIDTH / yearWidthPx) * MS_PER_YEAR
    const start = TODAY - (todayX / WIDTH) * span
    const viewport = { start, end: start + span }
    const timeToX = (t: number) => ((t - start) / span) * WIDTH
    const ctx: TimelineContextValue = {
        viewport,
        width: WIDTH,
        bounds: { min: start, max: TODAY },
        today: TODAY,
        msPerPx: span / WIDTH,
        timeToX,
        isGesturing: false,
        collapsed: false,
        gestureEnd: 0,
        wasDrag: () => false,
    }
    return render(
        <TimelineContext value={ctx}>
            <Axis />
        </TimelineContext>
    )
}

function tickAt(container: HTMLElement, t: number): Element | null {
    return container.querySelector(`[data-t="${t}"]`)
}

function tickLabel(tick: Element): HTMLElement | null {
    return tick.querySelector('span')
}

describe('Axis', () => {
    it.each([
        ['inside the view', 600],
        ['left of the view', -50],
        ['right of the view', 1400],
    ])('draws the line across the full width (today %s)', (_, todayX) => {
        const { container } = renderAxis(todayX, 10)
        const line = container.querySelector<HTMLElement>('[data-axis-line]')!
        expect(line.style.width).toBe(`${WIDTH}px`)
        expect(line).toHaveClass('left-0', 'bg-fg')
        expect(line.style.height).toBe(`${AXIS_LINE_THICKNESS_PX}px`)
    })

    it('sets major and minor labels apart by weight and colour, at one size', () => {
        const { container } = renderAxis(900, 10)
        const major = container.querySelector('[data-tick="major"]')!
        const minor = container.querySelector('[data-tick="minor"]')!
        expect(tickLabel(major)).toHaveClass('font-medium', 'text-fg')
        expect(tickLabel(minor)).toHaveClass('font-normal', 'text-fg-muted')
        for (const tick of [major, minor])
            expect(tickLabel(tick)).toHaveClass(
                'small-caps',
                'text-label',
                'tracking-label'
            )
        const weightOrColour = /^(font-(medium|normal)|text-fg(-muted)?)$/
        const shapeClasses = (el: HTMLElement | null) =>
            [...(el?.classList ?? [])].filter((c) => !weightOrColour.test(c))
        expect(shapeClasses(tickLabel(major))).toEqual(
            shapeClasses(tickLabel(minor))
        )
    })

    it('hangs 8 px ticks for labelled steps and 4 px ticks for minor ones', () => {
        const { container } = renderAxis(900, 10)
        const markOf = (kind: string) =>
            container.querySelector(`[data-tick="${kind}"] > div`)
        expect(markOf('major')).toHaveClass('h-2', 'w-px')
        expect(markOf('minor')).toHaveClass('h-1', 'w-px')
    })

    it('shows month names only once a year spans more than 420 px', () => {
        const { container, unmount } = renderAxis(900, 400)
        const unitOf = () =>
            container
                .querySelector('[data-tick-unit]')!
                .getAttribute('data-tick-unit')
        expect(unitOf()).toBe('year')
        unmount()
        const wide = renderAxis(900, 440)
        expect(
            wide.container
                .querySelector('[data-tick-unit]')!
                .getAttribute('data-tick-unit')
        ).not.toBe('year')
    })

    it('sets "Heute" in small caps under a 16 px mark', () => {
        const { container } = renderAxis(500, 10)
        expect(screen.getByText('Heute')).toHaveClass(
            'small-caps',
            'text-label',
            'font-medium'
        )
        const mark = container.querySelector<HTMLElement>('[data-today] > div')!
        expect(mark.style.height).toBe('16px')
    })

    it.each([
        ['at the right edge', 995, 'right', '-translate-x-full'],
        ['in the middle', 500, 'center', '-translate-x-1/2'],
        ['at the left edge', 5, 'left', 'pl-1.5'],
    ])('keeps "Heute" inside the timeline (%s)', (_, todayX, align, shift) => {
        renderAxis(todayX, 10)
        const label = screen.getByText('Heute')
        expect(label).toHaveAttribute('data-today-align', align)
        expect(label).toHaveClass(shift)
    })

    it('draws a year tick after today like one before it', () => {
        const { container } = renderAxis(500, 200)
        const tickBeforeToday = tickAt(container, Date.UTC(2026, 0, 1))!
        const tickAfterToday = tickAt(container, Date.UTC(2028, 0, 1))!
        expect(tickAfterToday).not.toBeNull()
        expect(tickAfterToday.getAttribute('data-tick')).toBe(
            tickBeforeToday.getAttribute('data-tick')
        )
        expect(tickAfterToday.firstElementChild!.className).toBe(
            tickBeforeToday.firstElementChild!.className
        )
        expect(tickLabel(tickAfterToday)).toHaveTextContent('2028')
        expect(tickLabel(tickAfterToday)!.className).toBe(
            tickLabel(tickBeforeToday)!.className
        )
    })

    it.each([
        ['before', 50, Date.UTC(2026, 0, 1), Date.UTC(2028, 0, 1)],
        ['after', 500, Date.UTC(2026, 9, 1), Date.UTC(2026, 6, 1)],
    ])(
        'drops a tick label just %s "Heute" and keeps the tick',
        (_, yearWidthPx, hiddenT, shownT) => {
            const { container } = renderAxis(500, yearWidthPx)
            const hiddenTick = tickAt(container, hiddenT)!
            expect(hiddenTick).not.toBeNull()
            expect(tickLabel(hiddenTick)).toBeNull()
            expect(tickLabel(tickAt(container, shownT)!)).not.toBeNull()
        }
    )

    it('drops a tick label that would run into "Heute" and keeps the tick', () => {
        const { container } = renderAxis(900, 50)
        const tick2026 = tickAt(container, Date.UTC(2026, 0, 1))!
        expect(tick2026).not.toBeNull()
        expect(tickLabel(tick2026)).toBeNull()
        const tick2024 = tickAt(container, Date.UTC(2024, 0, 1))!
        expect(tickLabel(tick2024)).toHaveTextContent('2024')
    })
})
