'use client'

import { NO_DRAG_ATTR } from './useGestures'

interface ZoomControlsProps {
  canZoomIn: boolean
  canZoomOut: boolean
  onZoomIn: () => void
  onZoomOut: () => void
}

const buttonClass =
  'flex size-10 items-center justify-center rounded-md border border-border bg-surface-raised text-xl leading-none text-fg shadow-sm cursor-pointer hover:bg-surface aria-disabled:cursor-not-allowed aria-disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-focus'

/** "+" / "−" buttons; the only way to zoom on desktop. aria-disabled (not disabled) keeps keyboard focus at the limits. */
export function ZoomControls({ canZoomIn, canZoomOut, onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div className="absolute top-3 right-3 z-20 flex gap-2" {...{ [NO_DRAG_ATTR]: '' }}>
      <button type="button" className={buttonClass} aria-label="Hineinzoomen" aria-disabled={!canZoomIn} onClick={canZoomIn ? onZoomIn : undefined}>
        <span aria-hidden="true">+</span>
      </button>
      <button type="button" className={buttonClass} aria-label="Herauszoomen" aria-disabled={!canZoomOut} onClick={canZoomOut ? onZoomOut : undefined}>
        <span aria-hidden="true">−</span>
      </button>
    </div>
  )
}
