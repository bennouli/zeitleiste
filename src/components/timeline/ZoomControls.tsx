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
    'flex size-7 cursor-pointer items-center justify-center rounded-full border border-fg bg-transparent font-sans text-[18px] leading-none text-fg',
    'hover:not-aria-disabled:bg-accent hover:not-aria-disabled:text-accent-fg',
    'focus-visible:not-aria-disabled:bg-accent focus-visible:not-aria-disabled:text-accent-fg',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'aria-disabled:cursor-not-allowed aria-disabled:border-fg/30 aria-disabled:text-fg/30'
)

/** "−" / "+" buttons; the only way to zoom on desktop. aria-disabled (not disabled) keeps keyboard focus at the limits. */
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
                <span aria-hidden="true">−</span>
            </button>
            <button
                type="button"
                className={buttonClass}
                aria-label="Hineinzoomen"
                aria-disabled={!canZoomIn}
                onClick={canZoomIn ? onZoomIn : undefined}
            >
                <span aria-hidden="true">+</span>
            </button>
        </div>
    )
}
