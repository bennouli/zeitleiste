'use client'

import { useI18n } from '@/components/I18nContext'
import { isSpan, type Entry } from '@/lib/entry'
import { entryAnchor, MS_PER_YEAR, startOf, todayMs } from '@/lib/time'
import { msPerPx, timeToX, type Bounds } from '@/lib/viewport'
import clsx from 'clsx'
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import { Axis } from './Axis'
import { bandGeometry, SLOT_HEIGHT_PX, type BandGeometry } from './bandGeometry'
import { CardLayer } from './CardLayer'
import {
    AXIS_HEIGHT_PX,
    CARD_GAP_PX,
    CARD_ROW_HEIGHT_PX,
    COLLAPSE_ANIMATION_MS,
    COLLAPSED_HEIGHT,
    FOCUS_VISIBLE_MS,
    TOP_BAR_HEIGHT_PX,
} from './constants'
import { useEntryFocus } from './entryFocus'
import { groupZoomTarget } from './groupZoom'
import { LABEL_MAX_WIDTH_PX } from './labelMetrics'
import { spanLayout } from './spanGeometry'
import { SpanLayer } from './SpanLayer'
import { TimelineContext, type TimelineContextValue } from './TimelineContext'
import { useBarHighlight } from './useBarHighlight'
import { useEntryLayout } from './useEntryLayout'
import { useGestures } from './useGestures'
import { useSettled } from './useSettled'
import { useViewport, type ViewportActions } from './useViewport'
import { Wordmark } from './Wordmark'
import { ZoomControls } from './ZoomControls'

export type TimelineProps = {
    entries: Entry[]
    /** Collapsed to about half height while a post is open. */
    collapsed: boolean
    /** Entry to center and highlight, e.g. the open post's entry. */
    focusEntryId: string | null
    onOpenEntry: (id: string) => void
    /** Controls set in the top bar after the wordmark, such as the language switch. */
    besideWordmark?: ReactNode
}

const HEIGHT_SETTLE_MS = COLLAPSE_ANIMATION_MS + 50
const FALLBACK_HISTORY_MS = 100 * MS_PER_YEAR

export function Timeline({
    entries,
    collapsed,
    focusEntryId,
    onOpenEntry,
    besideWordmark,
}: TimelineProps) {
    const [today] = useState(todayMs)
    const { locale, t } = useI18n()
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
    const { highlightEntry, ...barHighlight } = useBarHighlight({
        sectionRef: elRef,
        width,
        wasDrag: gestures.wasDrag,
        onRevealNeeded: actions.panStep,
    })

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
        () => bandGeometry(height, width, collapsed, TOP_BAR_HEIGHT_PX),
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
            locale,
        },
        `${layoutKey}|${bandsKey(bands)}|${locale}`
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
                aria-label={t.timeline.regionLabel}
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
                    {t.timeline.help}
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
                                barHighlight={barHighlight}
                                onOpen={open}
                                onZoomIntoGroup={zoomIntoGroup}
                            />
                            <SpanLayer
                                spans={spans}
                                timeToX={toX}
                                today={today}
                                lanes={spanLanes}
                                onBarClick={highlightEntry}
                            />
                        </div>
                        <div data-layer="below" className="min-h-0 flex-1" />
                    </>
                )}
                <div
                    data-top-bar
                    className="pointer-events-none absolute inset-x-0 top-0 z-20"
                    style={{ height: TOP_BAR_HEIGHT_PX }}
                >
                    <div className="absolute top-5.5 left-8 flex items-baseline gap-4">
                        <Wordmark />
                        {besideWordmark}
                    </div>
                    <ZoomControls
                        canZoomIn={controls.canZoomIn}
                        canZoomOut={controls.canZoomOut}
                        onZoomIn={actions.zoomIn}
                        onZoomOut={actions.zoomOut}
                    />
                </div>
            </section>
        </TimelineContext>
    )
}

/** Changes whenever a row count or a stack's extent on either side changes. */
function bandsKey({ maxLevels, groupLevels }: BandGeometry): string {
    return [maxLevels, groupLevels]
        .map((levels) => `${levels.above}/${levels.below}`)
        .join('|')
}

/**
 * Earliest entry start … today, plus room for one card anchored on either end;
 * a century back when no entry lies in the past.
 */
function dataBounds(entries: Entry[], today: number, width: number): Bounds {
    const earliest = Math.min(...entries.map((e) => startOf(e.start)))
    const min =
        Number.isFinite(earliest) && earliest < today
            ? earliest
            : today - FALLBACK_HISTORY_MS
    const room = width > 0 ? (LABEL_MAX_WIDTH_PX + CARD_GAP_PX) / width : 0
    return { min, max: today, startRoom: room, endRoom: room }
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
