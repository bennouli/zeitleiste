'use client'

import { ticks, type Tick } from '@/lib/ticks'
import clsx from 'clsx'
import { useMemo } from 'react'
import { useTimeline } from './TimelineContext'
import { overlapsTodayLabel, todayAlignment } from './todayLabel'

/** y of the axis line inside the axis band, in px. */
export const AXIS_LINE_Y_PX = 24
export const AXIS_LINE_THICKNESS_PX = 1
const LABEL_TOP_PX = AXIS_LINE_Y_PX + 14
const TODAY_MARK_HEIGHT_PX = 16
const TICK_OPTIONS = { minYearWidthForMonthsPx: 420, charWidthPx: 7.5 }

/** Hairline axis across the full width, short ticks with small-caps labels, and the "Heute" mark. */
export function Axis() {
    const { viewport, width, today, timeToX } = useTimeline()
    const result = useMemo(
        () => ticks(viewport.start, viewport.end, width, TICK_OPTIONS),
        [viewport.start, viewport.end, width]
    )
    const todayX = timeToX(today)
    const todayVisible = todayX >= -1 && todayX <= width + 1
    const todayAlign = todayAlignment(todayX, width)
    const labelHidden = (tick: Tick) =>
        todayVisible &&
        overlapsTodayLabel(
            timeToX(tick.t),
            tick.label.length * TICK_OPTIONS.charWidthPx,
            todayX,
            todayAlign
        )

    return (
        <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            data-tick-unit={result.unit}
        >
            <div
                data-axis-line
                className="absolute left-0 bg-fg"
                style={{
                    top: AXIS_LINE_Y_PX,
                    width,
                    height: AXIS_LINE_THICKNESS_PX,
                }}
            />
            {result.ticks.map((tick) => (
                <div
                    key={tick.t}
                    data-tick={tick.major ? 'major' : 'minor'}
                    data-t={tick.t}
                    className="absolute top-0"
                    style={{ left: timeToX(tick.t) }}
                >
                    <div
                        className={clsx(
                            'absolute w-px bg-fg',
                            tick.major ? 'h-2' : 'h-1'
                        )}
                        style={{ top: AXIS_LINE_Y_PX }}
                    />
                    {!labelHidden(tick) && (
                        <span
                            className={clsx(
                                'absolute -translate-x-1/2 small-caps text-label leading-none tracking-label whitespace-nowrap',
                                tick.major
                                    ? 'font-medium text-fg'
                                    : 'font-normal text-fg-muted'
                            )}
                            style={{ top: LABEL_TOP_PX }}
                        >
                            {tick.label}
                        </span>
                    )}
                </div>
            ))}
            {todayVisible && (
                <div
                    data-today
                    className="absolute top-0"
                    style={{ left: Math.min(todayX, width - 1) }}
                >
                    <div
                        className="absolute w-px bg-fg"
                        style={{
                            top: AXIS_LINE_Y_PX - TODAY_MARK_HEIGHT_PX / 2,
                            height: TODAY_MARK_HEIGHT_PX,
                        }}
                    />
                    <span
                        data-today-align={todayAlign}
                        className={clsx(
                            'absolute small-caps text-label leading-none font-medium tracking-label whitespace-nowrap text-fg',
                            todayAlign === 'right' &&
                                '-translate-x-full pr-1.5',
                            todayAlign === 'center' && '-translate-x-1/2',
                            todayAlign === 'left' && 'pl-1.5'
                        )}
                        style={{ top: LABEL_TOP_PX }}
                    >
                        Heute
                    </span>
                </div>
            )}
        </div>
    )
}
