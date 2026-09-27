'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'

export interface TooltipProps {
  /** Referenced by the anchor's `aria-describedby`. */
  id: string
  open: boolean
  /** Side of the anchor the bubble appears on. */
  placement: 'top' | 'bottom'
  /** Horizontal alignment with the anchor: flush with its left ('start') or right ('end') edge. */
  align?: 'start' | 'end'
  children: ReactNode
}

/**
 * Controlled tooltip bubble, positioned by CSS relative to the nearest
 * positioned ancestor (the anchor's wrapper). Always rendered so that the
 * `aria-describedby` reference resolves; `hidden` while closed.
 */
export function Tooltip({ id, open, placement, align = 'start', children }: TooltipProps) {
  return (
    <div
      id={id}
      role="tooltip"
      hidden={!open}
      className={clsx(
        // The gap is padding, not margin, so the pointer can move from the anchor onto the bubble.
        'absolute z-30 w-72 transition-opacity duration-150 starting:opacity-0 motion-reduce:transition-none',
        placement === 'top' ? 'bottom-full pb-2' : 'top-full pt-2',
        align === 'start' ? 'left-0' : 'right-0',
      )}
    >
      <div className="rounded-md border border-border bg-surface-raised p-3 text-left text-sm text-fg shadow-md">
        {children}
      </div>
    </div>
  )
}
