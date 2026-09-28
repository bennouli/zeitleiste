import {
    AXIS_HEIGHT_PX,
    CARD_ROW_HEIGHT_PX,
    SPAN_LANE_HEIGHT_PX,
} from './constants'
import { CARD_HEIGHT_PX, CONNECTOR_MIN_PX } from './EntryCard'
import {
    GROUP_STACK_CONTROLS_HEIGHT_PX,
    groupStackHeightPx,
} from './GroupStack'

/** Vertical gap between cards in a group stack. */
const STACK_GAP_PX = 8
export const SLOT_HEIGHT_PX = CARD_HEIGHT_PX + STACK_GAP_PX
/** Below this width the timeline behaves like a phone: one card per group. */
const PHONE_WIDTH_PX = 640
/** Room kept free for the "Heute" label and the zoom buttons. */
const MIN_BAND_LEVELS = 1

export type BandGeometry = {
    spansHeight: number
    /** Card rows per side of the axis. */
    maxLevels: number
    /** Cards a group stack shows at once. */
    visibleCount: number
    /** Card rows a group stack covers. */
    groupLevels: number
}

/** Splits the timeline's height into the span band and the card bands above and below the axis. */
export function bandGeometry(
    height: number,
    width: number,
    collapsed: boolean,
    spanLaneCount: number
): BandGeometry {
    const spansHeight = Math.max(1, spanLaneCount) * SPAN_LANE_HEIGHT_PX
    const cardBandHeight = Math.max(
        0,
        (height - AXIS_HEIGHT_PX - spansHeight) / 2
    )
    const maxLevels = Math.max(
        MIN_BAND_LEVELS,
        Math.floor(cardBandHeight / CARD_ROW_HEIGHT_PX)
    )
    const visibleCount = Math.max(
        1,
        Math.min(
            preferredStackSize(width, collapsed),
            fittingStackSize(cardBandHeight)
        )
    )
    const stackHeight =
        groupStackHeightPx(visibleCount + 1, visibleCount, SLOT_HEIGHT_PX) +
        CONNECTOR_MIN_PX
    const groupLevels = Math.max(1, Math.ceil(stackHeight / CARD_ROW_HEIGHT_PX))
    return { spansHeight, maxLevels, visibleCount, groupLevels }
}

function preferredStackSize(width: number, collapsed: boolean): number {
    if (width < PHONE_WIDTH_PX) return 1
    return collapsed ? 2 : 3
}

function fittingStackSize(cardBandHeight: number): number {
    return Math.floor(
        (cardBandHeight - CONNECTOR_MIN_PX - GROUP_STACK_CONTROLS_HEIGHT_PX) /
            SLOT_HEIGHT_PX
    )
}
