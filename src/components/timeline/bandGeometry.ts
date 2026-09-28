import { AXIS_LINE_Y_PX } from './Axis'
import {
    AXIS_HEIGHT_PX,
    CARD_FIRST_ROW_OFFSET_PX,
    CARD_ROW_HEIGHT_PX,
} from './constants'
import {
    GROUP_STACK_CONTROLS_HEIGHT_PX,
    groupStackHeightPx,
} from './GroupStack'
import { LABEL_HEIGHT_PX } from './labelMetrics'

/** Vertical gap between cards in a group stack. */
const STACK_GAP_PX = 14
export const SLOT_HEIGHT_PX = LABEL_HEIGHT_PX + STACK_GAP_PX
/** The axis line's distance to the nearer edge of the axis band, where a card band begins. */
const AXIS_LINE_TO_BAND_PX = Math.min(
    AXIS_LINE_Y_PX,
    AXIS_HEIGHT_PX - AXIS_LINE_Y_PX
)
/** Below this width the timeline behaves like a phone: one card per group. */
const PHONE_WIDTH_PX = 640
/** Room kept free for the "Heute" label and the zoom buttons. */
const MIN_BAND_LEVELS = 1

export type BandGeometry = {
    /** Card rows per side of the axis. */
    maxLevels: number
    /** Cards a group stack shows at once. */
    visibleCount: number
    /** Card rows a group stack covers. */
    groupLevels: number
}

/** Splits the timeline's height into the card bands above and below the axis. */
export function bandGeometry(
    height: number,
    width: number,
    collapsed: boolean
): BandGeometry {
    const cardBandHeight = Math.max(0, (height - AXIS_HEIGHT_PX) / 2)
    const rowsReachPx =
        cardBandHeight + AXIS_LINE_TO_BAND_PX - CARD_FIRST_ROW_OFFSET_PX
    const maxLevels = Math.max(
        MIN_BAND_LEVELS,
        Math.floor((rowsReachPx - LABEL_HEIGHT_PX) / CARD_ROW_HEIGHT_PX) + 1
    )
    const visibleCount = Math.max(
        1,
        Math.min(
            preferredStackSize(width, collapsed),
            fittingStackSize(rowsReachPx)
        )
    )
    const stackHeight = groupStackHeightPx(
        visibleCount + 1,
        visibleCount,
        SLOT_HEIGHT_PX
    )
    const groupLevels = Math.max(1, Math.ceil(stackHeight / CARD_ROW_HEIGHT_PX))
    return { maxLevels, visibleCount, groupLevels }
}

function preferredStackSize(width: number, collapsed: boolean): number {
    if (width < PHONE_WIDTH_PX) return 1
    return collapsed ? 2 : 3
}

/** Stack slots that fit between the first row and the band's far edge. */
function fittingStackSize(rowsReachPx: number): number {
    return Math.floor(
        (rowsReachPx - GROUP_STACK_CONTROLS_HEIGHT_PX) / SLOT_HEIGHT_PX
    )
}
