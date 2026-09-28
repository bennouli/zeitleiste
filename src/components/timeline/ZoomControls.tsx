'use client'

import clsx from 'clsx'

import { NO_DRAG_ATTR } from './useGestures'

type ZoomControlsProps = {
    canZoomIn: boolean
    canZoomOut: boolean
    onZoomIn: () => void
    onZoomOut: () => void
}

const buttonClass = clsx(
    'flex size-7 cursor-pointer items-center justify-center rounded-full border border-fg bg-transparent text-fg',
    'hover:not-aria-disabled:bg-accent hover:not-aria-disabled:text-accent-fg',
    'focus-visible:not-aria-disabled:bg-accent focus-visible:not-aria-disabled:text-accent-fg',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'aria-disabled:cursor-not-allowed aria-disabled:border-fg/30 aria-disabled:text-fg/30'
)

/** Zoom-out and zoom-in buttons; the only way to zoom on desktop. aria-disabled (not disabled) keeps keyboard focus at the limits. */
export function ZoomControls({
    canZoomIn,
    canZoomOut,
    onZoomIn,
    onZoomOut,
}: ZoomControlsProps) {
    return (
        <div
            className="absolute top-4 right-7 z-20 flex gap-3.5"
            {...{ [NO_DRAG_ATTR]: '' }}
        >
            <button
                type="button"
                className={buttonClass}
                aria-label="Herauszoomen"
                aria-disabled={!canZoomOut}
                onClick={canZoomOut ? onZoomOut : undefined}
            >
                <ZoomIcon />
            </button>
            <button
                type="button"
                className={buttonClass}
                aria-label="Hineinzoomen"
                aria-disabled={!canZoomIn}
                onClick={canZoomIn ? onZoomIn : undefined}
            >
                <ZoomIcon plus />
            </button>
        </div>
    )
}

function ZoomIcon({ plus = false }: { plus?: boolean }) {
    return (
        <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
        >
            <path d={plus ? 'M4 9h10M9 4v10' : 'M4 9h10'} />
        </svg>
    )
}
