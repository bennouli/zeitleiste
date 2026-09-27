import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { entries } from '@/data/entries'
import { isSpan } from '@/lib/entry'
import { startOf } from '@/lib/time'
import { BRACKET_LANE_PX, LongSpans, bracketLayout, type LongSpanVariant } from './LongSpans'

const TODAY = Date.UTC(2026, 8, 27)
const from = startOf({ year: 1700 })
const timeToX = (t: number) => ((t - from) / (TODAY - from)) * 1920
const long = entries.filter((e) => isSpan(e) && e.importance === 3)

function renderVariant(variant: LongSpanVariant) {
  return render(
    <LongSpans spans={entries} timeToX={timeToX} today={TODAY} variant={variant} heightPx={480} />,
  )
}

describe('LongSpans', () => {
  it("renders nothing for 'bar'", () => {
    expect(renderVariant('bar').container).toBeEmptyDOMElement()
  })

  it("'background' tints the full height behind each importance-3 span", () => {
    expect(long.length).toBeGreaterThan(3)
    const { container } = renderVariant('background')
    const tints = container.querySelectorAll<HTMLElement>('[data-long-span-id]')
    expect(tints).toHaveLength(long.length)
    for (const el of tints) {
      expect(el.style.height).toBe('480px')
      expect(el.className).toMatch(/bg-(russia|west|both)\/10/)
    }
    const root = container.firstChild as HTMLElement
    expect(root).toHaveAttribute('aria-hidden')
    expect(root.className).toContain('pointer-events-none')
    expect(container).toHaveTextContent('Zweiter Weltkrieg')
    const ww2 = container.querySelector<HTMLElement>('[data-long-span-id="zweiter-weltkrieg"]')!
    expect(parseFloat(ww2.style.left)).toBeCloseTo(timeToX(startOf({ year: 1939, month: 9, day: 1 })), 0)
  })

  it("'bracket' draws a titled bracket per span, stacked without overlap", () => {
    const { container } = renderVariant('bracket')
    for (const e of long) expect(container).toHaveTextContent(e.title)
    const { laneCount } = bracketLayout(entries, timeToX, TODAY)
    expect(laneCount).toBeGreaterThan(1) // Sowjetunion and Kalter Krieg overlap
    expect((container.firstChild as HTMLElement).style.height).toBe(`${laneCount * BRACKET_LANE_PX}px`)
    const els = [...container.querySelectorAll<HTMLElement>('[data-long-span-id]')]
    expect(els).toHaveLength(long.length)
    for (const a of els)
      for (const b of els) {
        if (a === b || a.style.top !== b.style.top) continue
        const [al, bl] = [parseFloat(a.style.left), parseFloat(b.style.left)]
        const [ar, br] = [al + parseFloat(a.style.width), bl + parseFloat(b.style.width)]
        expect(ar <= bl || br <= al).toBe(true)
      }
  })

  it('has no axe violations', async () => {
    for (const variant of ['background', 'bracket'] as const) {
      const { container, unmount } = renderVariant(variant)
      expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations()
      unmount()
    }
  })

  it("'bracket' is decorative and reserves room for titles wider than the bracket", () => {
    const { container } = renderVariant('bracket')
    const root = container.firstChild as HTMLElement
    expect(root).toHaveAttribute('aria-hidden')
    expect(root.className).toContain('pointer-events-none')
    expect(container.querySelectorAll('.border-x-2')).toHaveLength(long.length)
    // Zweiter Weltkrieg (~36 px) is narrower than its title; the reserved title extents in one lane do not overlap.
    const { bars } = bracketLayout(entries, timeToX, TODAY)
    const reserved = bars.map((b) => {
      const title = long.find((e) => e.id === b.id)!.title
      const half = Math.max(0, (title.length + 1) * 7 - (b.x1 - b.x0)) / 2
      return { lane: b.lane, l: b.x0 - half, r: b.x1 + half }
    })
    for (const a of reserved)
      for (const b of reserved)
        if (a !== b && a.lane === b.lane) expect(a.r <= b.l || b.r <= a.l).toBe(true)
  })

  it("'background' ends an ongoing span at today", () => {
    const { container } = renderVariant('background')
    const el = container.querySelector<HTMLElement>(
      '[data-long-span-id="russischer-angriffskrieg-gegen-die-ukraine"]',
    )!
    expect(parseFloat(el.style.left) + parseFloat(el.style.width)).toBeCloseTo(timeToX(TODAY), 3)
  })
})
