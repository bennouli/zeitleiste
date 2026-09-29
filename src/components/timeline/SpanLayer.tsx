'use client'

import type { Entry } from '@/lib/entry'
import { compareIds } from '@/lib/order'
import type { JSX } from 'react'
import { AXIS_LINE_Y_PX } from './Axis'
import { SpanBarView } from './SpanBar'
import { isOngoing, spanLayout, withFrozenLanes } from './spanGeometry'

export type SpanLayerProps = {
    /** Span entries only (isSpan); points are ignored. */
    spans: Entry[]
    /** Maps ms → px within the timeline. */
    timeToX: (t: number) => number
    today: number
    /** Lane per span id, frozen by the timeline between gestures so bars don't jump lanes mid-drag. */
    lanes: ReadonlyMap<string, number>
    /** Click on a span's bar. */
    onBarClick?: (id: string) => void
}

/** Time spans (wars, reigns, eras) as thin bars on the axis line, stacked in lanes below it. */
export function SpanLayer({
    spans,
    timeToX,
    today,
    lanes,
    onBarClick,
}: SpanLayerProps): JSX.Element {
    const bars = withFrozenLanes(spanLayout(spans, timeToX, today), lanes)
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
                    onClick={onBarClick}
                />
            ))}
        </div>
    )
}
