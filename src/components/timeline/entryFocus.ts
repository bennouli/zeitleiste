'use client'

import { hasNoLayout, isFocusVisible } from '@/lib/dom'
import type { FocusEvent, RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'

const FOCUSABLE = 'button, [tabindex="0"]'

/** Distance kept between a revealed entry and the timeline's edges. */
const REVEAL_MARGIN_PX = 16
/** An element wider than the view counts as visible once this much of it shows. */
const REVEAL_MIN_VISIBLE_PX = 48

type FocusedItem = {
    el: HTMLElement
    /** Entries the focused element stands for (a card, a stack, a marker). */
    ids: string[]
}

export type EntryFocus = {
    onFocus: (e: FocusEvent<HTMLElement>) => void
}

/**
 * Asks for a pan of `dxPx` when keyboard focus lands on an entry outside the visible width.
 * A relayout can unmount or inert the focused card; focus would drop to <body> and Tab restart
 * at the top, so it moves to the same entry's new element.
 */
export function useEntryFocus(
    sectionRef: RefObject<HTMLElement | null>,
    onRevealNeeded: (dxPx: number) => void,
    width: number
): EntryFocus {
    const focusedRef = useRef<FocusedItem | null>(null)

    const onFocus = (e: FocusEvent<HTMLElement>) => {
        const target = e.target
        if (target === e.currentTarget) return
        focusedRef.current = { el: target, ids: entryIdsOf(target) }
        if (!isFocusVisible(target)) return
        const dx = revealDeltaOf(target, e.currentTarget, width)
        if (dx !== 0) onRevealNeeded(dx)
    }

    useEffect(() => {
        const forgetWhenFocusLeaves = (e: globalThis.FocusEvent) => {
            if (
                !(e.target instanceof Node) ||
                !sectionRef.current?.contains(e.target)
            )
                focusedRef.current = null
        }
        document.addEventListener('focusin', forgetWhenFocusLeaves)
        return () =>
            document.removeEventListener('focusin', forgetWhenFocusLeaves)
    }, [sectionRef])

    useLayoutEffect(() => {
        const focusedItem = focusedRef.current
        const section = sectionRef.current
        if (!focusedItem || !section || isStillFocusable(focusedItem.el)) return
        const { activeElement } = document
        if (
            activeElement &&
            activeElement !== document.body &&
            activeElement.isConnected
        )
            return
        focusedRef.current = null
        const replacement = findFocusTarget(section, focusedItem.ids) ?? section
        replacement.focus({ preventScroll: true })
    })

    return { onFocus }
}

/** The element now representing one of `ids`: its card, else the stack or marker holding it. */
export function findFocusTarget(
    root: HTMLElement,
    ids: string[]
): HTMLElement | null {
    for (const id of ids) {
        const escapedId = CSS.escape(id)
        const entryElement = root.querySelector<HTMLElement>(
            `[data-entry-id="${escapedId}"], [data-span-id="${escapedId}"]`
        )
        if (entryElement) {
            const inertAncestor = entryElement.closest<HTMLElement>('[inert]')
            if (inertAncestor) {
                const stack = inertAncestor.closest<HTMLElement>(
                    '[role="group"][tabindex]'
                )
                if (stack) return stack
            } else {
                const card = entryElement.matches(FOCUSABLE)
                    ? entryElement
                    : entryElement.querySelector<HTMLElement>(FOCUSABLE)
                if (card) return card
            }
        }
        const group = root.querySelector<HTMLElement>(
            `[data-entry-ids~="${escapedId}"]`
        )
        const groupControl = group?.querySelector<HTMLElement>(FOCUSABLE)
        if (groupControl) return groupControl
    }
    return null
}

/** Horizontal pan that brings the label of entry `id` (or the stack or marker holding it) into view; 0 if it is visible. */
export function entryRevealDelta(
    section: HTMLElement,
    id: string,
    width: number
): number {
    const cards = section.querySelector<HTMLElement>('[data-layer="cards"]')
    const target = cards && findFocusTarget(cards, [id])
    return target ? revealDeltaOf(target, section, width) : 0
}

function revealDeltaOf(
    el: HTMLElement,
    container: HTMLElement,
    width: number
): number {
    if (width <= 0) return 0
    const rect = el.getBoundingClientRect()
    if (hasNoLayout(rect)) return 0
    const left = rect.left - container.getBoundingClientRect().left
    return revealDelta(left, left + rect.width, width)
}

/** Ids of the entries `el` stands for: its card's, its span bar's or its group's. */
function entryIdsOf(el: HTMLElement): string[] {
    const holder = el.closest<HTMLElement>(
        '[data-entry-id], [data-entry-ids], [data-span-id]'
    )
    if (!holder) return []
    const { entryId, entryIds, spanId } = holder.dataset
    return entryId
        ? [entryId]
        : spanId
          ? [spanId]
          : (entryIds ?? '').split(' ').filter(Boolean)
}

function isStillFocusable(el: HTMLElement): boolean {
    return el.isConnected && !el.closest('[inert]')
}

/**
 * Horizontal pan (px, positive moves content right) that brings the extent
 * [left, right] (px from the timeline's left edge) into view; 0 if it is visible.
 */
function revealDelta(left: number, right: number, width: number): number {
    const lo = REVEAL_MARGIN_PX
    const hi = width - REVEAL_MARGIN_PX
    const extent = right - left
    if (extent > hi - lo) {
        const visible = Math.min(right, hi) - Math.max(left, lo)
        return visible >= Math.min(REVEAL_MIN_VISIBLE_PX, extent)
            ? 0
            : lo - left
    }
    if (left < lo) return lo - left
    if (right > hi) return hi - right
    return 0
}

export const PRIVATE_UNDER_TESTS = { revealDelta, entryIdsOf, REVEAL_MARGIN_PX }
