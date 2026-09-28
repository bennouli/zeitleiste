'use client'

import { ticks, type Tick } from '@/lib/ticks'
import clsx from 'clsx'
import { useMemo } from 'react'
import { useTimeline } from './TimelineContext'

/** y of the axis line inside the axis band, in px. */
export const AXIS_LINE_Y_PX = 24
const LABEL_TOP_PX = AXIS_LINE_Y_PX + 14
const TODAY_MARK_HEIGHT_PX = 16
const TODAY_LABEL_HALF_WIDTH_PX = 24
/** Matches the default of `ticks`, which spaces the labels with it. */
const TICK_LABEL_CHAR_WIDTH_PX = 7.5
const LABEL_CLEARANCE_PX = 8
const TICK_OPTIONS = { minYearWidthForMonthsPx: 420 }

type TodayAlign = 'left' | 'center' | 'right'

/** Hairline axis up to today, short ticks with small-caps labels, and the "Heute" mark. */
export function Axis() {
    const { viewport, width, today, timeToX } = useTimeline()
    const result = useMemo(
        () => ticks(viewport.start, viewport.end, width, TICK_OPTIONS),
        [viewport.start, viewport.end, width]
    )
    const pastTicks = result.ticks.filter((tick) => tick.t <= today)
    const todayX = timeToX(today)
    const todayVisible = todayX >= -1 && todayX <= width + 1
    const todayAlign = todayAlignment(todayX, width)
    const lineWidth = Math.min(Math.max(todayX, 0), width)
    const labelHidden = (tick: Tick) =>
        todayVisible &&
        overlapsTodayLabel(timeToX(tick.t), tick.label, todayX, todayAlign)

    return (
        <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            data-tick-unit={result.unit}
        >
            <div
                data-axis-line
                className="absolute left-0 h-px bg-fg"
                style={{ top: AXIS_LINE_Y_PX, width: lineWidth }}
            />
            {pastTicks.map((tick) => (
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
                                'absolute -translate-x-1/2 small-caps leading-none tracking-[0.06em] whitespace-nowrap',
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
                            'absolute small-caps leading-none font-medium tracking-[0.06em] whitespace-nowrap text-fg',
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

function todayAlignment(todayX: number, width: number): TodayAlign {
    if (todayX > width - TODAY_LABEL_HALF_WIDTH_PX) return 'right'
    if (todayX < TODAY_LABEL_HALF_WIDTH_PX) return 'left'
    return 'center'
}

/** Whether a tick label centred on `tickX` would run into the "Heute" label. */
function overlapsTodayLabel(
    tickX: number,
    label: string,
    todayX: number,
    align: TodayAlign
): boolean {
    const todayWidth = 2 * TODAY_LABEL_HALF_WIDTH_PX
    const todayX0 =
        align === 'right'
            ? todayX - todayWidth
            : align === 'center'
              ? todayX - todayWidth / 2
              : todayX
    const halfLabel = (label.length * TICK_LABEL_CHAR_WIDTH_PX) / 2
    return (
        tickX + halfLabel + LABEL_CLEARANCE_PX > todayX0 &&
        tickX - halfLabel - LABEL_CLEARANCE_PX < todayX0 + todayWidth
    )
}
