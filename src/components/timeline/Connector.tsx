import type { Region } from '@/lib/entry'
import type { Side } from '@/lib/placement'
import clsx from 'clsx'
import { REGION_BG } from './regionStyles'

export type ConnectorProps = {
    region: Region
    side: Side
    heightPx: number
    /** How far the line reaches past the card wrapper's axis-side edge. */
    offsetPx: number
}

export function Connector({
    region,
    side,
    heightPx,
    offsetPx,
}: ConnectorProps) {
    return (
        <div
            aria-hidden="true"
            className={clsx('absolute left-0 w-0.5', REGION_BG[region])}
            style={{
                height: heightPx,
                [side === 'above' ? 'bottom' : 'top']: -offsetPx,
            }}
        />
    )
}
