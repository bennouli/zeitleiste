'use client'

import { isSpan, type Entry } from '@/lib/entry'
import { compareIds } from '@/lib/order'
import { layoutSpans, type SpanBar, type SpanInput } from '@/lib/spans'
import { entryRange } from '@/lib/time'
import type { JSX } from 'react'
import { AXIS_LINE_Y_PX } from './Axis'
import { SpanBarView } from './SpanBar'

export type SpanLayerProps = {
    /** Span entries only (isSpan); points are ignored. */
    spans: Entry[]
    /** Maps ms → px within the timeline. */
    timeToX: (t: number) => number
    today: number
    /** Lane per span id, frozen by the timeline between gestures so bars don't jump lanes mid-drag. */
    lanes?: ReadonlyMap<string, number>
}

/** A span shorter than this is stretched to it, so it stays visible. */
const SPAN_MIN_WIDTH_PX = 2

type SpanBars = ReadonlyMap<string, SpanBar>

/**
 * Bars (with their lanes) for the given spans at the current zoom, keyed by id.
 * No stretched bar is drawn past today. A span whose true end lies after
 * today (e.g. a finished span with end `{year: <current year>}`, which runs
 * to the end of that year) is not clipped.
 */
export function spanLayout(
    spans: Entry[],
    timeToX: (t: number) => number,
    today: number
): SpanBars {
    const toSpanInput = (e: Entry): SpanInput[] => {
        const [start, end] = entryRange(e, today)
        const x0 = timeToX(start)
        const x1 = timeToX(end)
        if (!Number.isFinite(x0) || !Number.isFinite(x1)) return []
        return [{ id: e.id, x0, x1, importance: e.importance }]
    }
    const inputs = spans.filter(isSpan).flatMap(toSpanInput)
    const layout = layoutSpans(inputs, {
        minWidthPx: SPAN_MIN_WIDTH_PX,
        maxX: timeToX(today),
    })
    return new Map(layout.bars.map((b) => [b.id, b]))
}

/** Time spans (wars, reigns, eras) as thin bars on the axis line, stacked in lanes below it. */
export function SpanLayer({
    spans,
    timeToX,
    today,
    lanes,
}: SpanLayerProps): JSX.Element {
    const liveBars = spanLayout(spans, timeToX, today)
    const bars = lanes ? withFrozenLanes(liveBars, lanes) : liveBars
    // DOM (and tab) order is chronological: true start, then id.
    const ordered = spans
        .filter((e) => bars.has(e.id))
        .sort(
            (a, b) =>
                bars.get(a.id)!.trueX0 - bars.get(b.id)!.trueX0 ||
                compareIds(a.id, b.id)
        )
    return (
        <div
            data-layer="spans"
            className="absolute inset-x-0 z-0 h-0"
            style={{ top: AXIS_LINE_Y_PX }}
        >
            {ordered.map((entry) => (
                <SpanBarView
                    key={entry.id}
                    entry={entry}
                    bar={bars.get(entry.id)!}
                    ongoing={isOngoing(entry, today)}
                />
            ))}
        </div>
    )
}

/** The live bars, each moved to its frozen lane where one is known. */
function withFrozenLanes(
    liveBars: SpanBars,
    lanes: ReadonlyMap<string, number>
): SpanBars {
    return new Map(
        [...liveBars].map(([id, bar]): [string, SpanBar] => [
            id,
            { ...bar, lane: lanes.get(id) ?? bar.lane },
        ])
    )
}

/** Still running today: no end, or an end on or after today. */
function isOngoing(entry: Entry, today: number): boolean {
    return entryRange(entry, today)[1] >= today
}

export const PRIVATE_UNDER_TESTS = { withFrozenLanes }
