import type { Side } from '@/lib/placement'
import clsx from 'clsx'

const DOT_PX = 7
const OPEN_DOT_PX = 13
/** The axis line lies below the anchor's origin, so a dot above it reaches this much further. */
const AXIS_LINE_PX = 1

export type ConnectorProps = {
    side: Side
    /** Distance from the label's axis-side edge to the axis line. */
    lengthPx: number
    /** The entry whose post is open: drawn in full ink. */
    open?: boolean
}

/** Hairline from a label's axis-side edge down (or up) to the axis. */
export function Connector({ side, lengthPx, open = false }: ConnectorProps) {
    return (
        <div
            aria-hidden="true"
            data-connector
            className={clsx(
                'pointer-events-none absolute left-0 w-px',
                open ? 'bg-fg' : 'bg-fg/40'
            )}
            style={{
                height: lengthPx,
                [side === 'above' ? 'bottom' : 'top']: -lengthPx,
            }}
        />
    )
}

type AxisDotProps = ConnectorProps

/** The entry's dot on the axis, centred on the connector's foot. */
export function AxisDot({ side, lengthPx, open = false }: AxisDotProps) {
    const sizePx = open ? OPEN_DOT_PX : DOT_PX
    const centringPx = (sizePx - AXIS_LINE_PX) / 2
    return (
        <div
            aria-hidden="true"
            data-axis-dot
            className="pointer-events-none absolute rounded-full bg-fg"
            style={{
                width: sizePx,
                height: sizePx,
                left: -centringPx,
                ...(side === 'above'
                    ? { bottom: -lengthPx - centringPx - AXIS_LINE_PX }
                    : { top: -lengthPx - centringPx }),
            }}
        />
    )
}
