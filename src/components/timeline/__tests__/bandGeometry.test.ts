import { describe, expect, it } from 'vitest'
import { AXIS_LINE_Y_PX } from '../Axis'
import { bandGeometry } from '../bandGeometry'
import {
    AXIS_HEIGHT_PX,
    CARD_FIRST_ROW_OFFSET_PX,
    CARD_ROW_HEIGHT_PX,
} from '../constants'
import { LABEL_HEIGHT_PX } from '../labelMetrics'

const DESKTOP_WIDTH = 1000
const NARROWEST_DESKTOP_WIDTH = 640
const PHONE_WIDTH = 400
const FULL_HEIGHT = 800
const TINY_HEIGHT = 100
const EXPANDED = false
const COLLAPSED = true

describe('bandGeometry', () => {
    it('gives a full desktop timeline six rows and a three-card stack', () => {
        expect(bandGeometry(FULL_HEIGHT, DESKTOP_WIDTH, EXPANDED)).toEqual({
            maxLevels: 6,
            visibleCount: 3,
            groupLevels: 3,
        })
    })

    it('shows two cards per stack while collapsed', () => {
        const geometry = bandGeometry(FULL_HEIGHT, DESKTOP_WIDTH, COLLAPSED)
        expect(geometry.visibleCount).toBe(2)
        expect(geometry.groupLevels).toBe(2)
    })

    it('shows one card per stack on a phone', () => {
        const geometry = bandGeometry(FULL_HEIGHT, PHONE_WIDTH, EXPANDED)
        expect(geometry.visibleCount).toBe(1)
        expect(geometry.groupLevels).toBe(2)
    })

    it('treats the phone width limit itself as desktop', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            NARROWEST_DESKTOP_WIDTH,
            EXPANDED
        )
        expect(geometry.visibleCount).toBe(3)
    })

    it('keeps one row and one card when the height fits nothing', () => {
        expect(bandGeometry(TINY_HEIGHT, DESKTOP_WIDTH, EXPANDED)).toEqual({
            maxLevels: 1,
            visibleCount: 1,
            groupLevels: 2,
        })
    })

    it('fits the far edge of the outermost row above the axis into its band, and no further row', () => {
        const heights = [300, 500, 640, 800, 1100]
        for (const height of heights) {
            const { maxLevels } = bandGeometry(height, DESKTOP_WIDTH, EXPANDED)
            const aboveReach = (height - AXIS_HEIGHT_PX) / 2 + AXIS_LINE_Y_PX
            const farEdge = (levels: number) =>
                CARD_FIRST_ROW_OFFSET_PX +
                (levels - 1) * CARD_ROW_HEIGHT_PX +
                LABEL_HEIGHT_PX
            expect(farEdge(maxLevels)).toBeLessThanOrEqual(aboveReach)
            expect(farEdge(maxLevels + 1)).toBeGreaterThan(aboveReach)
        }
    })
})
