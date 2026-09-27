// Lane layout for time spans (wars, reigns, eras), in px along the x axis.
// Pure geometry; the timeline component converts dates to px and draws the bars.

export interface SpanInput {
  id: string
  /** True horizontal extent in px at the current zoom (x1 ≥ x0). */
  x0: number
  x1: number
  /** Higher importance prefers the lane nearest the axis (lane 0). */
  importance: number
  /** Estimated width of the title label in px, for `labelFits`. */
  labelWidthPx?: number
}

export interface SpanLayoutOptions {
  /** Minimum drawn width, default 64 (4rem at 16px). */
  minWidthPx?: number
  /** Horizontal gap between bars in one lane, default 4. */
  gapPx?: number
  /** Inner padding subtracted from the bar width before deciding whether the label fits, default 12. */
  labelPaddingPx?: number
}

export interface SpanBar {
  id: string
  /**
   * Drawn extent. x0 is always the true start; a bar shorter than minWidthPx
   * is extended to the right only (x1 = x0 + minWidthPx).
   */
  x0: number
  x1: number
  /** True end of the span in px, ≤ x1. */
  trueX1: number
  /** Whether the bar was stretched to the minimum width. */
  extended: boolean
  /** 0 = nearest the axis. */
  lane: number
  labelFits: boolean
}

export interface SpanLayout {
  bars: SpanBar[]
  laneCount: number
}

export const DEFAULT_MIN_WIDTH_PX = 64
export const DEFAULT_GAP_PX = 4
export const DEFAULT_LABEL_PADDING_PX = 12

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Assigns each span to a lane so that no two bars in one lane overlap.
 *
 * The minimum width is applied first; the drawn (possibly extended) extent is
 * what must not overlap, with at least gapPx between bars in a lane. Greedy
 * interval coloring: spans are processed by importance desc, then x0 asc, then
 * id, and each takes the lowest lane where it fits.
 *
 * Inputs must be finite and ids unique. A malformed span with x1 < x0 is
 * treated as zero-length (trueX1 = x0).
 *
 * Bars are returned sorted by lane, then x0, then id (not in input order), so
 * the result does not depend on the input order.
 */
export function layoutSpans(
  spans: readonly SpanInput[],
  options: SpanLayoutOptions = {},
): SpanLayout {
  const minWidth = Math.max(0, options.minWidthPx ?? DEFAULT_MIN_WIDTH_PX)
  const gap = Math.max(0, options.gapPx ?? DEFAULT_GAP_PX)
  const labelPadding = Math.max(0, options.labelPaddingPx ?? DEFAULT_LABEL_PADDING_PX)

  const order = [...spans].sort(
    (a, b) => b.importance - a.importance || a.x0 - b.x0 || compareIds(a.id, b.id),
  )

  const lanes: SpanBar[][] = []
  const bars: SpanBar[] = []

  for (const span of order) {
    const trueX1 = Math.max(span.x0, span.x1)
    const extended = trueX1 - span.x0 < minWidth
    const x1 = extended ? span.x0 + minWidth : trueX1

    let lane = lanes.findIndex((laneBars) =>
      laneBars.every((other) => span.x0 >= other.x1 + gap || other.x0 >= x1 + gap),
    )
    let laneBars = lanes[lane]
    if (!laneBars) {
      lane = lanes.length
      laneBars = []
      lanes.push(laneBars)
    }

    const labelFits =
      span.labelWidthPx !== undefined && span.labelWidthPx + labelPadding <= x1 - span.x0

    const bar: SpanBar = { id: span.id, x0: span.x0, x1, trueX1, extended, lane, labelFits }
    laneBars.push(bar)
    bars.push(bar)
  }

  bars.sort((a, b) => a.lane - b.lane || a.x0 - b.x0 || compareIds(a.id, b.id))
  return { bars, laneCount: lanes.length }
}
