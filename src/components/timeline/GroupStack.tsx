'use client'

import { isTypingTarget } from '@/lib/dom'
import type { Entry } from '@/lib/entry'
import clsx from 'clsx'
import type {
    DOMAttributes,
    KeyboardEvent,
    MouseEvent,
    PointerEvent,
    ReactNode,
} from 'react'
import { useEffect, useRef, useState } from 'react'

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
    /** Accessible name of the group, e.g. "Gruppe: 1914–1922". */
    label: string
    /** Called when the visible window changes (top index). */
    onIndexChange?: (topIndex: number) => void
    className?: string
}

/** Height of the controls row below the cards (incl. its top margin), when present. */
export const GROUP_STACK_CONTROLS_HEIGHT_PX = 36
/** Minimum vertical travel of a touch swipe that steps the stack. */
const SWIPE_THRESHOLD_PX = 30

const CONTROLS_GAP_PX = 4

/** Total rendered height of a GroupStack, for positioning it like a card. */
export function groupStackHeightPx(
    entryCount: number,
    visibleCount: number,
    slotHeightPx: number
): number {
    if (entryCount <= 0) return 0
    const slotCount = normalizeVisible(visibleCount)
    const controls = entryCount > slotCount ? GROUP_STACK_CONTROLS_HEIGHT_PX : 0
    return Math.min(slotCount, entryCount) * slotHeightPx + controls
}

function normalizeVisible(visibleCount: number): number {
    return Math.max(1, Math.floor(visibleCount))
}

function clamp(i: number, max: number): number {
    return Math.min(Math.max(0, Math.round(i)), max)
}

type StepDirection = 1 | -1

/**
 * A group's entries as a vertical stack of cards, stepped one entry at a time
 * with the arrow buttons, ArrowUp/ArrowDown/Home/End while the group has
 * focus, or a vertical touch swipe. The mouse wheel is deliberately not
 * handled, so the page scrolls over the stack.
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
    label,
    onIndexChange,
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
            (slotIndex < clampedIndex || slotIndex >= clampedIndex + slotCount)
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

    // A button that becomes disabled would drop focus to <body>; keep it on the group.
    const stepFromButton = (direction: StepDirection) => {
        const target = clamp(topIndex + direction, maxIndex)
        go(target)
        if (target === 0 || target === maxIndex) groupRef.current?.focus()
    }

    if (entries.length === 0) return null

    return (
        <div
            ref={groupRef}
            role="group"
            aria-label={label}
            tabIndex={0}
            onKeyDown={onKeyDown}
            className={clsx(
                'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                className
            )}
        >
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
                        const inWindow =
                            i >= topIndex && i < topIndex + slotCount
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
            {entries.length > slotCount && (
                <StackControls
                    topIndex={topIndex}
                    maxIndex={maxIndex}
                    entryCount={entries.length}
                    onStep={stepFromButton}
                />
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

const STEP_BUTTON_CLASS =
    'inline-flex size-8 cursor-pointer items-center justify-center rounded-sm border border-border bg-surface-raised text-fg ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
    'disabled:cursor-default disabled:opacity-40'

type StackControlsProps = {
    topIndex: number
    maxIndex: number
    entryCount: number
    onStep: (direction: StepDirection) => void
}

function StackControls({
    topIndex,
    maxIndex,
    entryCount,
    onStep,
}: StackControlsProps) {
    return (
        <div
            className="flex items-center justify-between gap-2"
            style={{
                height: GROUP_STACK_CONTROLS_HEIGHT_PX - CONTROLS_GAP_PX,
                marginTop: CONTROLS_GAP_PX,
            }}
        >
            <button
                type="button"
                aria-label="Einen Eintrag nach oben"
                disabled={topIndex === 0}
                onClick={() => onStep(-1)}
                className={STEP_BUTTON_CLASS}
            >
                <Chevron up />
            </button>
            <span
                aria-live="polite"
                className="text-sm tabular-nums text-fg-muted"
            >
                {topIndex + 1} von {entryCount}
            </span>
            <button
                type="button"
                aria-label="Einen Eintrag nach unten"
                disabled={topIndex === maxIndex}
                onClick={() => onStep(1)}
                className={STEP_BUTTON_CLASS}
            >
                <Chevron />
            </button>
        </div>
    )
}

function Chevron({ up = false }: { up?: boolean }) {
    return (
        <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={up ? 'rotate-180' : undefined}
        >
            <path d="M4 6l4 4 4-4" />
        </svg>
    )
}

export const PRIVATE_UNDER_TESTS = { stepForKey }
