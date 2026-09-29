import type { LevelsPerSide } from '@/lib/placement'
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
/** At least one row per side, however short the band. */
const MIN_BAND_LEVELS = 1

export type BandGeometry = {
    /** Card rows on each side of the axis. */
    maxLevels: LevelsPerSide
    /** Cards a group stack shows at once, on each side. */
    visibleCount: LevelsPerSide
    /** Card rows a group stack covers, on each side. */
    groupLevels: LevelsPerSide
}

type BandSide = { [K in keyof BandGeometry]: number }

/**
 * Splits the timeline's height into the card bands above and below the axis.
 * The top `topInsetPx` of the band above is kept free; the band below is unaffected by it.
 */
export function bandGeometry(
    height: number,
    width: number,
    collapsed: boolean,
    topInsetPx: number
): BandGeometry {
    const cardBandHeight = Math.max(0, (height - AXIS_HEIGHT_PX) / 2)
    const rowsReachPx =
        cardBandHeight + AXIS_LINE_TO_BAND_PX - CARD_FIRST_ROW_OFFSET_PX
    const above = bandSide(rowsReachPx - topInsetPx, width, collapsed)
    const below = bandSide(rowsReachPx, width, collapsed)
    return {
        maxLevels: { above: above.maxLevels, below: below.maxLevels },
        visibleCount: { above: above.visibleCount, below: below.visibleCount },
        groupLevels: { above: above.groupLevels, below: below.groupLevels },
    }
}

/** Rows and stack size for a band whose rows may reach `rowsReachPx` past the first row's start. */
function bandSide(
    rowsReachPx: number,
    width: number,
    collapsed: boolean
): BandSide {
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
