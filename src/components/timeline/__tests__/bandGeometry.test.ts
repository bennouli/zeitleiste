import { describe, expect, it } from 'vitest'
import { AXIS_LINE_Y_PX } from '../Axis'
import { bandGeometry, SLOT_HEIGHT_PX } from '../bandGeometry'
import {
    AXIS_HEIGHT_PX,
    CARD_FIRST_ROW_OFFSET_PX,
    CARD_ROW_HEIGHT_PX,
    TOP_BAR_HEIGHT_PX,
} from '../constants'
import { GROUP_STACK_CONTROLS_HEIGHT_PX } from '../GroupStack'
import { LABEL_HEIGHT_PX } from '../labelMetrics'

const DESKTOP_WIDTH = 1000
const NARROWEST_DESKTOP_WIDTH = 640
const PHONE_WIDTH = 400
const FULL_HEIGHT = 800
const TINY_HEIGHT = 100
const EXPANDED = false
const COLLAPSED = true
const NO_INSET = 0
const HEIGHTS = [300, 500, 640, 800, 1100]
/** Tall enough for a three-card stack without the inset, only for two with it. */
const STACK_LIMITING_HEIGHT = 432

/** The outermost row's far edge, measured from the axis line. */
const farEdge = (levels: number) =>
    CARD_FIRST_ROW_OFFSET_PX +
    (levels - 1) * CARD_ROW_HEIGHT_PX +
    LABEL_HEIGHT_PX
/** From the axis line to the top of the band above. */
const aboveReach = (height: number) =>
    (height - AXIS_HEIGHT_PX) / 2 + AXIS_LINE_Y_PX

describe('bandGeometry', () => {
    it('gives a full desktop timeline six rows and a three-card stack', () => {
        expect(
            bandGeometry(FULL_HEIGHT, DESKTOP_WIDTH, EXPANDED, NO_INSET)
        ).toEqual({
            maxLevels: 6,
            visibleCount: 3,
            groupLevels: 3,
        })
    })

    it('shows two cards per stack while collapsed', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            DESKTOP_WIDTH,
            COLLAPSED,
            NO_INSET
        )
        expect(geometry.visibleCount).toBe(2)
        expect(geometry.groupLevels).toBe(2)
    })

    it('shows one card per stack on a phone', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            PHONE_WIDTH,
            EXPANDED,
            NO_INSET
        )
        expect(geometry.visibleCount).toBe(1)
        expect(geometry.groupLevels).toBe(2)
    })

    it('treats the phone width limit itself as desktop', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            NARROWEST_DESKTOP_WIDTH,
            EXPANDED,
            NO_INSET
        )
        expect(geometry.visibleCount).toBe(3)
    })

    it('keeps one row and one card when the height fits nothing', () => {
        expect(
            bandGeometry(TINY_HEIGHT, DESKTOP_WIDTH, EXPANDED, NO_INSET)
        ).toEqual({
            maxLevels: 1,
            visibleCount: 1,
            groupLevels: 2,
        })
    })

    it('fits the far edge of the outermost row above the axis into its band, and no further row', () => {
        for (const height of HEIGHTS) {
            const { maxLevels } = bandGeometry(
                height,
                DESKTOP_WIDTH,
                EXPANDED,
                NO_INSET
            )
            expect(farEdge(maxLevels)).toBeLessThanOrEqual(aboveReach(height))
            expect(farEdge(maxLevels + 1)).toBeGreaterThan(aboveReach(height))
        }
    })

    it('keeps the outermost row above the axis out of the top inset, and no further row would be', () => {
        for (const height of HEIGHTS) {
            const { maxLevels } = bandGeometry(
                height,
                PHONE_WIDTH,
                COLLAPSED,
                TOP_BAR_HEIGHT_PX
            )
            const reachBelowBar = aboveReach(height) - TOP_BAR_HEIGHT_PX
            expect(farEdge(maxLevels)).toBeLessThanOrEqual(reachBelowBar)
            expect(farEdge(maxLevels + 1)).toBeGreaterThan(reachBelowBar)
        }
    })

    it('keeps a group stack and its controls out of the top inset', () => {
        const { visibleCount } = bandGeometry(
            STACK_LIMITING_HEIGHT,
            DESKTOP_WIDTH,
            EXPANDED,
            TOP_BAR_HEIGHT_PX
        )
        const stackFarEdge =
            CARD_FIRST_ROW_OFFSET_PX +
            visibleCount * SLOT_HEIGHT_PX +
            GROUP_STACK_CONTROLS_HEIGHT_PX
        expect(visibleCount).toBeGreaterThan(1)
        expect(stackFarEdge).toBeLessThanOrEqual(
            aboveReach(STACK_LIMITING_HEIGHT) - TOP_BAR_HEIGHT_PX
        )
    })
})
