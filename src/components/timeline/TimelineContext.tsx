'use client'

import type { Bounds, Viewport } from '@/lib/viewport'
import { createContext, useContext } from 'react'

export type TimelineContextValue = {
    /** Visible time range (ms UTC). */
    viewport: Viewport
    /** Measured container width in px; 0 before the first measurement. */
    width: number
    /** Data range: earliest entry start … today. */
    bounds: Bounds
    /** Today 00:00 UTC, computed once on load. */
    today: number
    msPerPx: number
    /** x in px relative to the container's left edge. */
    timeToX: (t: number) => number
    /** True while a drag/pinch, momentum or zoom animation runs. */
    isGesturing: boolean
    collapsed: boolean
    /** Increments whenever a drag, pinch, momentum or animation has settled; recompute layout on change (and on width change). */
    gestureEnd: number
    /** True if the current/last press became a drag; click handlers of entries must ignore the click then. */
    wasDrag: () => boolean
}

export const TimelineContext = createContext<TimelineContextValue | null>(null)

export function useTimeline(): TimelineContextValue {
    const ctx = useContext(TimelineContext)
    if (!ctx) throw new Error('useTimeline must be used inside <Timeline>')
    return ctx
}
