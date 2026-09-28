import type { Region } from '@/lib/entry'
import type { Side } from '@/lib/placement'
import clsx from 'clsx'
import { REGION_BG } from './regionStyles'

export type ConnectorProps = {
    region: Region
    alignEnd: boolean
    side: Side
    heightPx: number
    /** How far the line reaches past the card wrapper's axis-side edge. */
    offsetPx: number
}

export function Connector({
    region,
    alignEnd,
    side,
    heightPx,
    offsetPx,
}: ConnectorProps) {
    return (
        <div
            aria-hidden="true"
            className={clsx(
                'absolute w-0.5',
                alignEnd ? 'right-0' : 'left-0',
                REGION_BG[region]
            )}
            style={{
                height: heightPx,
                [side === 'above' ? 'bottom' : 'top']: -offsetPx,
            }}
        />
    )
}
