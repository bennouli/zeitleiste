import { describe, expect, it } from 'vitest'
import {
    overlapsTodayLabel,
    PRIVATE_UNDER_TESTS,
    todayAlignment,
} from '../todayLabel'

const { LABEL_CLEARANCE_PX, TODAY_LABEL_HALF_WIDTH_PX } = PRIVATE_UNDER_TESTS

const WIDTH = 1000
const TODAY_LABEL_WIDTH = 2 * TODAY_LABEL_HALF_WIDTH_PX
const LABEL_WIDTH = 30

describe('todayAlignment', () => {
    it.each([
        ['right', WIDTH - TODAY_LABEL_HALF_WIDTH_PX + 1],
        ['right', WIDTH],
        ['center', WIDTH - TODAY_LABEL_HALF_WIDTH_PX],
        ['center', WIDTH / 2],
        ['center', TODAY_LABEL_HALF_WIDTH_PX],
        ['left', TODAY_LABEL_HALF_WIDTH_PX - 1],
        ['left', 0],
    ] as const)('aligns %s at x = %d', (align, todayX) => {
        expect(todayAlignment(todayX, WIDTH)).toBe(align)
    })
})

describe('overlapsTodayLabel', () => {
    const todayX = 500
    /** Tick x whose label edge just keeps the clearance to a "Heute" edge at `edgeX`. */
    const clearLeftOf = (edgeX: number) =>
        edgeX - LABEL_CLEARANCE_PX - LABEL_WIDTH / 2
    const clearRightOf = (edgeX: number) =>
        edgeX + LABEL_CLEARANCE_PX + LABEL_WIDTH / 2

    it.each([
        [
            'center',
            todayX - TODAY_LABEL_HALF_WIDTH_PX,
            todayX + TODAY_LABEL_HALF_WIDTH_PX,
        ],
        ['right', todayX - TODAY_LABEL_WIDTH, todayX],
        ['left', todayX, todayX + TODAY_LABEL_WIDTH],
    ] as const)(
        'keeps labels outside the clearance and drops those inside (%s)',
        (align, x0, x1) => {
            const overlaps = (tickX: number) =>
                overlapsTodayLabel(tickX, LABEL_WIDTH, todayX, align)
            expect(overlaps(clearLeftOf(x0))).toBe(false)
            expect(overlaps(clearLeftOf(x0) + 1)).toBe(true)
            expect(overlaps((x0 + x1) / 2)).toBe(true)
            expect(overlaps(clearRightOf(x1) - 1)).toBe(true)
            expect(overlaps(clearRightOf(x1))).toBe(false)
        }
    )

    it('counts the label width', () => {
        const tickX = todayX - TODAY_LABEL_HALF_WIDTH_PX - 30
        expect(overlapsTodayLabel(tickX, 20, todayX, 'center')).toBe(false)
        expect(overlapsTodayLabel(tickX, 60, todayX, 'center')).toBe(true)
    })
})
