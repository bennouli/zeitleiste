'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { isSpan, type Entry } from '@/lib/entry'
import { entryAnchor, MS_PER_YEAR, startOf, todayMs } from '@/lib/time'
import { msPerPx, timeToX, xToTime, type Bounds } from '@/lib/viewport'
import { Axis, AXIS_LINE_Y_PX } from './Axis'
import { CardLayer, groupLabel } from './CardLayer'
import {
  AXIS_HEIGHT_PX,
  CARD_ROW_HEIGHT_PX,
  COLLAPSED_HEIGHT,
  FOCUS_VISIBLE_MS,
  SPAN_LANE_HEIGHT_PX,
} from './constants'
import { CARD_HEIGHT_PX, CONNECTOR_MIN_PX } from './EntryCard'
import { GroupMarker } from './GroupMarker'
import { groupStackHeightPx } from './GroupStack'
import { BRACKET_LANE_PX, bracketLayout, LongSpans, type LongSpanVariant } from './LongSpans'
import { PrototypeSwitches } from './PrototypeSwitches'
import { SpanBand, spanBandLayout } from './SpanBand'
import type { ShortSpanStyle } from './SpanBar'
import { TimelineContext, type TimelineContextValue } from './TimelineContext'
import { useEntryLayout } from './useEntryLayout'
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

/** Vertical gap between cards in a group stack. */
const STACK_GAP_PX = 8
const SLOT_HEIGHT_PX = CARD_HEIGHT_PX + STACK_GAP_PX
/** Below this width the timeline behaves like a phone: one card per group. */
const PHONE_WIDTH_PX = 640
/** Room kept free for the "Heute" label and the zoom buttons. */
const MIN_BAND_LEVELS = 1

function computeBounds(entries: Entry[], today: number): Bounds {
  let min = Infinity
  for (const e of entries) min = Math.min(min, startOf(e.start))
  if (!Number.isFinite(min) || min >= today) min = today - 100 * MS_PER_YEAR
  return { min, max: today }
}

function useElementSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const elRef = useRef<HTMLElement | null>(null)
  const ref = useCallback((el: HTMLElement | null) => {
    elRef.current = el
    if (!el) return
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    if (typeof ResizeObserver === 'undefined') {
      update()
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ...size, ref, elRef }
}

/** 4rem in px, so the span minimum width follows the root font size. */
function remPx(rem: number): number {
  if (typeof document === 'undefined') return rem * 16
  const size = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return (Number.isFinite(size) && size > 0 ? size : 16) * rem
}

export function Timeline({ entries, collapsed, focusEntryId, onOpenEntry }: TimelineProps) {
  const [today] = useState(todayMs)
  const bounds = useMemo(() => computeBounds(entries, today), [entries, today])
  const { width, height, ref, elRef } = useElementSize()
  const helpId = useId()
  const vp = useViewport({ bounds, width })
  const { viewport } = vp
  const [shortSpanStyle, setShortSpanStyle] = useState<ShortSpanStyle>('uniform')
  const [longSpanVariant, setLongSpanVariant] = useState<LongSpanVariant>('bar')

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

  const toX = useCallback((t: number) => timeToX(viewport, width, t), [viewport, width])
  const ctx = useMemo<TimelineContextValue>(
    () => ({
      viewport,
      width,
      bounds,
      today,
      msPerPx: msPerPx(viewport, width),
      timeToX: toX,
      xToTime: (x) => xToTime(viewport, width, x),
      isGesturing: vp.isGesturing,
      collapsed,
      gestureEnd: vp.gestureEnd,
      wasDrag: gestures.wasDrag,
    }),
    [viewport, width, bounds, today, toX, vp.isGesturing, collapsed, vp.gestureEnd, gestures.wasDrag],
  )

  const spans = useMemo(() => entries.filter(isSpan), [entries])
  const spanMinWidthPx = useMemo(() => remPx(4), [])

  // Band heights are fixed between gestures so nothing resizes while dragging.
  const layoutKey = `${vp.gestureEnd}|${width}|${height}|${collapsed}`
  const bands = useMemo(() => {
    const spanLanes = Math.max(1, spanBandLayout(spans, toX, today, { minWidthPx: spanMinWidthPx, charWidthPx: 7 }).laneCount)
    const bracketLanes = longSpanVariant === 'bracket' ? bracketLayout(spans, toX, today).laneCount : 0
    const spansHeight = spanLanes * SPAN_LANE_HEIGHT_PX
    const bracketHeight = bracketLanes * BRACKET_LANE_PX
    const bandHeight = Math.max(0, (height - AXIS_HEIGHT_PX - spansHeight - bracketHeight) / 2)
    const maxLevels = Math.max(MIN_BAND_LEVELS, Math.floor(bandHeight / CARD_ROW_HEIGHT_PX))
    const phone = width < PHONE_WIDTH_PX
    const wanted = collapsed ? 2 : phone ? 1 : 3
    const fitting = Math.floor((bandHeight - CONNECTOR_MIN_PX - 36) / SLOT_HEIGHT_PX)
    const visibleCount = Math.max(1, Math.min(wanted, fitting))
    const stackHeight = groupStackHeightPx(visibleCount + 1, visibleCount, SLOT_HEIGHT_PX) + CONNECTOR_MIN_PX
    const groupLevels = Math.max(1, Math.ceil(stackHeight / CARD_ROW_HEIGHT_PX))
    return { spansHeight, bracketHeight, maxLevels, visibleCount, groupLevels }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed per gesture end via layoutKey
  }, [layoutKey, spans, today, spanMinWidthPx, longSpanVariant])

  const layout = useEntryLayout(
    entries,
    {
      timeToX: toX,
      msPerPx: ctx.msPerPx,
      width,
      maxLevels: bands.maxLevels,
      groupLevels: bands.groupLevels,
      gapPx: 8,
    },
    `${layoutKey}|${bands.maxLevels}|${bands.groupLevels}`,
  )

  const open = (id: string) => {
    if (gestures.wasDrag()) return
    onOpenEntry(id)
  }

  const zoomIntoGroup = (groupEntries: Entry[]) => {
    const first = groupEntries[0]
    const last = groupEntries[groupEntries.length - 1]
    if (!first || !last) return
    const t0 = entryAnchor(first)
    const t1 = entryAnchor(last)
    zoomToTime((t0 + t1) / 2, Math.max((t1 - t0) * 3, 2 * MS_PER_YEAR), { animate: true })
  }

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
            {longSpanVariant === 'background' && (
              <LongSpans spans={spans} timeToX={toX} today={today} variant="background" heightPx={height} />
            )}
            {longSpanVariant === 'bracket' && (
              <div data-layer="brackets" className="relative z-10 shrink-0" style={{ height: bands.bracketHeight }}>
                <LongSpans spans={spans} timeToX={toX} today={today} variant="bracket" heightPx={height} />
              </div>
            )}
            <div data-layer="above" className="relative z-20 min-h-0 flex-1">
              <CardLayer
                side="above"
                items={layout.items}
                rowHeightPx={CARD_ROW_HEIGHT_PX}
                visibleCount={bands.visibleCount}
                slotHeightPx={SLOT_HEIGHT_PX}
                focusEntryId={focusEntryId}
                onOpen={open}
              />
            </div>
            <div data-layer="axis" className="relative z-10 shrink-0" style={{ height: AXIS_HEIGHT_PX }}>
              <Axis />
              {layout.groups.map((g) => {
                const x = toX(g.t)
                if (x < -40 || x > width + 40) return null
                const highlighted = g.entries.some((e) => e.id === focusEntryId)
                return (
                  <div
                    key={g.id}
                    data-group-marker={g.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: x, top: AXIS_LINE_Y_PX }}
                  >
                    <GroupMarker
                      count={g.entries.length}
                      label={groupLabel(g.entries)}
                      highlighted={highlighted}
                      onActivate={() => {
                        if (!gestures.wasDrag()) zoomIntoGroup(g.entries)
                      }}
                    />
                  </div>
                )
              })}
            </div>
            <div data-layer="below" className="relative z-20 min-h-0 flex-1">
              <CardLayer
                side="below"
                items={layout.items}
                rowHeightPx={CARD_ROW_HEIGHT_PX}
                visibleCount={bands.visibleCount}
                slotHeightPx={SLOT_HEIGHT_PX}
                focusEntryId={focusEntryId}
                onOpen={open}
              />
            </div>
            <div data-layer="spans" className="relative z-10 shrink-0" style={{ height: bands.spansHeight }}>
              <SpanBand
                spans={spans}
                timeToX={toX}
                today={today}
                laneHeightPx={SPAN_LANE_HEIGHT_PX}
                minWidthPx={spanMinWidthPx}
                shortSpanStyle={shortSpanStyle}
                highlightedId={focusEntryId}
                onOpen={open}
                wasDrag={gestures.wasDrag}
              />
            </div>
          </>
        )}
        <ZoomControls
          canZoomIn={vp.canZoomIn}
          canZoomOut={vp.canZoomOut}
          onZoomIn={vp.zoomIn}
          onZoomOut={vp.zoomOut}
        />
        <PrototypeSwitches
          shortSpanStyle={shortSpanStyle}
          onShortSpanStyle={setShortSpanStyle}
          longSpanVariant={longSpanVariant}
          onLongSpanVariant={setLongSpanVariant}
        />
      </section>
    </TimelineContext>
  )
}
