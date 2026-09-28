// Lane layout for time spans (wars, reigns, eras), in px along the x axis.
// Pure geometry; the timeline component converts dates to px and draws the bars.

import { compareIds } from '@/lib/order'

export type SpanInput = {
    id: string
    /** True horizontal extent in px at the current zoom (x1 ≥ x0). */
    x0: number
    x1: number
    /** Higher importance prefers the lane nearest the axis (lane 0). */
    importance: number
    /** Estimated width of the title label in px, for `labelFits`. */
    labelWidthPx?: number
}

export type SpanLayoutOptions = {
    /** Minimum drawn width, default 64 (4rem at 16px). */
    minWidthPx?: number
    /** Horizontal gap between bars in one lane, default 4. */
    gapPx?: number
    /** Inner padding subtracted from the bar width before deciding whether the label fits, default 12. */
    labelPaddingPx?: number
    /**
     * Right edge no stretched bar may cross (e.g. the "today" x). When extending
     * a short bar to the right would pass maxX, it is extended to the left
     * instead, so that x1 = maxX (or trueX1, if the span itself already ends
     * past maxX; the true extent is never clipped). Undefined or non-finite:
     * no limit, bars only extend to the right.
     */
    maxX?: number
}

export type SpanBar = {
    id: string
    /**
     * Drawn extent, containing [trueX0, trueX1]. A bar shorter than minWidthPx
     * is extended to the right (x1 = trueX0 + minWidthPx); if that would cross
     * maxX it ends at max(maxX, trueX1) and extends to the left instead
     * (x0 = x1 - minWidthPx), partly or entirely.
     */
    x0: number
    x1: number
    /** True start of the span in px, ≥ x0. Equals x0 without maxX. */
    trueX0: number
    /** True end of the span in px, ≤ x1. */
    trueX1: number
    /** Whether the bar was stretched to the minimum width. */
    extended: boolean
    /** 0 = nearest the axis. */
    lane: number
    labelFits: boolean
}

export type SpanLayout = {
    bars: SpanBar[]
    laneCount: number
}

export const DEFAULT_MIN_WIDTH_PX = 64
export const DEFAULT_GAP_PX = 4
export const DEFAULT_LABEL_PADDING_PX = 12

/**
 * Assigns each span to a lane so that no two bars in one lane overlap.
 *
 * The minimum width is applied first (see SpanBar and SpanLayoutOptions.maxX);
 * the drawn (possibly extended) extent is what must not overlap, with at least gapPx between bars in a lane. Greedy
 * interval coloring: spans are processed by importance desc, then true x0 asc, then
 * id, and each takes the lowest lane where it fits.
 *
 * Inputs must be finite and ids unique. A malformed span with x1 < x0 is
 * treated as zero-length (trueX1 = x0).
 *
 * Spans are ordered for placement by their true start; bars are returned
 * sorted by lane, then drawn x0, then id (not in input order), so
 * the result does not depend on the input order.
 */
export function layoutSpans(
    spans: readonly SpanInput[],
    options: SpanLayoutOptions = {}
): SpanLayout {
    const minWidth = Math.max(0, options.minWidthPx ?? DEFAULT_MIN_WIDTH_PX)
    const gap = Math.max(0, options.gapPx ?? DEFAULT_GAP_PX)
    const labelPadding = Math.max(
        0,
        options.labelPaddingPx ?? DEFAULT_LABEL_PADDING_PX
    )
    const maxX = Number.isFinite(options.maxX)
        ? (options.maxX as number)
        : Infinity

    const order = [...spans].sort(
        (a, b) =>
            b.importance - a.importance || a.x0 - b.x0 || compareIds(a.id, b.id)
    )

    const lanes: SpanBar[][] = []
    const bars: SpanBar[] = []

    for (const span of order) {
        const trueX0 = span.x0
        const trueX1 = Math.max(trueX0, span.x1)
        const extended = trueX1 - trueX0 < minWidth
        let x0 = trueX0
        let x1 = trueX1
        if (extended) {
            x1 = trueX0 + minWidth
            // Epsilon: float noise at the boundary must not shift the bar left.
            if (x1 > maxX + 1e-6) {
                x1 = Math.max(maxX, trueX1)
                x0 = x1 - minWidth
            }
        }

        let lane = lanes.findIndex((laneBars) =>
            laneBars.every(
                (other) => x0 >= other.x1 + gap || other.x0 >= x1 + gap
            )
        )
        let laneBars = lanes[lane]
        if (!laneBars) {
            lane = lanes.length
            laneBars = []
            lanes.push(laneBars)
        }

        const labelFits =
            span.labelWidthPx !== undefined &&
            span.labelWidthPx + labelPadding <= x1 - x0

        const bar: SpanBar = {
            id: span.id,
            x0,
            x1,
            trueX0,
            trueX1,
            extended,
            lane,
            labelFits,
        }
        laneBars.push(bar)
        bars.push(bar)
    }

    bars.sort(
        (a, b) => a.lane - b.lane || a.x0 - b.x0 || compareIds(a.id, b.id)
    )
    return { bars, laneCount: lanes.length }
}
