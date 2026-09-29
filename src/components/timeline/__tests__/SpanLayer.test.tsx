import { entries } from '@/data/entries'
import { isSpan, type Entry } from '@/lib/entry'
import { paragraphsToLexical } from '@/lib/richText'
import { startOf } from '@/lib/time'
import { expectNoAxeViolations } from '@/test/axe'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AXIS_LINE_Y_PX } from '../Axis'
import { spanLayout } from '../spanGeometry'
import { SpanLayer, type SpanLayerProps } from '../SpanLayer'

const TODAY = Date.UTC(2026, 8, 27)
const WIDTH = 1920
const spans = entries.filter(isSpan)
const NO_FROZEN_LANES: ReadonlyMap<string, number> = new Map()

function linear(from: number, to: number, width = WIDTH) {
    return (t: number) => ((t - from) / (to - from)) * width
}

/** Widest zoom: 1700 to today across 1920 px. */
const wide = linear(startOf({ year: 1700 }), TODAY)

function renderLayer(props: Partial<SpanLayerProps> = {}) {
    return render(
        <SpanLayer
            spans={spans}
            timeToX={wide}
            today={TODAY}
            lanes={NO_FROZEN_LANES}
            {...props}
        />
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
    type: 'war',
    tags: [],
    post: { body: paragraphsToLexical('Text') },
}
const withoutPost: Entry = {
    ...withPost,
    id: 'ohne-beitrag',
    title: 'Ohne Beitrag',
    summary: 'Eine kurze Zusammenfassung.',
    post: undefined,
}

describe('SpanLayer', () => {
    it('renders a bar for every span in the sample data and ignores points', () => {
        const { container } = renderLayer({ spans: entries })
        expect(allBars(container)).toHaveLength(spans.length)
    })

    it('hangs from the axis line and takes no height of its own', () => {
        const { container } = renderLayer()
        const layer = container.firstChild as HTMLElement
        expect(layer).toHaveAttribute('data-layer', 'spans')
        expect(layer).toHaveClass('h-0')
        expect(px(layer.style.top)).toBe(AXIS_LINE_Y_PX)
    })

    it('draws each bar in its lane box: lane 0 on the axis line, further lanes thinner below it', () => {
        const stacked: Entry[] = [
            withPost,
            { ...withoutPost, id: 'zweite' },
            {
                ...withoutPost,
                id: 'dritte',
                start: { year: 1910 },
            },
        ]
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

    it('draws a bar in its frozen lane', () => {
        const frozen = new Map([['kalter-krieg', 4]])
        const { container } = renderLayer({ lanes: frozen })
        expect(px(barEl(container, 'kalter-krieg').style.top)).toBe(26)
    })

    it('keeps overlapping spans in separate lanes without touching', () => {
        const { container } = renderLayer()
        const boxes = allBars(container).map(boxOf)
        const overlapInX = (a: Box, b: Box) =>
            a.left < b.right && b.left < a.right
        const apartInY = (a: Box, b: Box) =>
            a.bottom < b.top || b.bottom < a.top
        const touching = boxes.flatMap((a, i) =>
            boxes
                .slice(i + 1)
                .filter((b) => overlapInX(a, b) && !apartInY(a, b))
        )
        expect(new Set(boxes.map((b) => b.top)).size).toBeGreaterThan(1)
        expect(touching).toEqual([])
    })

    it('fades an ongoing span over its last 40 %, and draws a finished one solid', () => {
        const ongoing: Entry = { ...withoutPost, id: 'laufend', end: 'ongoing' }
        const ended: Entry = { ...withoutPost, id: 'vorbei' }
        const mixed = [ongoing, ended]
        const { container } = renderLayer({ spans: mixed })
        expect(barEl(container, 'laufend')).toHaveClass(
            'bg-linear-to-r',
            'from-fg/35',
            'from-60%',
            'to-fg/10'
        )
        expect(barEl(container, 'vorbei')).toHaveClass('bg-fg/35')
        expect(barEl(container, 'vorbei')).not.toHaveClass('bg-linear-to-r')
    })

    it('draws no label on the bar', () => {
        const roomy = linear(
            startOf({ year: 1900 }),
            startOf({ year: 1950 }),
            1000
        )
        const single = [withPost]
        const { container } = renderLayer({ spans: single, timeToX: roomy })
        expect(barEl(container, 'mit-beitrag')).toBeEmptyDOMElement()
    })

    it('renders a span with a post as a focusable group, never as a button that opens it', () => {
        const single = [withPost]
        renderLayer({ spans: single })
        expect(screen.queryByRole('button')).toBeNull()
        expect(
            screen.getByRole('group', {
                name: 'Mit Beitrag, 1900–1950, Beitrag',
            })
        ).toHaveAttribute('tabindex', '0')
    })

    it('shows the hover note on keyboard focus and on hover', async () => {
        const user = userEvent.setup()
        const single = [withoutPost]
        renderLayer({ spans: single })
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
        const single = [withoutPost]
        renderLayer({ spans: single })
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
        const single = [withoutPost]
        renderLayer({ spans: single })
        const bar = screen.getByRole('group', { name: /Ohne Beitrag/ })
        await user.hover(bar)
        fireEvent.pointerOut(bar, { pointerType: 'touch' })
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        fireEvent.pointerOut(bar, { pointerType: 'mouse' })
        expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('hands a click on a bar to onBarClick with its id', async () => {
        const user = userEvent.setup()
        const onBarClick = vi.fn()
        const single = [withoutPost]
        const { container } = renderLayer({ spans: single, onBarClick })

        await user.click(barEl(container, withoutPost.id))

        expect(onBarClick).toHaveBeenCalledExactlyOnceWith(withoutPost.id)
    })

    it.each(['{Enter}', ' '])(
        'hands %s on a focused bar to onBarClick',
        async (key) => {
            const user = userEvent.setup()
            const onBarClick = vi.fn()
            const single = [withoutPost]
            const { container } = renderLayer({ spans: single, onBarClick })
            barEl(container, withoutPost.id).focus()

            await user.keyboard(key)

            expect(onBarClick).toHaveBeenCalledExactlyOnceWith(withoutPost.id)
        }
    )

    it('leaves other keys on a focused bar alone', async () => {
        const user = userEvent.setup()
        const onBarClick = vi.fn()
        const single = [withoutPost]
        const { container } = renderLayer({ spans: single, onBarClick })
        barEl(container, withoutPost.id).focus()

        await user.keyboard('{ArrowLeft}')

        expect(onBarClick).not.toHaveBeenCalled()
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
})
