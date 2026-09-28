'use client'

import { isSpan, type Entry } from '@/lib/entry'
import { entryAnchor, MS_PER_YEAR, startOf, todayMs } from '@/lib/time'
import { msPerPx, timeToX, type Bounds } from '@/lib/viewport'
import clsx from 'clsx'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Axis } from './Axis'
import { bandGeometry, SLOT_HEIGHT_PX } from './bandGeometry'
import { CardLayer } from './CardLayer'
import {
    AXIS_HEIGHT_PX,
    CARD_GAP_PX,
    CARD_ROW_HEIGHT_PX,
    COLLAPSE_ANIMATION_MS,
    COLLAPSED_HEIGHT,
    FOCUS_VISIBLE_MS,
} from './constants'
import { useEntryFocus } from './entryFocus'
import { groupZoomTarget } from './groupZoom'
import { LABEL_MAX_WIDTH_PX } from './labelMetrics'
import { spanLayout } from './spanGeometry'
import { SpanLayer } from './SpanLayer'
import { TimelineContext, type TimelineContextValue } from './TimelineContext'
import { useEntryLayout } from './useEntryLayout'
import { useGestures } from './useGestures'
import { useViewport, type ViewportActions } from './useViewport'
import { ZoomControls } from './ZoomControls'

export type TimelineProps = {
    entries: Entry[]
    /** Collapsed to about half height while a post is open. */
    collapsed: boolean
    /** Entry to center and highlight, e.g. the open post's entry. */
    focusEntryId: string | null
    onOpenEntry: (id: string) => void
}

const HEIGHT_SETTLE_MS = COLLAPSE_ANIMATION_MS + 50
const FALLBACK_HISTORY_MS = 100 * MS_PER_YEAR

export function Timeline({
    entries,
    collapsed,
    focusEntryId,
    onOpenEntry,
}: TimelineProps) {
    const [today] = useState(todayMs)
    const { width, height: liveHeight, ref, elRef } = useElementSize()
    const bounds = useMemo(
        () => dataBounds(entries, today, width),
        [entries, today, width]
    )
    const height = useSettled(liveHeight, HEIGHT_SETTLE_MS)
    const isMeasured = width > 0 && height > 0
    const helpId = useId()
    const controls = useViewport({ bounds, width })
    const { viewport, actions } = controls
    const gestures = useGestures(elRef, actions, width)
    useCenteredEntry(entries, focusEntryId, actions.zoomToTime)
    const { onFocus } = useEntryFocus(elRef, actions.panStep, width)

    const toX = useCallback(
        (t: number) => timeToX(viewport, width, t),
        [viewport, width]
    )
    const ctx = useMemo<TimelineContextValue>(
        () => ({
            viewport,
            width,
            bounds,
            today,
            msPerPx: msPerPx(viewport, width),
            timeToX: toX,
            isGesturing: controls.isGesturing,
            collapsed,
            gestureEnd: controls.gestureEnd,
            wasDrag: gestures.wasDrag,
        }),
        [
            viewport,
            width,
            bounds,
            today,
            toX,
            controls.isGesturing,
            collapsed,
            controls.gestureEnd,
            gestures.wasDrag,
        ]
    )

    const spans = useMemo(() => entries.filter(isSpan), [entries])

    const layoutKey = `${controls.gestureEnd}|${width}|${height}|${collapsed}`
    const layoutToX = useSnapshotPerKey(toX, layoutKey)
    const spanLanes = useMemo(() => {
        const bars = spanLayout(spans, layoutToX, today)
        return new Map([...bars].map(([id, bar]) => [id, bar.lane]))
    }, [spans, layoutToX, today])
    const bands = useMemo(
        () => bandGeometry(height, width, collapsed),
        [height, width, collapsed]
    )

    const layout = useEntryLayout(
        entries,
        {
            timeToX: toX,
            msPerPx: ctx.msPerPx,
            width,
            maxLevels: bands.maxLevels,
            groupLevels: bands.groupLevels,
            gapPx: CARD_GAP_PX,
        },
        `${layoutKey}|${bands.maxLevels}|${bands.groupLevels}`
    )

    const open = (id: string) => {
        if (gestures.wasDrag()) return
        onOpenEntry(id)
    }

    const zoomIntoGroup = (groupEntries: Entry[]) => {
        const target = groupZoomTarget(groupEntries, viewport)
        if (target)
            actions.zoomToTime(target.centerT, target.spanMs, { animate: true })
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
                    // clip, not hidden: a clipped box is no scroll container, so focusing an off-screen card can't scroll it.
                    'relative flex w-full touch-pan-y flex-col overflow-clip bg-surface text-fg select-none',
                    'transition-[height] duration-500 ease-in-out motion-reduce:transition-none',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                    gestures.isDragging
                        ? 'cursor-grabbing [&_*]:cursor-grabbing'
                        : 'cursor-grab'
                )}
                style={{ height: collapsed ? COLLAPSED_HEIGHT : '100dvh' }}
                {...gestures.handlers}
                onFocus={onFocus}
            >
                <p id={helpId} className="sr-only">
                    Mit Plus und Minus zoomen, mit den Pfeiltasten links und
                    rechts in der Zeit verschieben.
                </p>
                {isMeasured && (
                    <>
                        <div data-layer="above" className="min-h-0 flex-1" />
                        <div
                            data-layer="axis"
                            className="relative z-10 shrink-0"
                            style={{ height: AXIS_HEIGHT_PX }}
                        >
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
                            <SpanLayer
                                spans={spans}
                                timeToX={toX}
                                today={today}
                                lanes={spanLanes}
                            />
                        </div>
                        <div data-layer="below" className="min-h-0 flex-1" />
                    </>
                )}
                <p
                    aria-hidden="true"
                    className="pointer-events-none absolute top-5.5 left-8 z-20 small-caps text-label-lg font-medium tracking-wordmark text-fg"
                >
                    Zeitleiste
                </p>
                <ZoomControls
                    canZoomIn={controls.canZoomIn}
                    canZoomOut={controls.canZoomOut}
                    onZoomIn={actions.zoomIn}
                    onZoomOut={actions.zoomOut}
                />
            </section>
        </TimelineContext>
    )
}

/**
 * Earliest entry start … today, plus room for one card anchored on today;
 * a century back when no entry lies in the past.
 */
function dataBounds(entries: Entry[], today: number, width: number): Bounds {
    const earliest = Math.min(...entries.map((e) => startOf(e.start)))
    const min =
        Number.isFinite(earliest) && earliest < today
            ? earliest
            : today - FALLBACK_HISTORY_MS
    const endRoom = width > 0 ? (LABEL_MAX_WIDTH_PX + CARD_GAP_PX) / width : 0
    return { min, max: today, endRoom }
}

function useElementSize() {
    const [size, setSize] = useState({ width: 0, height: 0 })
    const elRef = useRef<HTMLElement | null>(null)
    const ref = useCallback((el: HTMLElement | null) => {
        elRef.current = el
        if (!el) return
        const update = () =>
            setSize({ width: el.clientWidth, height: el.clientHeight })
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

/**
 * The last value that stayed unchanged for `delayMs`; ignores the frames of a height transition.
 * The first change away from the initial (unmeasured) value applies at once, so the first layout is the final one.
 */
function useSettled<T>(value: T, delayMs: number): T {
    const [unmeasured] = useState(value)
    const [settled, setSettled] = useState(value)
    if (Object.is(settled, unmeasured) && !Object.is(value, settled))
        setSettled(value)
    useEffect(() => {
        if (Object.is(value, settled)) return
        const id = window.setTimeout(() => setSettled(value), delayMs)
        return () => window.clearTimeout(id)
    }, [value, settled, delayMs])
    return settled
}

/**
 * Centers `focusEntryId` whenever it changes; the first one (a deep link) jumps without animation.
 * A new `entries` array alone never recenters, so it can't undo the user's pan or zoom.
 */
function useCenteredEntry(
    entries: Entry[],
    focusEntryId: string | null,
    zoomToTime: ViewportActions['zoomToTime']
) {
    const focusedOnce = useRef(false)
    const entriesRef = useRef(entries)
    useEffect(() => {
        entriesRef.current = entries
    })
    useEffect(() => {
        if (!focusEntryId) return
        const entry = entriesRef.current.find((e) => e.id === focusEntryId)
        if (!entry) return
        zoomToTime(entryAnchor(entry), FOCUS_VISIBLE_MS, {
            animate: focusedOnce.current,
        })
        focusedOnce.current = true
    }, [focusEntryId, zoomToTime])
    useEffect(() => {
        if (!focusEntryId) focusedOnce.current = true
    }, [focusEntryId])
}

/** `value` as it was when `key` last changed. */
function useSnapshotPerKey<T>(value: T, key: string): T {
    const [snapshot, setSnapshot] = useState({ key, value })
    if (snapshot.key === key) return snapshot.value
    setSnapshot({ key, value })
    return value
}

export const PRIVATE_UNDER_TESTS = { dataBounds, useSnapshotPerKey }
