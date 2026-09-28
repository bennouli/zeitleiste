'use client'

import { hasNoLayout } from '@/lib/dom'
import clsx from 'clsx'
import type { ReactNode, RefObject, SyntheticEvent } from 'react'
import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type TooltipProps = {
    /** Referenced by the anchor's `aria-describedby`. */
    id: string
    open: boolean
    /** Side of the anchor the bubble appears on. */
    placement: 'top' | 'bottom'
    /** Horizontal alignment with the anchor: flush with its left ('start') or right ('end') edge. */
    align?: 'start' | 'end'
    /**
     * The element the bubble belongs to. When given, the open bubble renders in
     * a portal on `document.body` with fixed coordinates taken from the anchor,
     * so no `overflow` ancestor clips it. Without it the bubble is positioned by
     * CSS relative to the nearest positioned ancestor.
     */
    anchorRef?: RefObject<HTMLElement | null>
    children: ReactNode
}

/** Minimum distance of a portalled bubble from the viewport's left and right edges. */
const VIEWPORT_MARGIN_PX = 8

const bubbleClass =
    'rounded-md border border-border bg-surface-raised p-3 text-left text-sm text-fg shadow-md'
// The gap is padding, not margin, so the pointer can move from the anchor onto the bubble.
const fadeClass =
    'w-72 transition-opacity duration-150 starting:opacity-0 motion-reduce:transition-none'

/**
 * Controlled tooltip bubble. Always rendered so that the `aria-describedby`
 * reference resolves; `hidden` while closed.
 */
export function Tooltip({
    id,
    open,
    placement,
    align = 'start',
    anchorRef,
    children,
}: TooltipProps) {
    const portalRef = useRef<HTMLDivElement>(null)

    useFollowAnchor(open, anchorRef, portalRef, placement, align)

    const bubble = <div className={bubbleClass}>{children}</div>

    if (anchorRef && open && typeof document !== 'undefined') {
        return createPortal(
            <div
                ref={portalRef}
                id={id}
                role="tooltip"
                data-placement={placement}
                data-align={align}
                className={clsx(
                    'fixed z-50',
                    fadeClass,
                    placement === 'top' ? 'pb-2' : 'pt-2'
                )}
                // React events bubble out of a portal along the component tree; keep
                // presses and drags on the bubble away from the stack's and timeline's gestures.
                onPointerDown={stop}
                onPointerMove={stop}
                onClick={stop}
            >
                {bubble}
            </div>,
            document.body
        )
    }

    return (
        <div
            id={id}
            role="tooltip"
            hidden={!open}
            data-placement={placement}
            data-align={align}
            className={clsx(
                'absolute z-30',
                fadeClass,
                placement === 'top' ? 'bottom-full pb-2' : 'top-full pt-2',
                align === 'start' ? 'left-0' : 'right-0'
            )}
        >
            {bubble}
        </div>
    )
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

type Placement = TooltipProps['placement']
type Align = NonNullable<TooltipProps['align']>

function useFollowAnchor(
    open: boolean,
    anchorRef: RefObject<HTMLElement | null> | undefined,
    bubbleRef: RefObject<HTMLDivElement | null>,
    placement: Placement,
    align: Align
) {
    useLayoutEffect(() => {
        if (!open || !anchorRef) return
        let frame = 0
        let appliedKey = ''
        let clippers: HTMLElement[] | null = null
        const update = () => {
            const anchor = anchorRef.current
            const bubbleEl = bubbleRef.current
            if (anchor && bubbleEl) {
                const rect = anchor.getBoundingClientRect()
                const viewportWidth = document.documentElement.clientWidth
                const maxWidth = Math.max(
                    0,
                    viewportWidth - 2 * VIEWPORT_MARGIN_PX
                )
                bubbleEl.style.maxWidth = `${maxWidth}px`
                const bubbleSize = {
                    width: bubbleEl.offsetWidth,
                    height: bubbleEl.offsetHeight,
                }
                const { left, top } = bubblePosition(
                    rect,
                    bubbleSize,
                    viewportWidth,
                    placement,
                    align
                )
                clippers ??= clippingAncestors(anchor)
                const isHidden = anchorHidden(anchor, rect, clippers)
                const positionKey = `${left}|${top}|${isHidden}`
                if (positionKey !== appliedKey) {
                    appliedKey = positionKey
                    bubbleEl.style.left = `${left}px`
                    bubbleEl.style.top = `${top}px`
                    bubbleEl.style.visibility = isHidden ? 'hidden' : ''
                }
            }
            frame = requestAnimationFrame(update)
        }
        update()
        return () => cancelAnimationFrame(frame)
    }, [open, anchorRef, bubbleRef, placement, align])
}

function bubblePosition(
    anchor: Box,
    bubble: { width: number; height: number },
    viewportWidth: number,
    placement: Placement,
    align: Align
): { left: number; top: number } {
    const preferredLeft =
        align === 'start' ? anchor.left : anchor.right - bubble.width
    const left = Math.max(
        VIEWPORT_MARGIN_PX,
        Math.min(
            preferredLeft,
            viewportWidth - bubble.width - VIEWPORT_MARGIN_PX
        )
    )
    const top = placement === 'top' ? anchor.top - bubble.height : anchor.bottom
    return { left, top }
}

/**
 * The bubble escapes every clipping ancestor, so hide it with an anchor that
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

/** Ancestors of `el` that clip overflow (the layout they belong to doesn't change while a bubble is open). */
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

export const PRIVATE_UNDER_TESTS = { bubblePosition, anchorHidden }
