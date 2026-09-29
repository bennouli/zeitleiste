'use client'

import { useI18n } from '@/components/I18nContext'
import clsx from 'clsx'
import { Minus, Plus } from 'lucide-react'

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

/** Zoom-out and zoom-in buttons. aria-disabled (not disabled) keeps keyboard focus at the limits. */
export function ZoomControls({
    canZoomIn,
    canZoomOut,
    onZoomIn,
    onZoomOut,
}: ZoomControlsProps) {
    const { t } = useI18n()
    return (
        <div
            className="absolute top-4 right-7 z-20 flex gap-3.5"
            {...{ [NO_DRAG_ATTR]: '' }}
        >
            <button
                type="button"
                className={buttonClass}
                aria-label={t.timeline.zoomOut}
                aria-disabled={!canZoomOut}
                onClick={canZoomOut ? onZoomOut : undefined}
            >
                <Minus aria-hidden size={18} strokeWidth={1.5} />
            </button>
            <button
                type="button"
                className={buttonClass}
                aria-label={t.timeline.zoomIn}
                aria-disabled={!canZoomIn}
                onClick={canZoomIn ? onZoomIn : undefined}
            >
                <Plus aria-hidden size={18} strokeWidth={1.5} />
            </button>
        </div>
    )
}
