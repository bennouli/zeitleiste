import { entries } from '@/data/entries'
import { isSpan, type Entry } from '@/lib/entry'
import { startOf } from '@/lib/time'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { SpanBand, spanBandLayout, type SpanBandProps } from './SpanBand'

const TODAY = Date.UTC(2026, 8, 27)
const WIDTH = 1920
const LANE = 20
const spans = entries.filter(isSpan)

function linear(from: number, to: number, width = WIDTH) {
    return (t: number) => ((t - from) / (to - from)) * width
}

/** Widest zoom: 1700 to today across 1920 px. */
const wide = linear(startOf({ year: 1700 }), TODAY)

function renderBand(props: Partial<SpanBandProps> = {}) {
    const onOpen = vi.fn()
    const result = render(
        <SpanBand
            spans={spans}
            timeToX={wide}
            today={TODAY}
            laneHeightPx={LANE}
            minWidthPx={64}
            onOpen={onOpen}
            {...props}
        />
    )
    return { ...result, onOpen }
}

function barEl(container: HTMLElement, id: string): HTMLElement {
    const el = container.querySelector<HTMLElement>(`[data-span-id="${id}"]`)
    if (!el) throw new Error(`no bar for ${id}`)
    return el
}

function px(value: string): number {
    return parseFloat(value)
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

describe('SpanBand', () => {
    it('renders a bar for every span in the sample data and ignores points', () => {
        const { container } = renderBand({ spans: entries })
        const rendered = container.querySelectorAll('[data-span-id]')
        expect(rendered).toHaveLength(spans.length)
        for (const e of spans)
            expect(barEl(container, e.id)).toBeInTheDocument()
    })

    it('stretches the Cuban Missile Crisis to the 4rem minimum at the widest zoom', () => {
        const { container } = renderBand()
        const el = barEl(container, 'kubakrise')
        expect(px(el.style.width)).toBe(64)
        const { bars } = spanBandLayout(spans, wide, TODAY, {
            minWidthPx: 64,
            charWidthPx: 7,
        })
        expect(bars.get('kubakrise')?.extended).toBe(true)
    })

    it('never overlaps two bars in one lane', () => {
        const { container } = renderBand()
        const byLane = new Map<string, { l: number; r: number }[]>()
        for (const el of container.querySelectorAll<HTMLElement>(
            '[data-span-id]'
        )) {
            const l = px(el.style.left)
            const list = byLane.get(el.style.top) ?? []
            list.push({ l, r: l + px(el.style.width) })
            byLane.set(el.style.top, list)
        }
        expect(byLane.size).toBeGreaterThan(1)
        for (const list of byLane.values()) {
            list.sort((a, b) => a.l - b.l)
            for (let i = 1; i < list.length; i++)
                expect(list[i]!.l).toBeGreaterThan(list[i - 1]!.r)
        }
    })

    it('sizes the band to laneCount * laneHeightPx', () => {
        const { container } = renderBand()
        const { laneCount } = spanBandLayout(spans, wide, TODAY, {
            minWidthPx: 64,
            charWidthPx: 7,
        })
        expect((container.firstChild as HTMLElement).style.height).toBe(
            `${laneCount * LANE}px`
        )
    })

    it('ends an ongoing span at today', () => {
        // Zoomed in far enough that the ongoing war is longer than 4rem.
        const timeToX = linear(startOf({ year: 1990 }), TODAY)
        const { container } = renderBand({ timeToX })
        const el = barEl(
            container,
            'russischer-angriffskrieg-gegen-die-ukraine'
        )
        expect(px(el.style.left) + px(el.style.width)).toBeCloseTo(
            timeToX(TODAY),
            6
        )
    })

    it('opens a span with a post on click, unless it was a drag', async () => {
        const user = userEvent.setup()
        const wasDrag = vi.fn(() => false)
        const { onOpen } = renderBand({
            spans: [withPost, withoutPost],
            wasDrag,
        })
        await user.click(
            screen.getByRole('button', {
                name: /Mit Beitrag, 1900–1950, Beitrag/,
            })
        )
        expect(onOpen).toHaveBeenCalledWith('mit-beitrag')

        onOpen.mockClear()
        await user.click(
            screen.getByRole('group', { name: 'Ohne Beitrag, 1900–1950' })
        )
        expect(onOpen).not.toHaveBeenCalled()

        wasDrag.mockReturnValue(true)
        await user.click(screen.getByRole('button', { name: /Mit Beitrag/ }))
        expect(onOpen).not.toHaveBeenCalled()
    })

    it('opens with the keyboard', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderBand({ spans: [withPost] })
        await user.tab()
        await user.keyboard('{Enter}')
        expect(onOpen).toHaveBeenCalledWith('mit-beitrag')
    })

    it('shows the title on the bar only when it fits', () => {
        // 1900–1950 over 1000 px: 1000 px bar, the label fits.
        const roomy = linear(
            startOf({ year: 1900 }),
            startOf({ year: 1950 }),
            1000
        )
        const a = renderBand({ spans: [withPost], timeToX: roomy })
        expect(
            a.container.querySelector('[data-part="label"]')
        ).toHaveTextContent('Mit Beitrag')
        a.unmount()
        // Same span over 40 px: stretched to 64 px, too narrow for the label.
        const tight = linear(
            startOf({ year: 1900 }),
            startOf({ year: 1950 }),
            40
        )
        const b = renderBand({ spans: [withPost], timeToX: tight })
        expect(b.container.querySelector('[data-part="label"]')).toBeNull()
        expect(
            screen.getByRole('button', {
                name: 'Mit Beitrag, 1900–1950, Beitrag',
            })
        ).not.toHaveAttribute('title')
    })

    it('shows the summary in a tooltip on keyboard focus and on hover', async () => {
        const user = userEvent.setup()
        renderBand({ spans: [withoutPost] })
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

    it('highlights the given span', () => {
        const { container } = renderBand({ highlightedId: 'sowjetunion' })
        expect(barEl(container, 'sowjetunion').className).toContain('ring-2')
        expect(barEl(container, 'kalter-krieg').className).not.toContain(
            'ring-2'
        )
    })

    it('has no axe violations', async () => {
        {
            const { container, unmount } = renderBand()
            expect(
                await axe(container, {
                    rules: { 'color-contrast': { enabled: false } },
                })
            ).toHaveNoViolations()
            unmount()
        }
    })

    it('opens with the keyboard even if the last pointer gesture was a drag', async () => {
        const user = userEvent.setup()
        const { onOpen } = renderBand({
            spans: [withPost, withoutPost],
            wasDrag: () => true,
        })
        await user.tab()
        expect(screen.getByRole('button')).toHaveFocus()
        await user.keyboard('{Enter}')
        expect(onOpen).toHaveBeenCalledWith('mit-beitrag')
        onOpen.mockClear()
        await user.tab()
        expect(screen.getByRole('group')).toHaveFocus()
        await user.keyboard('{Enter}')
        expect(onOpen).not.toHaveBeenCalled()
    })

    it('orders bars chronologically by true start', () => {
        const { container } = renderBand({ spans: [...spans].reverse() })
        const { bars } = spanBandLayout(spans, wide, TODAY, {
            minWidthPx: 64,
            charWidthPx: 7,
        })
        const starts = [
            ...container.querySelectorAll<HTMLElement>('[data-span-id]'),
        ].map((el) => bars.get(el.dataset.spanId!)!.trueX0)
        expect(starts).toEqual([...starts].sort((a, b) => a - b))
    })

    it('draws a left-extended uniform bar solid from x0, and honours an explicit maxX', () => {
        const id = 'russischer-angriffskrieg-gegen-die-ukraine'
        const { container } = renderBand()
        const { bars } = spanBandLayout(spans, wide, TODAY, {
            minWidthPx: 64,
            charWidthPx: 7,
        })
        const el = barEl(container, id)
        expect(px(el.style.left)).toBeCloseTo(bars.get(id)!.x0, 6)
        expect(el.querySelector('[data-part]')).toBeNull()
        const limited = spanBandLayout(spans, wide, TODAY, {
            minWidthPx: 64,
            charWidthPx: 7,
            maxX: Infinity,
        })
        expect(limited.bars.get(id)!.x0).toBe(bars.get(id)!.trueX0)
    })

    it('renders an empty band for no spans and skips non-finite positions', () => {
        const { container } = renderBand({
            spans: entries.filter((e) => !isSpan(e)),
        })
        expect(container.querySelectorAll('[data-span-id]')).toHaveLength(0)
        expect((container.firstChild as HTMLElement).style.height).toBe('0px')
        const layout = spanBandLayout([withPost], () => NaN, TODAY, {
            minWidthPx: 64,
            charWidthPx: 7,
        })
        expect(layout.laneCount).toBe(0)
    })
})
