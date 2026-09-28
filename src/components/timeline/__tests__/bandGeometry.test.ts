import { describe, expect, it } from 'vitest'
import { bandGeometry } from '../bandGeometry'
import { SPAN_LANE_HEIGHT_PX } from '../constants'

const DESKTOP_WIDTH = 1000
const NARROWEST_DESKTOP_WIDTH = 640
const PHONE_WIDTH = 400
const FULL_HEIGHT = 800
const TINY_HEIGHT = 100
const EXPANDED = false
const COLLAPSED = true
const TWO_LANES = 2
const NO_LANES = 0

describe('bandGeometry', () => {
    it('gives a full desktop timeline three rows and a three-card stack', () => {
        expect(
            bandGeometry(FULL_HEIGHT, DESKTOP_WIDTH, EXPANDED, TWO_LANES)
        ).toEqual({
            spansHeight: 2 * SPAN_LANE_HEIGHT_PX,
            maxLevels: 3,
            visibleCount: 3,
            groupLevels: 3,
        })
    })

    it('shows two cards per stack while collapsed', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            DESKTOP_WIDTH,
            COLLAPSED,
            TWO_LANES
        )
        expect(geometry.visibleCount).toBe(2)
        expect(geometry.groupLevels).toBe(2)
    })

    it('shows one card per stack on a phone', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            PHONE_WIDTH,
            EXPANDED,
            TWO_LANES
        )
        expect(geometry.visibleCount).toBe(1)
        expect(geometry.groupLevels).toBe(2)
    })

    it('treats the phone width limit itself as desktop', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            NARROWEST_DESKTOP_WIDTH,
            EXPANDED,
            TWO_LANES
        )
        expect(geometry.visibleCount).toBe(3)
    })

    it('keeps one span lane when there are no spans', () => {
        const geometry = bandGeometry(
            FULL_HEIGHT,
            DESKTOP_WIDTH,
            EXPANDED,
            NO_LANES
        )
        expect(geometry.spansHeight).toBe(SPAN_LANE_HEIGHT_PX)
    })

    it('keeps one row and one card when the height fits nothing', () => {
        expect(
            bandGeometry(TINY_HEIGHT, DESKTOP_WIDTH, EXPANDED, NO_LANES)
        ).toEqual({
            spansHeight: SPAN_LANE_HEIGHT_PX,
            maxLevels: 1,
            visibleCount: 1,
            groupLevels: 2,
        })
    })
})
