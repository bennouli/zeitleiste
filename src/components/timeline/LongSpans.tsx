'use client'

import type { JSX } from 'react'
import clsx from 'clsx'
import { isSpan, type Entry, type Region } from '@/lib/entry'
import { layoutSpans } from '@/lib/spans'
import { entryRange } from '@/lib/time'

/** How long important spans (importance 3) are emphasized, see issue #12. */
export type LongSpanVariant = 'bar' | 'background' | 'bracket'

export interface LongSpansProps {
  /** Importance-3 spans are shown; others are filtered out. */
  spans: Entry[]
  timeToX: (t: number) => number
  today: number
  variant: LongSpanVariant
  /** Height of the whole timeline area in px for 'background'. */
  heightPx: number
  className?: string
}

/** Height of one bracket lane in px. */
export const BRACKET_LANE_PX = 24

const TINT: Record<Region, string> = {
  russia: 'bg-russia/10',
  west: 'bg-west/10',
  both: 'bg-both/10',
}

const LINE: Record<Region, string> = {
  russia: 'border-russia',
  west: 'border-west',
  both: 'border-both',
}

function longSpans(spans: Entry[]): Entry[] {
  return spans.filter((e) => isSpan(e) && e.importance === 3)
}

/** Approximate width of one `text-xs` character, for reserving room for bracket titles. */
const CHAR_WIDTH_PX = 7

function extents(spans: Entry[], timeToX: (t: number) => number, today: number) {
  return spans
    .map((e) => {
      const [start, end] = entryRange(e, today)
      return { id: e.id, x0: timeToX(start), x1: timeToX(end), importance: e.importance }
    })
    .filter((s) => Number.isFinite(s.x0) && Number.isFinite(s.x1))
}

/**
 * Lanes of the 'bracket' strip; its height is `laneCount * BRACKET_LANE_PX`.
 * A centered title wider than its bracket overflows on both sides, so lanes
 * reserve room for the title as well. Returned bars carry the true extent.
 */
export function bracketLayout(spans: Entry[], timeToX: (t: number) => number, today: number) {
  const long = longSpans(spans)
  const titleWidth = new Map(long.map((e) => [e.id, (e.title.length + 1) * CHAR_WIDTH_PX]))
  const spansPx = extents(long, timeToX, today)
  const truth = new Map(spansPx.map((s) => [s.id, s]))
  const inputs = spansPx.map((s) => {
    const half = Math.max(0, (titleWidth.get(s.id) ?? 0) - (s.x1 - s.x0)) / 2
    return { ...s, x0: s.x0 - half, x1: s.x1 + half }
  })
  const layout = layoutSpans(inputs, { minWidthPx: 0 })
  return {
    laneCount: layout.laneCount,
    bars: layout.bars.map((b) => {
      const t = truth.get(b.id)!
      return { ...b, x0: t.x0, x1: t.x1, trueX1: t.x1 }
    }),
  }
}

/**
 * Extra emphasis for long important spans. 'background' is a full-height tint
 * to place behind everything; 'bracket' is a strip to place above the cards band.
 * Both are decorative (aria-hidden); the span band bar is the interactive element.
 */
export function LongSpans({
  spans,
  timeToX,
  today,
  variant,
  heightPx,
  className,
}: LongSpansProps): JSX.Element | null {
  if (variant === 'bar') return null
  const long = longSpans(spans)
  const byId = new Map(long.map((e) => [e.id, e]))

  if (variant === 'background') {
    return (
      <div
        aria-hidden
        data-variant="background"
        className={clsx('pointer-events-none absolute inset-x-0 top-0', className)}
        style={{ height: heightPx }}
      >
        {extents(long, timeToX, today).map(({ id, x0, x1 }) => {
          const e = byId.get(id)!
          return (
            <div
              key={id}
              data-long-span-id={id}
              className={clsx('absolute top-0 overflow-hidden', TINT[e.region])}
              style={{ left: x0, width: Math.max(0, x1 - x0), height: heightPx }}
            >
              <span className="absolute top-1 left-1 max-w-full truncate pr-1 text-xs text-fg-muted">
                {e.title}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const { bars, laneCount } = bracketLayout(long, timeToX, today)
  return (
    <div
      aria-hidden
      data-variant="bracket"
      className={clsx('pointer-events-none relative', className)}
      style={{ height: laneCount * BRACKET_LANE_PX }}
    >
      {bars.map((bar) => {
        const e = byId.get(bar.id)!
        return (
          <div
            key={bar.id}
            data-long-span-id={bar.id}
            className="absolute flex flex-col justify-end"
            style={{
              left: bar.x0,
              width: Math.max(0, bar.x1 - bar.x0),
              top: bar.lane * BRACKET_LANE_PX,
              height: BRACKET_LANE_PX,
            }}
          >
            <span className="flex justify-center">
              <span className="px-1 text-xs leading-4 whitespace-nowrap text-fg">{e.title}</span>
            </span>
            <span className={clsx('h-1.5 shrink-0 border-x-2 border-t-2', LINE[e.region])} />
          </div>
        )
      })}
    </div>
  )
}
