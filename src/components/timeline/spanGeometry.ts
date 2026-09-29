import { isSpan, type Entry } from '@/lib/entry'
import { layoutSpans, type SpanBar, type SpanInput } from '@/lib/spans'
import { entryRange } from '@/lib/time'
import { AXIS_LINE_THICKNESS_PX } from './Axis'

export type SpanBars = ReadonlyMap<string, SpanBar>

/** Top edge (relative to the axis line's top edge) and height of a bar, in px. */
export type LaneBox = { top: number; height: number }

/** A span shorter than this is stretched to it, so it stays visible. */
const SPAN_MIN_WIDTH_PX = 2
const AXIS_LANE_HEIGHT_PX = 9
const LOWER_LANE_HEIGHT_PX = 6
const FIRST_LOWER_LANE_TOP_PX = 7
const LOWER_LANE_PITCH_PX = 8

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
        return [{ id: e.id, x0, x1 }]
    }
    const inputs = spans.filter(isSpan).flatMap(toSpanInput)
    const layout = layoutSpans(inputs, {
        minWidthPx: SPAN_MIN_WIDTH_PX,
        maxX: timeToX(today),
    })
    return new Map(layout.bars.map((b) => [b.id, b]))
}

/** The live bars, each moved to its frozen lane where one is known. */
export function withFrozenLanes(
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

/**
 * Still running today: `end: 'ongoing'`, or an end whose unit (day, month,
 * year) has not passed yet. A span that ended yesterday is over.
 */
export function isOngoing(entry: Entry, today: number): boolean {
    return entry.end === 'ongoing' || entryRange(entry, today)[1] > today
}

/** Lane 0 is centred on the axis line; lanes 1 and up hang below it, thinner. */
export function laneBox(lane: number): LaneBox {
    if (lane === 0)
        return {
            top: (AXIS_LINE_THICKNESS_PX - AXIS_LANE_HEIGHT_PX) / 2,
            height: AXIS_LANE_HEIGHT_PX,
        }
    return {
        top: FIRST_LOWER_LANE_TOP_PX + (lane - 1) * LOWER_LANE_PITCH_PX,
        height: LOWER_LANE_HEIGHT_PX,
    }
}
