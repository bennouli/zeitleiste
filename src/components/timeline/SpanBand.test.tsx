import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { entries } from '@/data/entries'
import { isSpan, type Entry } from '@/lib/entry'
import { startOf } from '@/lib/time'
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
      shortSpanStyle="uniform"
      onOpen={onOpen}
      {...props}
    />,
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
const withoutPost: Entry = { ...withPost, id: 'ohne-beitrag', title: 'Ohne Beitrag', post: undefined, region: 'west' }

describe('SpanBand', () => {
  it('renders a bar for every span in the sample data and ignores points', () => {
    const { container } = renderBand({ spans: entries })
    const rendered = container.querySelectorAll('[data-span-id]')
    expect(rendered).toHaveLength(spans.length)
    for (const e of spans) expect(barEl(container, e.id)).toBeInTheDocument()
  })

  it('stretches the Cuban Missile Crisis to the 4rem minimum at the widest zoom', () => {
    const { container } = renderBand()
    const el = barEl(container, 'kubakrise')
    expect(px(el.style.width)).toBe(64)
    const { bars } = spanBandLayout(spans, wide, TODAY, { minWidthPx: 64, charWidthPx: 7 })
    expect(bars.get('kubakrise')?.extended).toBe(true)
  })

  it('never overlaps two bars in one lane', () => {
    const { container } = renderBand()
    const byLane = new Map<string, { l: number; r: number }[]>()
    for (const el of container.querySelectorAll<HTMLElement>('[data-span-id]')) {
      const l = px(el.style.left)
      const list = byLane.get(el.style.top) ?? []
      list.push({ l, r: l + px(el.style.width) })
      byLane.set(el.style.top, list)
    }
    expect(byLane.size).toBeGreaterThan(1)
    for (const list of byLane.values()) {
      list.sort((a, b) => a.l - b.l)
      for (let i = 1; i < list.length; i++) expect(list[i]!.l).toBeGreaterThan(list[i - 1]!.r)
    }
  })

  it('sizes the band to laneCount * laneHeightPx', () => {
    const { container } = renderBand()
    const { laneCount } = spanBandLayout(spans, wide, TODAY, { minWidthPx: 64, charWidthPx: 7 })
    expect((container.firstChild as HTMLElement).style.height).toBe(`${laneCount * LANE}px`)
  })

  it('ends an ongoing span at today', () => {
    // Zoomed in far enough that the ongoing war is longer than 4rem.
    const timeToX = linear(startOf({ year: 1990 }), TODAY)
    const { container } = renderBand({ timeToX })
    const el = barEl(container, 'russischer-angriffskrieg-gegen-die-ukraine')
    expect(px(el.style.left) + px(el.style.width)).toBeCloseTo(timeToX(TODAY), 6)
  })

  it('stretches a short ongoing span to the left so it still ends at today', () => {
    const id = 'russischer-angriffskrieg-gegen-die-ukraine'
    const { bars } = spanBandLayout(spans, wide, TODAY, { minWidthPx: 64, charWidthPx: 7 })
    const bar = bars.get(id)!
    expect(bar.extended).toBe(true)
    expect(bar.x1).toBe(wide(TODAY))
    expect(bar.trueX1).toBe(wide(TODAY))
    expect(bar.x1 - bar.x0).toBeCloseTo(64, 9)
    expect(bar.trueX0).toBe(wide(startOf(spans.find((e) => e.id === id)!.start)))
    expect(bar.x0).toBeLessThan(bar.trueX0)
    for (const b of bars.values()) expect(b.x1).toBeLessThanOrEqual(wide(TODAY))

    const { container } = renderBand({ shortSpanStyle: 'faded' })
    const el = barEl(container, id)
    expect(px(el.style.left) + px(el.style.width)).toBeCloseTo(wide(TODAY), 6)
    expect(px(el.style.width)).toBeCloseTo(64, 6)
    // Solid over the true extent, fading in from the left; nothing fades out past today.
    const start = el.querySelector<HTMLElement>('[data-part="fade"][data-side="start"]')!
    const solid = el.querySelector<HTMLElement>('[data-part="solid"]')!
    expect(start.className).toContain('bg-linear-to-l')
    expect(start.className).toContain('to-transparent')
    expect(px(start.style.width)).toBeCloseTo(bar.trueX0 - bar.x0, 6)
    expect(px(solid.style.left)).toBeCloseTo(bar.trueX0 - bar.x0, 6)
    expect(px(solid.style.left) + px(solid.style.width)).toBeCloseTo(64, 6)
    expect(el.querySelector('[data-side="end"]')).toBeNull()
  })

  it('fades over both extensions when a bar is stretched to both sides', () => {
    // Ten days ending one week before today: too close to today to extend only to the right.
    const recent: Entry = {
      ...withPost,
      id: 'kurz-vor-heute',
      start: { year: 2026, month: 9, day: 10 },
      end: { year: 2026, month: 9, day: 20 },
    }
    const { container } = renderBand({ spans: [recent], shortSpanStyle: 'faded' })
    const { bars } = spanBandLayout([recent], wide, TODAY, { minWidthPx: 64, charWidthPx: 7 })
    const bar = bars.get('kurz-vor-heute')!
    expect(bar.x0).toBeLessThan(bar.trueX0)
    expect(bar.x1).toBeGreaterThan(bar.trueX1)
    expect(bar.x1).toBe(wide(TODAY))
    const el = barEl(container, 'kurz-vor-heute')
    const start = el.querySelector<HTMLElement>('[data-side="start"]')!
    const solid = el.querySelector<HTMLElement>('[data-part="solid"]')!
    const end = el.querySelector<HTMLElement>('[data-side="end"]')!
    expect(end.className).toContain('bg-linear-to-r')
    expect(px(start.style.width) + px(solid.style.width) + px(end.style.width)).toBeCloseTo(64, 6)
    expect(px(end.style.left)).toBeCloseTo(bar.trueX1 - bar.x0, 6)
  })

  it("draws extended bars with a gradient in 'faded' only", () => {
    const uniform = renderBand({ shortSpanStyle: 'uniform' })
    expect(barEl(uniform.container, 'kubakrise').querySelector('[data-part="fade"]')).toBeNull()
    expect(uniform.container.querySelector('[data-part="fade"]')).toBeNull()
    uniform.unmount()

    const faded = renderBand({ shortSpanStyle: 'faded' })
    const el = barEl(faded.container, 'kubakrise')
    const fade = el.querySelector<HTMLElement>('[data-part="fade"]')
    expect(fade).not.toBeNull()
    expect(fade!.className).toContain('bg-linear-to-r')
    expect(fade!.dataset.side).toBe('end')
    expect(el.querySelector('[data-side="start"]')).toBeNull()
    const solid = el.querySelector<HTMLElement>('[data-part="solid"]')!
    expect(px(solid.style.width) + px(fade!.style.width)).toBeCloseTo(64)
    // Long bars stay solid.
    expect(barEl(faded.container, 'sowjetunion').querySelector('[data-part="fade"]')).toBeNull()
  })

  it('opens a span with a post on click, unless it was a drag', async () => {
    const user = userEvent.setup()
    const wasDrag = vi.fn(() => false)
    const { onOpen } = renderBand({ spans: [withPost, withoutPost], wasDrag })
    await user.click(screen.getByRole('button', { name: /Mit Beitrag, 1900–1950, Beitrag/ }))
    expect(onOpen).toHaveBeenCalledWith('mit-beitrag')

    onOpen.mockClear()
    await user.click(screen.getByRole('group', { name: 'Ohne Beitrag, 1900–1950' }))
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
    const roomy = linear(startOf({ year: 1900 }), startOf({ year: 1950 }), 1000)
    const a = renderBand({ spans: [withPost], timeToX: roomy })
    expect(a.container.querySelector('[data-part="label"]')).toHaveTextContent('Mit Beitrag')
    a.unmount()
    // Same span over 40 px: stretched to 64 px, too narrow for the label.
    const tight = linear(startOf({ year: 1900 }), startOf({ year: 1950 }), 40)
    const b = renderBand({ spans: [withPost], timeToX: tight })
    expect(b.container.querySelector('[data-part="label"]')).toBeNull()
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Mit Beitrag, 1900–1950, Beitrag')
  })

  it('highlights the given span', () => {
    const { container } = renderBand({ highlightedId: 'sowjetunion' })
    expect(barEl(container, 'sowjetunion').className).toContain('ring-2')
    expect(barEl(container, 'kalter-krieg').className).not.toContain('ring-2')
  })

  it('has no axe violations in either style', async () => {
    for (const shortSpanStyle of ['uniform', 'faded'] as const) {
      const { container, unmount } = renderBand({ shortSpanStyle })
      expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations()
      unmount()
    }
  })

  it('hides the label on a stretched faded bar even when it would fit', () => {
    const short: Entry = { ...withPost, id: 'kurz', title: 'Kurz', start: { year: 1900 }, end: { year: 1901 } }
    const timeToX = linear(startOf({ year: 1900 }), startOf({ year: 2000 }), 1000)
    const { bars } = spanBandLayout([short], timeToX, TODAY, { minWidthPx: 64, charWidthPx: 7 })
    expect(bars.get('kurz')).toMatchObject({ extended: true, labelFits: true })
    const faded = renderBand({ spans: [short], timeToX, shortSpanStyle: 'faded' })
    expect(faded.container.querySelector('[data-part="label"]')).toBeNull()
    expect(faded.container.querySelector('[data-part="fade"]')!.className).toContain('from-russia')
    faded.unmount()
    const uniform = renderBand({ spans: [short], timeToX, shortSpanStyle: 'uniform' })
    expect(uniform.container.querySelector('[data-part="label"]')).toHaveTextContent('Kurz')
    expect(barEl(uniform.container, 'kurz').className).toContain('bg-russia')
  })

  it('opens with the keyboard even if the last pointer gesture was a drag', async () => {
    const user = userEvent.setup()
    const { onOpen } = renderBand({ spans: [withPost, withoutPost], wasDrag: () => true })
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
    const { bars } = spanBandLayout(spans, wide, TODAY, { minWidthPx: 64, charWidthPx: 7 })
    const starts = [...container.querySelectorAll<HTMLElement>('[data-span-id]')].map(
      (el) => bars.get(el.dataset.spanId!)!.trueX0,
    )
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
  })

  it('draws a left-extended uniform bar solid from x0, and honours an explicit maxX', () => {
    const id = 'russischer-angriffskrieg-gegen-die-ukraine'
    const { container } = renderBand({ shortSpanStyle: 'uniform' })
    const { bars } = spanBandLayout(spans, wide, TODAY, { minWidthPx: 64, charWidthPx: 7 })
    const el = barEl(container, id)
    expect(px(el.style.left)).toBeCloseTo(bars.get(id)!.x0, 6)
    expect(el.querySelector('[data-part]')).toBeNull()
    const limited = spanBandLayout(spans, wide, TODAY, { minWidthPx: 64, charWidthPx: 7, maxX: Infinity })
    expect(limited.bars.get(id)!.x0).toBe(bars.get(id)!.trueX0)
  })

  it('draws a zero-length faded span at today as a single fade', () => {
    const now: Entry = { ...withPost, id: 'jetzt', start: { year: 2026, month: 9, day: 27 }, end: 'ongoing' }
    const timeToX = (t: number) => Math.min(wide(t), wide(TODAY))
    const { container } = renderBand({ spans: [now], timeToX, shortSpanStyle: 'faded' })
    const el = barEl(container, 'jetzt')
    expect(px(el.style.left) + px(el.style.width)).toBeCloseTo(wide(TODAY), 6)
    expect(px(el.querySelector<HTMLElement>('[data-part="solid"]')!.style.width)).toBe(0)
    expect(px(el.querySelector<HTMLElement>('[data-side="start"]')!.style.width)).toBeCloseTo(64, 6)
    expect(el.querySelector('[data-side="end"]')).toBeNull()
  })

  it('renders an empty band for no spans and skips non-finite positions', () => {
    const { container } = renderBand({ spans: entries.filter((e) => !isSpan(e)) })
    expect(container.querySelectorAll('[data-span-id]')).toHaveLength(0)
    expect((container.firstChild as HTMLElement).style.height).toBe('0px')
    const layout = spanBandLayout([withPost], () => NaN, TODAY, { minWidthPx: 64, charWidthPx: 7 })
    expect(layout.laneCount).toBe(0)
  })
})
