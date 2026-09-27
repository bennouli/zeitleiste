'use client'

import type { JSX } from 'react'
import clsx from 'clsx'
import { isSpan, type Entry } from '@/lib/entry'
import { layoutSpans, type SpanBar, type SpanInput } from '@/lib/spans'
import { entryRange } from '@/lib/time'
import { SpanBarView, type ShortSpanStyle } from './SpanBar'

export interface SpanBandProps {
  /** Span entries only (isSpan); points are ignored. */
  spans: Entry[]
  /** Maps ms → px within the band. */
  timeToX: (t: number) => number
  today: number
  laneHeightPx: number
  /** 4rem in px, measured by the caller (default 64). */
  minWidthPx?: number
  shortSpanStyle: ShortSpanStyle
  highlightedId?: string | null
  onOpen: (id: string) => void
  wasDrag?: () => boolean
  /** Approximate char width for labelFits estimation, default 7. */
  charWidthPx?: number
  className?: string
}

export const DEFAULT_CHAR_WIDTH_PX = 7

/**
 * Bars and lane count for the given spans at the current zoom.
 * The band needs `laneCount * laneHeightPx` of height.
 */
export function spanBandLayout(
  spans: Entry[],
  timeToX: (t: number) => number,
  today: number,
  options: { minWidthPx: number; charWidthPx: number },
): { bars: Map<string, SpanBar>; laneCount: number } {
  const inputs: SpanInput[] = []
  for (const e of spans) {
    if (!isSpan(e)) continue
    const [start, end] = entryRange(e, today)
    const x0 = timeToX(start)
    const x1 = timeToX(end)
    if (!Number.isFinite(x0) || !Number.isFinite(x1)) continue
    inputs.push({
      id: e.id,
      x0,
      x1,
      importance: e.importance,
      labelWidthPx: e.title.length * options.charWidthPx,
    })
  }
  const layout = layoutSpans(inputs, { minWidthPx: options.minWidthPx })
  return { bars: new Map(layout.bars.map((b) => [b.id, b])), laneCount: layout.laneCount }
}

/** The band of time-span bars (wars, reigns, eras), stacked in lanes. */
export function SpanBand({
  spans,
  timeToX,
  today,
  laneHeightPx,
  minWidthPx = 64,
  shortSpanStyle,
  highlightedId = null,
  onOpen,
  wasDrag,
  charWidthPx = DEFAULT_CHAR_WIDTH_PX,
  className,
}: SpanBandProps): JSX.Element {
  const { bars, laneCount } = spanBandLayout(spans, timeToX, today, { minWidthPx, charWidthPx })
  // DOM (and tab) order follows position on the axis.
  const ordered = spans
    .filter((e) => bars.has(e.id))
    .sort((a, b) => bars.get(a.id)!.x0 - bars.get(b.id)!.x0)

  return (
    <div className={clsx('relative', className)} style={{ height: laneCount * laneHeightPx }}>
      {ordered.map((entry) => {
        const bar = bars.get(entry.id)!
        return (
          <SpanBarView
            key={entry.id}
            entry={entry}
            bar={bar}
            laneHeightPx={laneHeightPx}
            shortSpanStyle={shortSpanStyle}
            highlighted={entry.id === highlightedId}
            onOpen={onOpen}
            wasDrag={wasDrag}
          />
        )
      })}
    </div>
  )
}
