import type { LevelsPerSide } from '@/lib/placement'
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
const DESKTOP_HD_WIDTH = 1920
const DESKTOP_HD_HEIGHT = 1080
const HEIGHTS = [300, 500, 640, 800, 1100]
/** Tall enough for a three-card stack without the inset, only for two with it. */
const STACK_LIMITING_HEIGHT = 432

const eachSide = (levels: number): LevelsPerSide => ({
    above: levels,
    below: levels,
})

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
            maxLevels: eachSide(6),
            visibleCount: eachSide(3),
            groupLevels: eachSide(3),
        })
    })

    it('shows two cards per stack while collapsed', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            DESKTOP_WIDTH,
            COLLAPSED,
            NO_INSET
        )
        expect(geometry.visibleCount).toEqual(eachSide(2))
        expect(geometry.groupLevels).toEqual(eachSide(2))
    })

    it('shows one card per stack on a phone', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            PHONE_WIDTH,
            EXPANDED,
            NO_INSET
        )
        expect(geometry.visibleCount).toEqual(eachSide(1))
        expect(geometry.groupLevels).toEqual(eachSide(2))
    })

    it('treats the phone width limit itself as desktop', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            NARROWEST_DESKTOP_WIDTH,
            EXPANDED,
            NO_INSET
        )
        expect(geometry.visibleCount).toEqual(eachSide(3))
    })

    it('keeps one row and one card when the height fits nothing', () => {
        expect(
            bandGeometry(TINY_HEIGHT, DESKTOP_WIDTH, EXPANDED, NO_INSET)
        ).toEqual({
            maxLevels: eachSide(1),
            visibleCount: eachSide(1),
            groupLevels: eachSide(2),
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
            expect(farEdge(maxLevels.above)).toBeLessThanOrEqual(
                aboveReach(height)
            )
            expect(farEdge(maxLevels.above + 1)).toBeGreaterThan(
                aboveReach(height)
            )
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
            expect(farEdge(maxLevels.above)).toBeLessThanOrEqual(reachBelowBar)
            expect(farEdge(maxLevels.above + 1)).toBeGreaterThan(reachBelowBar)
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
            visibleCount.above * SLOT_HEIGHT_PX +
            GROUP_STACK_CONTROLS_HEIGHT_PX
        expect(visibleCount.above).toBeGreaterThan(1)
        expect(stackFarEdge).toBeLessThanOrEqual(
            aboveReach(STACK_LIMITING_HEIGHT) - TOP_BAR_HEIGHT_PX
        )
    })

    it('leaves the rows and stacks below the axis as they are without an inset', () => {
        const heights = [...HEIGHTS, STACK_LIMITING_HEIGHT]
        for (const height of heights) {
            const withInset = bandGeometry(
                height,
                DESKTOP_WIDTH,
                EXPANDED,
                TOP_BAR_HEIGHT_PX
            )
            const withoutInset = bandGeometry(
                height,
                DESKTOP_WIDTH,
                EXPANDED,
                NO_INSET
            )
            expect(withInset.maxLevels.below).toBe(withoutInset.maxLevels.below)
            expect(withInset.visibleCount.below).toBe(
                withoutInset.visibleCount.below
            )
            expect(withInset.groupLevels.below).toBe(
                withoutInset.groupLevels.below
            )
        }
    })

    it('takes a row off the band above only, at a desktop window where the inset costs one', () => {
        const { maxLevels } = bandGeometry(
            DESKTOP_HD_HEIGHT,
            DESKTOP_HD_WIDTH,
            EXPANDED,
            TOP_BAR_HEIGHT_PX
        )
        expect(maxLevels).toEqual({ above: 8, below: 9 })
    })
})
