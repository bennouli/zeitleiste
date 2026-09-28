'use client'

import { isSpan, type Entry } from '@/lib/entry'
import {
    DEFAULT_MIN_WIDTH_PX,
    layoutSpans,
    type SpanBar,
    type SpanInput,
} from '@/lib/spans'
import { entryRange } from '@/lib/time'
import clsx from 'clsx'
import type { JSX } from 'react'
import { SpanBarView } from './SpanBar'

export interface SpanBandProps {
    /** Span entries only (isSpan); points are ignored. */
    spans: Entry[]
    /** Maps ms → px within the band. */
    timeToX: (t: number) => number
    today: number
    laneHeightPx: number
    /** 4rem in px, measured by the caller (default 64). */
    minWidthPx?: number
    highlightedId?: string | null
    onOpen: (id: string) => void
    wasDrag?: () => boolean
    /** Approximate char width for labelFits estimation, default 7. */
    charWidthPx?: number
    /** Lane per span id, frozen by the timeline between gestures so bars don't jump lanes mid-drag. */
    lanes?: ReadonlyMap<string, number>
    className?: string
}

export const DEFAULT_CHAR_WIDTH_PX = 7

/**
 * Bars and lane count for the given spans at the current zoom.
 * The band needs `laneCount * laneHeightPx` of height.
 * No stretched bar is drawn past today: `options.maxX` defaults to
 * `timeToX(today)`. A span whose true end lies after today (e.g. a finished
 * span with end `{year: <current year>}`, which runs to the end of that year)
 * is not clipped.
 */
export function spanBandLayout(
    spans: Entry[],
    timeToX: (t: number) => number,
    today: number,
    options: { minWidthPx: number; charWidthPx: number; maxX?: number }
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
    const layout = layoutSpans(inputs, {
        minWidthPx: options.minWidthPx,
        maxX: options.maxX ?? timeToX(today),
    })
    return {
        bars: new Map(layout.bars.map((b) => [b.id, b])),
        laneCount: layout.laneCount,
    }
}

/** The band of time-span bars (wars, reigns, eras), stacked in lanes. */
export function SpanBand({
    spans,
    timeToX,
    today,
    laneHeightPx,
    minWidthPx = DEFAULT_MIN_WIDTH_PX,
    highlightedId = null,
    onOpen,
    wasDrag,
    charWidthPx = DEFAULT_CHAR_WIDTH_PX,
    lanes,
    className,
}: SpanBandProps): JSX.Element {
    const live = spanBandLayout(spans, timeToX, today, {
        minWidthPx,
        charWidthPx,
    })
    const bars = live.bars
    let laneCount = live.laneCount
    if (lanes) {
        laneCount = 0
        for (const [id, bar] of bars) {
            const lane = lanes.get(id) ?? bar.lane
            bars.set(id, { ...bar, lane })
            laneCount = Math.max(laneCount, lane + 1)
        }
    }
    // DOM (and tab) order is chronological: true start, then id.
    const ordered = spans
        .filter((e) => bars.has(e.id))
        .sort(
            (a, b) =>
                bars.get(a.id)!.trueX0 - bars.get(b.id)!.trueX0 ||
                (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        )

    return (
        <div
            className={clsx('relative', className)}
            style={{ height: laneCount * laneHeightPx }}
        >
            {ordered.map((entry) => {
                const bar = bars.get(entry.id)!
                return (
                    <SpanBarView
                        key={entry.id}
                        entry={entry}
                        bar={bar}
                        laneHeightPx={laneHeightPx}
                        highlighted={entry.id === highlightedId}
                        onOpen={onOpen}
                        wasDrag={wasDrag}
                    />
                )
            })}
        </div>
    )
}
