import { entries } from '@/data/entries'
import { isSpan, type Entry } from '@/lib/entry'
import type { SpanBar } from '@/lib/spans'
import { startOf } from '@/lib/time'
import { expectNoAxeViolations } from '@/test/axe'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AXIS_LINE_Y_PX } from '../Axis'
import {
    PRIVATE_UNDER_TESTS,
    SpanLayer,
    spanLayout,
    type SpanLayerProps,
} from '../SpanLayer'

const TODAY = Date.UTC(2026, 8, 27)
const WIDTH = 1920
const spans = entries.filter(isSpan)

function linear(from: number, to: number, width = WIDTH) {
    return (t: number) => ((t - from) / (to - from)) * width
}

/** Widest zoom: 1700 to today across 1920 px. */
const wide = linear(startOf({ year: 1700 }), TODAY)

function renderLayer(props: Partial<SpanLayerProps> = {}) {
    return render(
        <SpanLayer spans={spans} timeToX={wide} today={TODAY} {...props} />
    )
}

function barEl(container: HTMLElement, id: string): HTMLElement {
    const el = container.querySelector<HTMLElement>(`[data-span-id="${id}"]`)
    if (!el) throw new Error(`no bar for ${id}`)
    return el
}

function allBars(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('[data-span-id]')]
}

function px(value: string): number {
    return parseFloat(value)
}

type Box = { left: number; right: number; top: number; bottom: number }

function boxOf(el: HTMLElement): Box {
    const left = px(el.style.left)
    const top = px(el.style.top)
    return {
        left,
        right: left + px(el.style.width),
        top,
        bottom: top + px(el.style.height),
    }
}

const withPost: Entry = {
    id: 'mit-beitrag',
    title: 'Mit Beitrag',
    summary: '',
    start: { year: 1900 },
    end: { year: 1950 },
    region: 'russia',
    category: 'war',
    importance: 2,
    post: { body: 'Text' },
}
const withoutPost: Entry = {
    ...withPost,
    id: 'ohne-beitrag',
    title: 'Ohne Beitrag',
    summary: 'Eine kurze Zusammenfassung.',
    post: undefined,
    region: 'west',
}
/** Three spans over the same years: three lanes. */
const stacked: Entry[] = [
    withPost,
    { ...withoutPost, id: 'zweite', importance: 1 },
    { ...withoutPost, id: 'dritte', importance: 1, start: { year: 1910 } },
]

describe('SpanLayer', () => {
    it('renders a bar for every span in the sample data and ignores points', () => {
        const { container } = renderLayer({ spans: entries })
        expect(allBars(container)).toHaveLength(spans.length)
        for (const e of spans)
            expect(barEl(container, e.id)).toBeInTheDocument()
    })

    it('hangs from the axis line and takes no height of its own', () => {
        const { container } = renderLayer()
        const layer = container.firstChild as HTMLElement
        expect(layer).toHaveAttribute('data-layer', 'spans')
        expect(layer).toHaveClass('h-0')
        expect(px(layer.style.top)).toBe(AXIS_LINE_Y_PX)
    })

    it('centres lane 0 on the axis line and stacks further lanes thinner below it', () => {
        const { container } = renderLayer({ spans: stacked })
        const boxes = ['mit-beitrag', 'zweite', 'dritte'].map((id) =>
            boxOf(barEl(container, id))
        )
        expect(boxes.map((b) => [b.top, b.bottom - b.top])).toEqual([
            [-3, 7],
            [8, 3],
            [14, 3],
        ])
    })

    it('keeps overlapping spans in separate lanes without touching', () => {
        const { container } = renderLayer()
        const boxes = allBars(container).map(boxOf)
        const overlapInX = (a: Box, b: Box) =>
            a.left < b.right && b.left < a.right
        const overlapInY = (a: Box, b: Box) =>
            a.top < b.bottom && b.top < a.bottom
        const touching = boxes.flatMap((a, i) =>
            boxes
                .slice(i + 1)
                .filter(
                    (b) =>
                        overlapInX(a, b) &&
                        (overlapInY(a, b) ||
                            a.bottom === b.top ||
                            b.bottom === a.top)
                )
        )
        expect(new Set(boxes.map((b) => b.top)).size).toBeGreaterThan(1)
        expect(touching).toEqual([])
    })

    it('stretches the Cuban Missile Crisis to the 2 px minimum at the widest zoom', () => {
        const { container } = renderLayer()
        expect(px(barEl(container, 'kubakrise').style.width)).toBe(2)
    })

    it('ends an ongoing span at today', () => {
        const timeToX = linear(startOf({ year: 1990 }), TODAY)
        const { container } = renderLayer({ timeToX })
        const box = boxOf(
            barEl(container, 'russischer-angriffskrieg-gegen-die-ukraine')
        )
        expect(box.right).toBeCloseTo(timeToX(TODAY), 6)
    })

    it('fades an ongoing span over its last 40 %, and draws a finished one solid', () => {
        const ongoing: Entry = { ...withoutPost, id: 'laufend', end: 'ongoing' }
        const endsThisYear: Entry = {
            ...withoutPost,
            id: 'dieses-jahr',
            end: { year: 2026 },
        }
        const ended: Entry = {
            ...withoutPost,
            id: 'vorbei',
            end: { year: 2025 },
        }
        const { container } = renderLayer({
            spans: [ongoing, endsThisYear, ended],
        })
        const fading = ['bg-linear-to-r', 'from-fg/12', 'from-60%', 'to-fg/2']
        expect(barEl(container, 'laufend')).toHaveClass(...fading)
        expect(barEl(container, 'dieses-jahr')).toHaveClass(...fading)
        expect(barEl(container, 'vorbei')).toHaveClass('bg-fg/12')
        expect(barEl(container, 'vorbei')).not.toHaveClass('bg-linear-to-r')
    })

    it('draws no label on the bar', () => {
        const roomy = linear(
            startOf({ year: 1900 }),
            startOf({ year: 1950 }),
            1000
        )
        const { container } = renderLayer({ spans: [withPost], timeToX: roomy })
        expect(barEl(container, 'mit-beitrag')).toBeEmptyDOMElement()
    })

    it('renders a span with a post as a focusable group, never as a button that opens it', () => {
        renderLayer({ spans: [withPost] })
        expect(screen.queryByRole('button')).toBeNull()
        expect(
            screen.getByRole('group', {
                name: 'Mit Beitrag, 1900–1950, Beitrag',
            })
        ).toHaveAttribute('tabindex', '0')
    })

    it('shows the hover note on keyboard focus and on hover', async () => {
        const user = userEvent.setup()
        renderLayer({ spans: [withoutPost] })
        const bar = screen.getByRole('group', { name: /Ohne Beitrag/ })
        expect(screen.queryByRole('tooltip')).toBeNull()
        await user.tab()
        expect(bar).toHaveFocus()
        const tip = screen.getByRole('tooltip')
        expect(tip).toHaveTextContent(withoutPost.summary)
        expect(bar).toHaveAttribute('aria-describedby', tip.id)
        await user.keyboard('{Escape}')
        expect(screen.queryByRole('tooltip')).toBeNull()
        await user.tab({ shift: true })
        await user.hover(bar)
        expect(screen.getByRole('tooltip')).toHaveTextContent(
            withoutPost.summary
        )
        await user.unhover(bar)
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('shows no hover note on a focus that follows a pointer press', () => {
        renderLayer({ spans: [withoutPost] })
        const bar = screen.getByRole('group', { name: /Ohne Beitrag/ })
        act(() => bar.focus())
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        act(() => bar.blur())
        fireEvent.pointerDown(bar, { pointerType: 'mouse' })
        act(() => bar.focus())
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('keeps a hover note when a touch pointer leaves, and closes it when the mouse leaves', async () => {
        const user = userEvent.setup()
        renderLayer({ spans: [withoutPost] })
        const bar = screen.getByRole('group', { name: /Ohne Beitrag/ })
        await user.hover(bar)
        fireEvent.pointerOut(bar, { pointerType: 'touch' })
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        fireEvent.pointerOut(bar, { pointerType: 'mouse' })
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('has no axe violations', async () => {
        const { container } = renderLayer()
        await expectNoAxeViolations(container)
    })

    it('orders bars chronologically by true start', () => {
        const reversed = [...spans].reverse()
        const { container } = renderLayer({ spans: reversed })
        const bars = spanLayout(spans, wide, TODAY)
        const starts = allBars(container).map(
            (el) => bars.get(el.dataset.spanId!)!.trueX0
        )
        expect(starts).toEqual([...starts].sort((a, b) => a - b))
    })

    it('skips spans at non-finite positions', () => {
        const nowhere = () => NaN
        expect(spanLayout([withPost], nowhere, TODAY).size).toBe(0)
    })
})

describe('withFrozenLanes', () => {
    const { withFrozenLanes } = PRIVATE_UNDER_TESTS

    function barIn(id: string, lane: number): SpanBar {
        return {
            id,
            x0: 0,
            x1: 100,
            trueX0: 0,
            trueX1: 100,
            extended: false,
            lane,
            labelFits: false,
        }
    }

    it('moves bars to their frozen lanes', () => {
        const liveBars = new Map([
            ['a', barIn('a', 0)],
            ['b', barIn('b', 1)],
        ])
        const lanes = new Map([
            ['a', 2],
            ['b', 0],
        ])
        const frozen = withFrozenLanes(liveBars, lanes)
        expect(frozen.get('a')!.lane).toBe(2)
        expect(frozen.get('b')!.lane).toBe(0)
    })

    it('keeps the live lane of a bar without a frozen one', () => {
        const liveBars = new Map([['a', barIn('a', 1)]])
        const lanes = new Map([['b', 0]])
        expect(withFrozenLanes(liveBars, lanes).get('a')!.lane).toBe(1)
    })

    it('leaves the live bars untouched', () => {
        const liveBar = barIn('a', 0)
        const liveBars = new Map([['a', liveBar]])
        const lanes = new Map([['a', 3]])
        withFrozenLanes(liveBars, lanes)
        expect(liveBars.get('a')).toBe(liveBar)
        expect(liveBar.lane).toBe(0)
    })
})
