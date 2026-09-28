'use client'

import { hasNoLayout } from '@/lib/dom'
import clsx from 'clsx'
import type {
    ComponentProps,
    ReactNode,
    RefObject,
    SyntheticEvent,
} from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type TooltipProps = {
    /** Referenced by the anchor's `aria-describedby`. */
    id: string
    open: boolean
    /** Side of the anchor the note appears on while it is anchored. */
    placement: 'top' | 'bottom'
    /**
     * The element the note belongs to. When given, the open note sits beside
     * the cursor while a mouse is over the anchor, beside the anchor otherwise.
     */
    anchorRef?: RefObject<HTMLElement | null>
    /** `TooltipMeta`, `TooltipTitle` and `TooltipBody` lines, in that order. */
    children: ReactNode
}

/** Minimum distance of a portalled note from the viewport's edges. */
const VIEWPORT_MARGIN_PX = 8

/** Distance of an anchored note from its anchor. */
const ANCHOR_GAP_PX = 8

/** Offset of a mouse-following note right of and below the cursor. */
const CURSOR_OFFSET_PX = 14

const noteClass =
    'flex w-80 flex-col gap-1.5 border-l border-fg bg-surface py-2 pr-0 pl-2.5 text-left text-fg'

/**
 * Controlled hover note. Always rendered so that the `aria-describedby`
 * reference resolves; `hidden` while closed.
 */
export function Tooltip({
    id,
    open,
    placement,
    anchorRef,
    children,
}: TooltipProps) {
    const portalRef = useRef<HTMLDivElement>(null)
    const cursorRef = useMouseOverAnchor(anchorRef)

    useFollowAnchor(open, anchorRef, cursorRef, portalRef, placement)

    if (anchorRef && open && typeof document !== 'undefined') {
        return createPortal(
            <div
                ref={portalRef}
                id={id}
                role="tooltip"
                data-placement={placement}
                className={clsx('fixed z-50', noteClass)}
                // React events bubble out of a portal along the component tree; keep
                // presses and drags on the note away from the stack's and timeline's gestures.
                onPointerDown={stop}
                onPointerMove={stop}
                onClick={stop}
            >
                {children}
            </div>,
            portalHost()
        )
    }

    return (
        <div
            id={id}
            role="tooltip"
            hidden={!open}
            data-placement={placement}
            className={clsx(
                'absolute left-0 z-30',
                noteClass,
                placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            )}
        >
            {children}
        </div>
    )
}

type NoteLineProps = Omit<ComponentProps<'p'>, 'className'>

/** First line of a note, in small caps: what, when, where. */
export function TooltipMeta(props: NoteLineProps) {
    return (
        <p
            {...props}
            className="small-caps text-label font-medium tracking-label text-fg"
        />
    )
}

export function TooltipTitle(props: NoteLineProps) {
    return <p {...props} className="font-serif text-note-title" />
}

export function TooltipBody(props: NoteLineProps) {
    return <p {...props} className="font-serif text-note text-fg-soft" />
}

function portalHost(): Element {
    return document.querySelector('main') ?? document.body
}

function stop(e: SyntheticEvent) {
    e.stopPropagation()
}

type Box = {
    left: number
    top: number
    right: number
    bottom: number
}

type Point = { x: number; y: number }

type Size = { width: number; height: number }

type Placement = TooltipProps['placement']

/** Where a mouse over the anchor is, in client coordinates; null while none is. */
function useMouseOverAnchor(
    anchorRef: RefObject<HTMLElement | null> | undefined
): RefObject<Point | null> {
    const cursorRef = useRef<Point | null>(null)
    useEffect(() => {
        const anchor = anchorRef?.current
        if (!anchor) return
        const track = (e: PointerEvent) => {
            if (e.pointerType === 'touch') return
            cursorRef.current = { x: e.clientX, y: e.clientY }
        }
        const forget = () => {
            cursorRef.current = null
        }
        anchor.addEventListener('pointerover', track)
        anchor.addEventListener('pointermove', track)
        anchor.addEventListener('pointerleave', forget)
        return () => {
            anchor.removeEventListener('pointerover', track)
            anchor.removeEventListener('pointermove', track)
            anchor.removeEventListener('pointerleave', forget)
        }
    }, [anchorRef])
    return cursorRef
}

function useFollowAnchor(
    open: boolean,
    anchorRef: RefObject<HTMLElement | null> | undefined,
    cursorRef: RefObject<Point | null>,
    noteRef: RefObject<HTMLDivElement | null>,
    placement: Placement
) {
    useLayoutEffect(() => {
        if (!open || !anchorRef) return
        let frame = 0
        let appliedKey = ''
        let clippers: HTMLElement[] | null = null
        const update = () => {
            const anchor = anchorRef.current
            const noteEl = noteRef.current
            if (anchor && noteEl) {
                const rect = anchor.getBoundingClientRect()
                const root = document.documentElement
                const viewport = {
                    width: root.clientWidth,
                    height: root.clientHeight,
                }
                noteEl.style.maxWidth = `${Math.max(0, viewport.width - 2 * VIEWPORT_MARGIN_PX)}px`
                const noteSize = {
                    width: noteEl.offsetWidth,
                    height: noteEl.offsetHeight,
                }
                const cursor = cursorRef.current
                const { left, top } = cursor
                    ? cursorNotePosition(cursor, noteSize, viewport)
                    : anchoredNotePosition(
                          rect,
                          noteSize,
                          viewport.width,
                          placement
                      )
                clippers ??= clippingAncestors(anchor)
                const isHidden = anchorHidden(anchor, rect, clippers)
                const positionKey = `${left}|${top}|${isHidden}|${cursor !== null}`
                if (positionKey !== appliedKey) {
                    appliedKey = positionKey
                    noteEl.style.left = `${left}px`
                    noteEl.style.top = `${top}px`
                    noteEl.style.visibility = isHidden ? 'hidden' : ''
                    // Clamped at an edge, a following note can slide under the cursor; it must not take the hover.
                    noteEl.style.pointerEvents = cursor ? 'none' : ''
                }
            }
            frame = requestAnimationFrame(update)
        }
        update()
        return () => cancelAnimationFrame(frame)
    }, [open, anchorRef, cursorRef, noteRef, placement])
}

function anchoredNotePosition(
    anchor: Box,
    note: Size,
    viewportWidth: number,
    placement: Placement
): { left: number; top: number } {
    const left = clampToViewport(anchor.left, note.width, viewportWidth)
    const top =
        placement === 'top'
            ? anchor.top - ANCHOR_GAP_PX - note.height
            : anchor.bottom + ANCHOR_GAP_PX
    return { left, top }
}

/** Right of and below the cursor, pushed back inside the viewport at its edges. */
function cursorNotePosition(
    cursor: Point,
    note: Size,
    viewport: Size
): { left: number; top: number } {
    return {
        left: clampToViewport(
            cursor.x + CURSOR_OFFSET_PX,
            note.width,
            viewport.width
        ),
        top: clampToViewport(
            cursor.y + CURSOR_OFFSET_PX,
            note.height,
            viewport.height
        ),
    }
}

/** A start that keeps `length` within the margins of `extent`; the start margin wins when it doesn't fit. */
function clampToViewport(start: number, length: number, extent: number) {
    return Math.max(
        VIEWPORT_MARGIN_PX,
        Math.min(start, extent - length - VIEWPORT_MARGIN_PX)
    )
}

/**
 * The note escapes every clipping ancestor, so hide it with an anchor that
 * left the visible area (stepped out of a stack, panned away).
 */
function anchorHidden(
    anchor: Element,
    rect: DOMRectReadOnly,
    clippers: Element[]
): boolean {
    return (
        anchor.closest('[inert]') !== null ||
        (!hasNoLayout(rect) && !visibleIn(rect, clipRect(clippers)))
    )
}

/** Ancestors of `el` that clip overflow (the layout they belong to doesn't change while a note is open). */
function clippingAncestors(el: HTMLElement): HTMLElement[] {
    const out: HTMLElement[] = []
    for (
        let p = el.parentElement;
        p && p !== document.body && p !== document.documentElement;
        p = p.parentElement
    ) {
        const { overflowX, overflowY } = getComputedStyle(p)
        if (overflowX !== 'visible' || overflowY !== 'visible') out.push(p)
    }
    return out
}

/** The visible area: the viewport cut by the clipping ancestors. */
function clipRect(clippers: Element[]): Box {
    const root = document.documentElement
    const viewport: Box = {
        left: 0,
        top: 0,
        right: root.clientWidth,
        bottom: root.clientHeight,
    }
    return clippers
        .map((c) => c.getBoundingClientRect())
        .reduce(intersect, viewport)
}

function intersect(a: Box, b: Box): Box {
    return {
        left: Math.max(a.left, b.left),
        top: Math.max(a.top, b.top),
        right: Math.min(a.right, b.right),
        bottom: Math.min(a.bottom, b.bottom),
    }
}

function visibleIn(rect: Box, clip: Box): boolean {
    return (
        rect.right > clip.left &&
        rect.left < clip.right &&
        rect.bottom > clip.top &&
        rect.top < clip.bottom
    )
}

export const PRIVATE_UNDER_TESTS = {
    anchoredNotePosition,
    cursorNotePosition,
    anchorHidden,
    CURSOR_OFFSET_PX,
    VIEWPORT_MARGIN_PX,
}
