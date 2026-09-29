'use client'

import { isTypingTarget } from '@/lib/dom'
import type { Entry } from '@/lib/entry'
import { formatPosition } from '@/lib/format'
import type { Side } from '@/lib/placement'
import clsx from 'clsx'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type {
    DOMAttributes,
    KeyboardEvent,
    MouseEvent,
    PointerEvent,
    ReactNode,
} from 'react'
import { useEffect, useRef, useState } from 'react'

/**
 * A member to bring into view: the window moves the least that shows `index`, and not at all
 * when it already does. A new `key` reveals again, even for the same index.
 */
export type StackReveal = { index: number; key: number }

export type GroupStackProps = {
    /** Chronological (the caller sorts; not checked here). */
    entries: Entry[]
    /** Number of cards visible at once: 3 desktop, 1 phone, ≤ 2 when collapsed. */
    visibleCount: number
    /** Height of one card slot in px, from the card component (the caller passes the label height + gap). */
    slotHeightPx: number
    /** Renders one card (the caller passes EntryCard with `inline`). */
    renderCard: (entry: Entry, index: number) => ReactNode
    /**
     * Scrolled-to index (e.g. to show the highlighted entry); default 0. A later
     * change scrolls to the new index; a change to `undefined` keeps the window.
     */
    initialIndex?: number
    /** Member to reveal, e.g. the entry whose span bar was clicked. */
    reveal?: StackReveal
    /** Accessible name of the group, e.g. "Gruppe: 1914–1922". */
    label: string
    /** Called when the visible window changes (top index). */
    onIndexChange?: (topIndex: number) => void
    /** The stack's edge that sits on the anchor; the indicator strip goes on the other side of it. Default `'start'`. */
    anchoredAt?: 'start' | 'end'
    /** The side of the axis the stack hangs on; the indicator strip lines up with the stack's axis-side edge. Default `'below'`. */
    side?: Side
    className?: string
}

/** Height of the position line below the cards, when present; the last slot's gap sits above it. */
export const GROUP_STACK_CONTROLS_HEIGHT_PX = 12
/** Minimum vertical travel of a touch swipe that steps the stack. */
const SWIPE_THRESHOLD_PX = 30

const STRIP_BUTTON_PX = 14
const STRIP_ICON_PX = 12
const STRIP_DOT_PX = 5
const STRIP_GAP_PX = 3
/** Minimum distance between the arrows' centres, the 24 px target spacing of WCAG 2.5.8. */
const STRIP_MIN_BUTTON_SPACING_PX = 24
/** Distance between the indicator strip and the cards. */
const STRIP_OFFSET_PX = 8
/** Larger groups get the arrows without dots. */
const MAX_DOT_COUNT = 6

/** Total rendered height of a GroupStack (the taller of its card column and its indicator strip), for positioning it like a card. */
export function groupStackHeightPx(
    entryCount: number,
    visibleCount: number,
    slotHeightPx: number
): number {
    if (entryCount <= 0) return 0
    const slotCount = normalizeVisible(visibleCount)
    const steppable = entryCount > slotCount
    const controls = steppable ? GROUP_STACK_CONTROLS_HEIGHT_PX : 0
    const column = Math.min(slotCount, entryCount) * slotHeightPx + controls
    return Math.max(column, stripHeightPx(entryCount, steppable))
}

function stripHeightPx(entryCount: number, steppable: boolean): number {
    const buttonCount = steppable ? 2 : 0
    const dotCount = hasDots(entryCount) ? entryCount : 0
    const itemCount = buttonCount + dotCount
    if (itemCount === 0) return 0
    const stackedHeight =
        buttonCount * STRIP_BUTTON_PX +
        dotCount * STRIP_DOT_PX +
        (itemCount - 1) * STRIP_GAP_PX
    const spacedButtonsHeight = steppable
        ? STRIP_BUTTON_PX + STRIP_MIN_BUTTON_SPACING_PX
        : 0
    return Math.max(stackedHeight, spacedButtonsHeight)
}

function hasDots(entryCount: number): boolean {
    return entryCount <= MAX_DOT_COUNT
}

function normalizeVisible(visibleCount: number): number {
    return Math.max(1, Math.floor(visibleCount))
}

function clamp(i: number, max: number): number {
    return Math.min(Math.max(0, Math.round(i)), max)
}

/** The top index nearest `topIndex` whose window shows `index`. */
function topIndexShowing(
    index: number,
    topIndex: number,
    slotCount: number,
    maxIndex: number
): number {
    if (index < topIndex) return clamp(index, maxIndex)
    if (index >= topIndex + slotCount)
        return clamp(index - slotCount + 1, maxIndex)
    return topIndex
}

function isInWindow(i: number, topIndex: number, slotCount: number): boolean {
    return i >= topIndex && i < topIndex + slotCount
}

type StepDirection = 1 | -1

/**
 * A group's entries as a vertical stack of cards, stepped one entry at a time
 * with the arrow buttons, ArrowUp/ArrowDown/Home/End while the group has
 * focus, or a vertical touch swipe. Beside it an indicator strip shows the
 * arrows and one dot per entry, filled for the entries in view; below it a
 * position line. The mouse wheel is deliberately not handled, so it zooms the
 * timeline over the stack as anywhere else.
 *
 * Trade-off: the viewport sets `touch-action: pan-x` so vertical touch moves
 * reach the swipe handler; a vertical swipe over a stack therefore steps the
 * stack instead of scrolling the page. Horizontal swipes still pan.
 *
 * The window position is kept across `entries` changes (only clamped); key
 * the stack by group so a different group starts fresh. Renders nothing for
 * an empty group.
 */
export function GroupStack({
    entries,
    visibleCount,
    slotHeightPx,
    renderCard,
    initialIndex,
    reveal,
    label,
    onIndexChange,
    anchoredAt = 'start',
    side = 'below',
    className,
}: GroupStackProps) {
    const slotCount = normalizeVisible(visibleCount)
    const maxIndex = Math.max(0, entries.length - slotCount)
    const [rawIndex, setRawIndex] = useState(() =>
        clamp(initialIndex ?? 0, maxIndex)
    )
    const [followedInitialIndex, setFollowedInitialIndex] =
        useState(initialIndex)
    if (followedInitialIndex !== initialIndex) {
        setFollowedInitialIndex(initialIndex)
        if (initialIndex !== undefined)
            setRawIndex(clamp(initialIndex, maxIndex))
    }
    const [followedRevealKey, setFollowedRevealKey] = useState<number>()
    if (reveal && reveal.key !== followedRevealKey) {
        setFollowedRevealKey(reveal.key)
        setRawIndex(
            topIndexShowing(
                reveal.index,
                clamp(rawIndex, maxIndex),
                slotCount,
                maxIndex
            )
        )
    }
    const topIndex = clamp(rawIndex, maxIndex)
    const groupRef = useRef<HTMLDivElement>(null)
    useReportedIndex(topIndex, onIndexChange)

    const go = (targetIndex: number) => {
        const clampedIndex = clamp(targetIndex, maxIndex)
        if (clampedIndex === topIndex) return
        setRawIndex(clampedIndex)
        // Focus inside a card that leaves the window would fall to <body> (the
        // slot becomes inert); keep it on the group.
        const group = groupRef.current
        if (!group) return
        const slotIndex = focusedSlotIndex(group)
        if (
            slotIndex !== null &&
            !isInWindow(slotIndex, clampedIndex, slotCount)
        )
            group.focus()
    }

    const swipeHandlers = useSwipeStep((direction) => go(topIndex + direction))

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
        if (isTypingTarget(e.target)) return
        const targetIndex = stepForKey(e.key, topIndex, maxIndex)
        if (targetIndex === null || maxIndex === 0) return
        e.preventDefault()
        go(targetIndex)
    }

    if (entries.length === 0) return null

    const steppable = entries.length > slotCount

    return (
        <div
            ref={groupRef}
            role="group"
            aria-label={label}
            tabIndex={0}
            onKeyDown={onKeyDown}
            className={clsx(
                'relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                className
            )}
        >
            <IndicatorStrip
                entryCount={entries.length}
                topIndex={topIndex}
                slotCount={slotCount}
                maxIndex={maxIndex}
                steppable={steppable}
                anchoredAt={anchoredAt}
                side={side}
                onStep={(direction) => go(topIndex + direction)}
            />
            <div
                className="overflow-hidden"
                style={{
                    height: Math.min(slotCount, entries.length) * slotHeightPx,
                    touchAction: 'pan-x',
                }}
                {...swipeHandlers}
            >
                <ul
                    role="list"
                    className="m-0 list-none p-0 transition-transform duration-250 ease-out motion-reduce:transition-none"
                    style={{
                        transform: `translateY(${-topIndex * slotHeightPx}px)`,
                    }}
                >
                    {entries.map((entry, i) => {
                        const inWindow = isInWindow(i, topIndex, slotCount)
                        return (
                            <li
                                key={entry.id}
                                role="listitem"
                                data-index={i}
                                style={{ height: slotHeightPx }}
                                aria-hidden={inWindow ? undefined : true}
                                inert={!inWindow}
                            >
                                {renderCard(entry, i)}
                            </li>
                        )
                    })}
                </ul>
            </div>
            {steppable && (
                <p
                    aria-live="polite"
                    className={clsx(
                        'm-0 small-caps text-label leading-3 tracking-label tabular-nums text-fg-muted',
                        anchoredAt === 'end' && 'text-right'
                    )}
                    style={{ height: GROUP_STACK_CONTROLS_HEIGHT_PX }}
                >
                    {formatPosition(topIndex, entries.length)}
                </p>
            )}
        </div>
    )
}

/** Reports every change of the top index (user steps, initialIndex changes, re-clamping), never the initial one. */
function useReportedIndex(
    topIndex: number,
    onIndexChange: ((topIndex: number) => void) | undefined
): void {
    const onIndexChangeRef = useRef(onIndexChange)
    const reportedIndex = useRef(topIndex)
    useEffect(() => {
        onIndexChangeRef.current = onIndexChange
    })
    useEffect(() => {
        if (reportedIndex.current === topIndex) return
        reportedIndex.current = topIndex
        onIndexChangeRef.current?.(topIndex)
    }, [topIndex])
}

function focusedSlotIndex(group: HTMLElement): number | null {
    const active = document.activeElement
    if (!active || active === group || !group.contains(active)) return null
    const slot = active.closest('li')
    const index = slot ? Number(slot.dataset.index) : NaN
    return Number.isNaN(index) ? null : index
}

type SwipeStart = {
    pointerId: number
    x: number
    y: number
    stepped: boolean
}

type SwipeHandlers = Required<
    Pick<
        DOMAttributes<HTMLDivElement>,
        | 'onPointerDown'
        | 'onPointerMove'
        | 'onPointerUp'
        | 'onPointerCancel'
        | 'onLostPointerCapture'
        | 'onClickCapture'
    >
>

function useSwipeStep(
    onStep: (direction: StepDirection) => void
): SwipeHandlers {
    const swipeRef = useRef<SwipeStart | null>(null)
    const swallowNextClick = useRef(false)
    const allowNextClick = () => {
        swallowNextClick.current = false
    }

    // No capture and no stopPropagation here: a tap must still click the card
    // under the finger, and horizontal moves must reach the timeline's drag.
    const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
        allowNextClick()
        if (e.pointerType !== 'touch' || !e.isPrimary) return
        swipeRef.current = {
            pointerId: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            stepped: false,
        }
    }
    const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
        const swipe = swipeRef.current
        if (!swipe || swipe.stepped || e.pointerId !== swipe.pointerId) return
        const dx = e.clientX - swipe.x
        const dy = e.clientY - swipe.y
        if (Math.abs(dy) < SWIPE_THRESHOLD_PX || Math.abs(dy) <= Math.abs(dx))
            return
        swipe.stepped = true
        swallowNextClick.current = true
        // Only now capture on the viewport: the touched card's slot is about to turn inert.
        try {
            e.currentTarget.setPointerCapture?.(e.pointerId)
        } catch {
            // Pointer already released; the step still applies.
        }
        const swipedUp = dy < 0
        onStep(swipedUp ? 1 : -1)
    }
    const endSwipe = (e: PointerEvent<HTMLDivElement>) => {
        const swipe = swipeRef.current
        if (swipe?.pointerId !== e.pointerId) return
        swipeRef.current = null
        if (swipe.stepped) setTimeout(allowNextClick, 0)
    }
    const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
        const isKeyboardActivation = e.detail === 0
        if (!swallowNextClick.current || isKeyboardActivation) return
        allowNextClick()
        e.preventDefault()
        e.stopPropagation()
    }

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp: endSwipe,
        onPointerCancel: endSwipe,
        onLostPointerCapture: endSwipe,
        onClickCapture,
    }
}

function stepForKey(
    key: string,
    topIndex: number,
    maxIndex: number
): number | null {
    switch (key) {
        case 'ArrowUp':
            return topIndex - 1
        case 'ArrowDown':
            return topIndex + 1
        case 'Home':
            return 0
        case 'End':
            return maxIndex
        default:
            return null
    }
}

const STEP_BUTTON_CLASS = clsx(
    'flex shrink-0 cursor-pointer items-center justify-center text-fg',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'aria-disabled:cursor-default aria-disabled:text-fg/30'
)

type IndicatorStripProps = {
    entryCount: number
    topIndex: number
    slotCount: number
    maxIndex: number
    steppable: boolean
    anchoredAt: 'start' | 'end'
    side: Side
    onStep: (direction: StepDirection) => void
}

/** Arrows and one dot per entry beside the cards; the dots of the entries in view are filled. */
function IndicatorStrip({
    entryCount,
    topIndex,
    slotCount,
    maxIndex,
    steppable,
    anchoredAt,
    side,
    onStep,
}: IndicatorStripProps) {
    const dots = hasDots(entryCount) ? (
        <span
            aria-hidden="true"
            className="flex flex-col items-center"
            style={{ gap: STRIP_GAP_PX }}
        >
            {Array.from({ length: entryCount }, (_, i) => {
                const inView = isInWindow(i, topIndex, slotCount)
                return (
                    <span
                        key={i}
                        data-stack-dot
                        data-in-view={inView ? 'true' : undefined}
                        className={clsx(
                            'block rounded-full border border-fg',
                            inView && 'bg-fg'
                        )}
                        style={{ width: STRIP_DOT_PX, height: STRIP_DOT_PX }}
                    />
                )
            })}
        </span>
    ) : null
    if (!steppable && !dots) return null

    return (
        <div
            className={clsx(
                'absolute flex flex-col items-center justify-between',
                anchoredAt === 'end' ? 'left-full' : 'right-full',
                side === 'above' ? 'bottom-0' : 'top-0'
            )}
            style={{
                gap: STRIP_GAP_PX,
                width: STRIP_BUTTON_PX,
                height: stripHeightPx(entryCount, steppable),
                [anchoredAt === 'end' ? 'marginLeft' : 'marginRight']:
                    STRIP_OFFSET_PX,
            }}
        >
            {steppable && (
                <StepButton
                    direction={-1}
                    canStep={topIndex > 0}
                    onStep={onStep}
                />
            )}
            {dots}
            {steppable && (
                <StepButton
                    direction={1}
                    canStep={topIndex < maxIndex}
                    onStep={onStep}
                />
            )}
        </div>
    )
}

type StepButtonProps = {
    direction: StepDirection
    canStep: boolean
    onStep: (direction: StepDirection) => void
}

function StepButton({ direction, canStep, onStep }: StepButtonProps) {
    const Icon = direction === -1 ? ArrowUp : ArrowDown
    return (
        <button
            type="button"
            aria-label={
                direction === -1
                    ? 'Einen Eintrag nach oben'
                    : 'Einen Eintrag nach unten'
            }
            aria-disabled={!canStep}
            onClick={canStep ? () => onStep(direction) : undefined}
            className={STEP_BUTTON_CLASS}
            style={{ width: STRIP_BUTTON_PX, height: STRIP_BUTTON_PX }}
        >
            <Icon aria-hidden size={STRIP_ICON_PX} strokeWidth={1.5} />
        </button>
    )
}

export const PRIVATE_UNDER_TESTS = {
    stepForKey,
    topIndexShowing,
    STRIP_BUTTON_PX,
    STRIP_DOT_PX,
    STRIP_GAP_PX,
    STRIP_MIN_BUTTON_SPACING_PX,
}
