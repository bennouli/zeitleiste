'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { isSpan, type Entry, type Region } from '@/lib/entry'
import { entryAnchor, entryRange, MS_PER_YEAR, startOf, todayMs } from '@/lib/time'
import { msPerPx, timeToX, xToTime, type Bounds } from '@/lib/viewport'
import { Axis, AXIS_LINE_Y_PX } from './Axis'
import {
  AXIS_HEIGHT_PX,
  COLLAPSED_HEIGHT,
  FOCUS_VISIBLE_MS,
  SPAN_LANE_HEIGHT_PX,
} from './constants'
import { TimelineContext, type TimelineContextValue } from './TimelineContext'
import { useGestures } from './useGestures'
import { useViewport } from './useViewport'
import { ZoomControls } from './ZoomControls'

export interface TimelineProps {
  entries: Entry[]
  /** Collapsed to about half height while a post is open. */
  collapsed: boolean
  /** Entry to center and highlight, e.g. the open post's entry. */
  focusEntryId: string | null
  onOpenEntry: (id: string) => void
}

/** Lanes reserved for the (temporary) span bars. */
const SPAN_LANES = 3

const REGION_BG: Record<Region, string> = {
  russia: 'bg-russia',
  west: 'bg-west',
  both: 'bg-both',
}

function computeBounds(entries: Entry[], today: number): Bounds {
  let min = Infinity
  for (const e of entries) min = Math.min(min, startOf(e.start))
  if (!Number.isFinite(min) || min >= today) min = today - 100 * MS_PER_YEAR
  return { min, max: today }
}

/** Greedy lane assignment by time; temporary until SpanBand (issue #11). */
function assignLanes(spans: Entry[], today: number): Map<string, number> {
  const sorted = [...spans].sort((a, b) => entryRange(a, today)[0] - entryRange(b, today)[0])
  const laneEnds: number[] = []
  const lanes = new Map<string, number>()
  for (const e of sorted) {
    const [s, end] = entryRange(e, today)
    let lane = laneEnds.findIndex((le) => le <= s)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = end
    lanes.set(e.id, lane % SPAN_LANES)
  }
  return lanes
}

function useElementWidth() {
  const [width, setWidth] = useState(0)
  const elRef = useRef<HTMLElement | null>(null)
  const ref = useCallback((el: HTMLElement | null) => {
    elRef.current = el
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') {
      update()
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { width, ref, elRef }
}

export function Timeline({ entries, collapsed, focusEntryId, onOpenEntry }: TimelineProps) {
  const [today] = useState(todayMs)
  const bounds = useMemo(() => computeBounds(entries, today), [entries, today])
  const { width, ref, elRef } = useElementWidth()
  const helpId = useId()
  const vp = useViewport({ bounds, width })
  const { viewport } = vp

  const actions = useMemo(
    () => ({
      panBy: vp.panBy,
      pinch: vp.pinch,
      beginGesture: vp.beginGesture,
      endGesture: vp.endGesture,
      startMomentum: vp.startMomentum,
      cancelAnimation: vp.cancelAnimation,
      zoomIn: vp.zoomIn,
      zoomOut: vp.zoomOut,
      panStep: vp.panStep,
    }),
    [vp.panBy, vp.pinch, vp.beginGesture, vp.endGesture, vp.startMomentum, vp.cancelAnimation, vp.zoomIn, vp.zoomOut, vp.panStep],
  )
  const gestures = useGestures(elRef, actions, width)

  // Center the focused entry; the first focus (deep link) jumps without animation.
  // Only a change of focusEntryId refocuses; a new `entries` array must not undo the user's pan/zoom.
  const focusedOnce = useRef(false)
  const entriesRef = useRef(entries)
  useEffect(() => {
    entriesRef.current = entries
  })
  const { zoomToTime } = vp
  useEffect(() => {
    if (!focusEntryId) return
    const entry = entriesRef.current.find((e) => e.id === focusEntryId)
    if (!entry) return
    zoomToTime(entryAnchor(entry), FOCUS_VISIBLE_MS, { animate: focusedOnce.current })
    focusedOnce.current = true
  }, [focusEntryId, zoomToTime])
  useEffect(() => {
    if (!focusEntryId) focusedOnce.current = true
  }, [focusEntryId])

  const ctx = useMemo<TimelineContextValue>(
    () => ({
      viewport,
      width,
      bounds,
      today,
      msPerPx: msPerPx(viewport, width),
      timeToX: (t) => timeToX(viewport, width, t),
      xToTime: (x) => xToTime(viewport, width, x),
      isGesturing: vp.isGesturing,
      collapsed,
      gestureEnd: vp.gestureEnd,
      wasDrag: gestures.wasDrag,
    }),
    [viewport, width, bounds, today, vp.isGesturing, collapsed, vp.gestureEnd, gestures.wasDrag],
  )

  const spans = useMemo(() => entries.filter(isSpan), [entries])
  const points = useMemo(() => entries.filter((e) => !isSpan(e)), [entries])
  const lanes = useMemo(() => assignLanes(spans, today), [spans, today])

  const open = (id: string) => {
    if (gestures.wasDrag()) return
    onOpenEntry(id)
  }

  const markerClass = (id: string) =>
    clsx(
      'absolute cursor-pointer focus-visible:outline-2 focus-visible:outline-focus',
      id === focusEntryId && 'ring-2 ring-focus ring-offset-2 ring-offset-surface',
    )

  return (
    <TimelineContext value={ctx}>
      <section
        ref={ref}
        role="region"
        aria-label="Zeitleiste"
        tabIndex={0}
        data-collapsed={collapsed ? 'true' : 'false'}
        aria-describedby={helpId}
        data-view-start={width > 0 ? viewport.start : undefined}
        data-view-end={width > 0 ? viewport.end : undefined}
        className={clsx(
          'relative flex w-full touch-pan-y flex-col overflow-hidden bg-surface text-fg select-none',
          'transition-[height] duration-350 ease-out motion-reduce:transition-none',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
          gestures.isDragging ? 'cursor-grabbing [&_*]:cursor-grabbing' : 'cursor-grab',
        )}
        style={{ height: collapsed ? COLLAPSED_HEIGHT : '100dvh' }}
        {...gestures.handlers}
      >
        <p id={helpId} className="sr-only">
          Mit Plus und Minus zoomen, mit den Pfeiltasten links und rechts in der Zeit verschieben.
        </p>
        {width > 0 && (
          <>
            <div data-layer="above" className="relative min-h-0 flex-1" />
            <div data-layer="axis" className="relative shrink-0" style={{ height: AXIS_HEIGHT_PX }}>
              <Axis />
              {/* temporary until cards/spans are wired (issues #7, #11) */}
              {points.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  data-entry-id={e.id}
                  data-highlighted={e.id === focusEntryId ? 'true' : undefined}
                  aria-label={e.title}
                  title={e.title}
                  onClick={() => open(e.id)}
                  className={clsx(markerClass(e.id), 'size-3 -translate-x-1/2 -translate-y-1/2 rounded-full', REGION_BG[e.region])}
                  style={{ left: ctx.timeToX(entryAnchor(e)), top: AXIS_LINE_Y_PX }}
                />
              ))}
            </div>
            <div data-layer="below" className="relative min-h-0 flex-1" />
            <div
              data-layer="spans"
              className="relative shrink-0"
              style={{ height: SPAN_LANES * SPAN_LANE_HEIGHT_PX }}
            >
              {/* temporary until cards/spans are wired (issues #7, #11) */}
              {spans.map((e) => {
                const [s, end] = entryRange(e, today)
                const x0 = ctx.timeToX(s)
                const x1 = ctx.timeToX(end)
                return (
                  <button
                    key={e.id}
                    type="button"
                    data-entry-id={e.id}
                    data-highlighted={e.id === focusEntryId ? 'true' : undefined}
                    aria-label={e.title}
                    title={e.title}
                    onClick={() => open(e.id)}
                    className={clsx(markerClass(e.id), 'h-2 rounded-sm', REGION_BG[e.region])}
                    style={{
                      left: x0,
                      width: Math.max(x1 - x0, 2),
                      top: (lanes.get(e.id) ?? 0) * SPAN_LANE_HEIGHT_PX + (SPAN_LANE_HEIGHT_PX - 8) / 2,
                    }}
                  />
                )
              })}
            </div>
          </>
        )}
        <ZoomControls
          canZoomIn={vp.canZoomIn}
          canZoomOut={vp.canZoomOut}
          onZoomIn={vp.zoomIn}
          onZoomOut={vp.zoomOut}
        />
      </section>
    </TimelineContext>
  )
}
