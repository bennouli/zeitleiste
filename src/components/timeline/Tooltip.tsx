'use client'

import clsx from 'clsx'
import { useLayoutEffect, useRef } from 'react'
import type { ReactNode, RefObject, SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'

export interface TooltipProps {
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

const bubbleClass = 'rounded-md border border-border bg-surface-raised p-3 text-left text-sm text-fg shadow-md'
// The gap is padding, not margin, so the pointer can move from the anchor onto the bubble.
const fadeClass = 'w-72 transition-opacity duration-150 starting:opacity-0 motion-reduce:transition-none'

/**
 * Controlled tooltip bubble. Always rendered so that the `aria-describedby`
 * reference resolves; `hidden` while closed.
 */
export function Tooltip({ id, open, placement, align = 'start', anchorRef, children }: TooltipProps) {
  const portalRef = useRef<HTMLDivElement>(null)

  // Follow the anchor every frame while open: the timeline moves cards with
  // transforms (pan, zoom, stack steps), which fire no scroll or resize event.
  useLayoutEffect(() => {
    if (!open || !anchorRef) return
    let frame = 0
    let last = ''
    let clippers: HTMLElement[] | null = null
    const update = () => {
      const anchor = anchorRef.current
      const el = portalRef.current
      if (anchor && el) {
        const rect = anchor.getBoundingClientRect()
        const vw = document.documentElement.clientWidth
        const maxWidth = Math.max(0, vw - 2 * VIEWPORT_MARGIN_PX)
        el.style.maxWidth = `${maxWidth}px`
        const width = el.offsetWidth
        const preferred = align === 'start' ? rect.left : rect.right - width
        const left = Math.max(VIEWPORT_MARGIN_PX, Math.min(preferred, vw - width - VIEWPORT_MARGIN_PX))
        const top = placement === 'top' ? rect.top - el.offsetHeight : rect.bottom
        // The bubble escapes every clipping ancestor, so hide it with an anchor
        // that left the visible area (stepped out of a stack, panned away).
        clippers ??= clippingAncestors(anchor)
        // A zero-size rect means no layout (jsdom); nothing to judge then.
        const laidOut = rect.width > 0 || rect.height > 0
        const hidden = anchor.closest('[inert]') !== null || (laidOut && !visibleIn(rect, clipRect(clippers)))
        const next = `${left}|${top}|${hidden}`
        if (next !== last) {
          last = next
          el.style.left = `${left}px`
          el.style.top = `${top}px`
          el.style.visibility = hidden ? 'hidden' : ''
        }
      }
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [open, anchorRef, placement, align])

  const bubble = <div className={bubbleClass}>{children}</div>

  if (anchorRef && open && typeof document !== 'undefined') {
    return createPortal(
      <div
        ref={portalRef}
        id={id}
        role="tooltip"
        data-placement={placement}
        data-align={align}
        className={clsx('fixed z-50', fadeClass, placement === 'top' ? 'pb-2' : 'pt-2')}
        // React events bubble out of a portal along the component tree; keep
        // presses and drags on the bubble away from the stack's and timeline's gestures.
        onPointerDown={stop}
        onPointerMove={stop}
        onClick={stop}
      >
        {bubble}
      </div>,
      document.body,
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
        align === 'start' ? 'left-0' : 'right-0',
      )}
    >
      {bubble}
    </div>
  )
}

function stop(e: SyntheticEvent) {
  e.stopPropagation()
}

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** Ancestors of `el` that clip overflow (the layout they belong to doesn't change while a bubble is open). */
function clippingAncestors(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(p)
    if (overflowX !== 'visible' || overflowY !== 'visible') out.push(p)
  }
  return out
}

/** The visible area: the viewport cut by the clipping ancestors. */
function clipRect(clippers: HTMLElement[]): Box {
  const root = document.documentElement
  const box: Box = { left: 0, top: 0, right: root.clientWidth, bottom: root.clientHeight }
  for (const c of clippers) {
    const r = c.getBoundingClientRect()
    box.left = Math.max(box.left, r.left)
    box.top = Math.max(box.top, r.top)
    box.right = Math.min(box.right, r.right)
    box.bottom = Math.min(box.bottom, r.bottom)
  }
  return box
}

function visibleIn(rect: Box, clip: Box): boolean {
  return rect.right > clip.left && rect.left < clip.right && rect.bottom > clip.top && rect.top < clip.bottom
}
