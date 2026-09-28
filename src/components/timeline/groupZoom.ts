import type { Entry } from '@/lib/entry'
import { entryAnchor, MS_PER_YEAR } from '@/lib/time'
import type { Viewport } from '@/lib/viewport'

export type ZoomTarget = { centerT: number; spanMs: number }

/**
 * Centre and span that open up a group: three times its width, at least two years,
 * at most half the current span so a group spanning the whole view still zooms in.
 */
export function groupZoomTarget(
    groupEntries: Entry[],
    viewport: Viewport
): ZoomTarget | null {
    const first = groupEntries[0]
    const last = groupEntries[groupEntries.length - 1]
    if (!first || !last) return null
    const t0 = entryAnchor(first)
    const t1 = entryAnchor(last)
    return {
        centerT: (t0 + t1) / 2,
        spanMs: Math.min(
            (viewport.end - viewport.start) / 2,
            Math.max((t1 - t0) * 3, 2 * MS_PER_YEAR)
        ),
    }
}
