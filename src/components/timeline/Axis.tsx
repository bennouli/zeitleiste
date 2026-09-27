'use client'

import { useMemo } from 'react'
import clsx from 'clsx'
import { ticks } from '@/lib/ticks'
import { useTimeline } from './TimelineContext'

/** y of the axis line inside the axis band, in px. */
export const AXIS_LINE_Y_PX = 24
const TODAY_LABEL_HALF_WIDTH_PX = 24

/** Axis line, adaptive ticks with labels and the "Heute" mark. */
export function Axis() {
  const { viewport, width, today, timeToX } = useTimeline()
  const result = useMemo(() => ticks(viewport.start, viewport.end, width), [viewport.start, viewport.end, width])
  const todayX = timeToX(today)
  const todayVisible = todayX >= -1 && todayX <= width + 1
  const todayAlign =
    todayX > width - TODAY_LABEL_HALF_WIDTH_PX ? 'right' : todayX < TODAY_LABEL_HALF_WIDTH_PX ? 'left' : 'center'

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-tick-unit={result.unit}>
      <div className="absolute inset-x-0 h-px bg-fg-muted" style={{ top: AXIS_LINE_Y_PX }} />
      {result.ticks.map((tick) => (
        <div
          key={tick.t}
          data-tick={tick.major ? 'major' : 'minor'}
          className="absolute top-0"
          style={{ left: timeToX(tick.t) }}
        >
          <div
            className={clsx('absolute w-px', tick.major ? 'h-3 bg-fg' : 'h-2 bg-fg-muted')}
            style={{ top: AXIS_LINE_Y_PX }}
          />
          <span
            className={clsx(
              'absolute -translate-x-1/2 whitespace-nowrap text-xs',
              tick.major ? 'font-semibold text-fg' : 'text-fg-muted',
            )}
            style={{ top: AXIS_LINE_Y_PX + 14 }}
          >
            {tick.label}
          </span>
        </div>
      ))}
      {todayVisible && (
        <div data-today className="absolute top-0" style={{ left: Math.min(todayX, width - 1) }}>
          <div className="absolute top-4 h-4 w-0.5 -translate-x-1/2 bg-accent" />
          <span
            className={clsx(
              'absolute top-0 whitespace-nowrap text-xs font-semibold text-fg',
              todayAlign === 'right' && '-translate-x-full pr-1.5',
              todayAlign === 'center' && '-translate-x-1/2',
              todayAlign === 'left' && 'pl-1.5',
            )}
          >
            Heute
          </span>
        </div>
      )}
    </div>
  )
}
