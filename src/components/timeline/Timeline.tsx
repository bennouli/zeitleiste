'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import clsx from 'clsx'
import { isSpan, type Entry } from '@/lib/entry'
import { findFocusTarget } from './focusTarget'
import { entryAnchor, MS_PER_YEAR, startOf, todayMs } from '@/lib/time'
import { msPerPx, panBy as panViewport, timeToX, xToTime, type Bounds } from '@/lib/viewport'
import { Axis } from './Axis'
import { CardLayer } from './CardLayer'
import {
  ANIMATION_MS,
  AXIS_HEIGHT_PX,
  CARD_ROW_HEIGHT_PX,
  COLLAPSED_HEIGHT,
  FOCUS_VISIBLE_MS,
  SPAN_LANE_HEIGHT_PX,
} from './constants'
import { CARD_HEIGHT_PX, CONNECTOR_MIN_PX } from './EntryCard'
import { GROUP_STACK_CONTROLS_HEIGHT_PX, groupStackHeightPx } from './GroupStack'
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

/** Distance kept between a revealed entry and the timeline's edges. */
const REVEAL_MARGIN_PX = 16
/** An element wider than the view counts as visible once this much of it shows. */
const REVEAL_MIN_VISIBLE_PX = 48

/**
 * Horizontal pan (px, positive moves content right) that brings the extent
 * [left, right] (px from the timeline's left edge) into view; 0 if it is visible.
 */
export function revealDelta(left: number, right: number, width: number): number {
  const lo = REVEAL_MARGIN_PX
  const hi = width - REVEAL_MARGIN_PX
  if (right - left > hi - lo) {
    const visible = Math.min(right, hi) - Math.max(left, lo)
    return visible >= Math.min(REVEAL_MIN_VISIBLE_PX, right - left) ? 0 : lo - left
  }
  if (left < lo) return lo - left
  if (right > hi) return hi - right
  return 0
}

interface FocusedItem {
  el: HTMLElement
  /** Entries the focused element stands for (a card, a stack, a marker). */
  ids: string[]
}

function entryIdsOf(el: HTMLElement): string[] {
  const holder = el.closest<HTMLElement>('[data-entry-id], [data-entry-ids], [data-span-id]')
  if (!holder) return []
  const { entryId, entryIds, spanId } = holder.dataset
  return entryId ? [entryId] : spanId ? [spanId] : (entryIds ?? '').split(' ').filter(Boolean)
}

function isFocusVisible(el: HTMLElement): boolean {
  try {
    return el.matches(':focus-visible')
  } catch {
    return true
  }
}

function computeBounds(entries: Entry[], today: number): Bounds {
  let min = Infinity
  for (const e of entries) min = Math.min(min, startOf(e.start))
  if (!Number.isFinite(min) || min >= today) min = today - 100 * MS_PER_YEAR
  return { min, max: today }
}

/** The last value that stayed unchanged for `delayMs`; ignores the frames of a height transition. */
function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    if (Object.is(value, settled)) return
    const id = window.setTimeout(() => setSettled(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, settled, delayMs])
  return settled
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
  const { width, height: liveHeight, ref, elRef } = useElementSize()
  // Wait until the height transition is over, so cards don't reshuffle while the timeline collapses.
  const height = useSettled(liveHeight, ANIMATION_MS + 50)
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
    const spanLayout = spanBandLayout(spans, toX, today, { minWidthPx: spanMinWidthPx, charWidthPx: 7 })
    const spanLanes = Math.max(1, spanLayout.laneCount)
    const lanes = new Map([...spanLayout.bars].map(([id, bar]) => [id, bar.lane]))
    const bracketLanes = longSpanVariant === 'bracket' ? bracketLayout(spans, toX, today).laneCount : 0
    const spansHeight = spanLanes * SPAN_LANE_HEIGHT_PX
    const bracketHeight = bracketLanes * BRACKET_LANE_PX
    const bandHeight = Math.max(0, (height - AXIS_HEIGHT_PX - spansHeight - bracketHeight) / 2)
    const maxLevels = Math.max(MIN_BAND_LEVELS, Math.floor(bandHeight / CARD_ROW_HEIGHT_PX))
    const phone = width < PHONE_WIDTH_PX
    const wanted = phone ? 1 : collapsed ? 2 : 3
    const fitting = Math.floor((bandHeight - CONNECTOR_MIN_PX - GROUP_STACK_CONTROLS_HEIGHT_PX) / SLOT_HEIGHT_PX)
    const visibleCount = Math.max(1, Math.min(wanted, fitting))
    const stackHeight = groupStackHeightPx(visibleCount + 1, visibleCount, SLOT_HEIGHT_PX) + CONNECTOR_MIN_PX
    const groupLevels = Math.max(1, Math.ceil(stackHeight / CARD_ROW_HEIGHT_PX))
    return { spansHeight, bracketHeight, maxLevels, visibleCount, groupLevels, lanes }
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
    // At most half the current span, or a group spanning the whole view would not zoom at all.
    const span = Math.min((viewport.end - viewport.start) / 2, Math.max((t1 - t0) * 3, 2 * MS_PER_YEAR))
    zoomToTime((t0 + t1) / 2, span, { animate: true })
  }

  // Keyboard focus on an entry outside the visible width pans the timeline to it.
  const sectionRef = elRef
  const focusedRef = useRef<FocusedItem | null>(null)
  const onFocus = (e: FocusEvent<HTMLElement>) => {
    const target = e.target
    if (target === e.currentTarget) return
    focusedRef.current = { el: target, ids: entryIdsOf(target) }
    if (width <= 0 || !isFocusVisible(target)) return
    const r = target.getBoundingClientRect()
    // No layout (jsdom): nothing to judge.
    if (r.width === 0 && r.height === 0) return
    const left = r.left - e.currentTarget.getBoundingClientRect().left
    const dx = revealDelta(left, left + r.width, width)
    if (dx === 0) return
    const next = panViewport(viewport, width, dx, bounds)
    zoomToTime((next.start + next.end) / 2, next.end - next.start, { animate: true })
  }

  // Focus leaving the timeline ends the tracking.
  useEffect(() => {
    const onFocusIn = (e: globalThis.FocusEvent) => {
      if (!(e.target instanceof Node) || !sectionRef.current?.contains(e.target)) focusedRef.current = null
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [sectionRef])

  // A relayout can unmount the focused card (merged into a group, a group split up, a marker zoomed into)
  // or hide it in a stack (inert); focus would drop to <body> and Tab restart at the top.
  // Move it to the same entry's new element instead.
  useLayoutEffect(() => {
    const f = focusedRef.current
    const section = sectionRef.current
    if (!f || !section || (f.el.isConnected && !f.el.closest('[inert]'))) return
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    focusedRef.current = null
    const next = findFocusTarget(section, f.ids) ?? section
    next.focus({ preventScroll: true })
  })

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
          // clip, not hidden: a clipped box is no scroll container, so focusing an off-screen card can't scroll it.
          'relative flex w-full touch-pan-y flex-col overflow-clip bg-surface text-fg select-none',
          'transition-[height] duration-350 ease-out motion-reduce:transition-none',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
          gestures.isDragging ? 'cursor-grabbing [&_*]:cursor-grabbing' : 'cursor-grab',
        )}
        style={{ height: collapsed ? COLLAPSED_HEIGHT : '100dvh' }}
        {...gestures.handlers}
        onFocus={onFocus}
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
            {/* Flex spacers: the cards themselves live in the axis band, in one chronological order. */}
            <div data-layer="above" className="min-h-0 flex-1" />
            <div data-layer="axis" className="relative z-10 shrink-0" style={{ height: AXIS_HEIGHT_PX }}>
              <Axis />
              <CardLayer
                items={layout.items}
                rowHeightPx={CARD_ROW_HEIGHT_PX}
                visibleCount={bands.visibleCount}
                slotHeightPx={SLOT_HEIGHT_PX}
                focusEntryId={focusEntryId}
                onOpen={open}
                onZoomIntoGroup={zoomIntoGroup}
              />
            </div>
            <div data-layer="below" className="min-h-0 flex-1" />
            <div data-layer="spans" className="relative z-10 shrink-0" style={{ height: bands.spansHeight }}>
              <SpanBand
                spans={spans}
                timeToX={toX}
                today={today}
                laneHeightPx={SPAN_LANE_HEIGHT_PX}
                minWidthPx={spanMinWidthPx}
                lanes={bands.lanes}
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
