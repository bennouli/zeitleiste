import type { Entry } from '@/lib/entry'
import { sampleEntry } from '@/test/entries'
import { describe, expect, it } from 'vitest'
import {
    estimateLabelWidthPx,
    LABEL_MAX_WIDTH_PX,
    PRIVATE_UNDER_TESTS,
} from '../labelMetrics'

const { TITLE_CHAR_WIDTH_PX, DATE_CHAR_WIDTH_PX } = PRIVATE_UNDER_TESTS

const point = sampleEntry('dekabristenaufstand')
const withPost = sampleEntry('oktoberrevolution')

describe('estimateLabelWidthPx', () => {
    it('grows with the title', () => {
        const shortTitle: Entry = { ...point, title: 'x'.repeat(14) }
        const longTitle: Entry = { ...point, title: 'x'.repeat(20) }
        expect(estimateLabelWidthPx(shortTitle)).toBe(14 * TITLE_CHAR_WIDTH_PX)
        expect(estimateLabelWidthPx(longTitle)).toBe(20 * TITLE_CHAR_WIDTH_PX)
    })

    it('caps the title where it truncates', () => {
        const hugeTitle: Entry = { ...point, title: 'x'.repeat(80) }
        expect(estimateLabelWidthPx(hugeTitle)).toBe(LABEL_MAX_WIDTH_PX)
    })

    it('takes the date line when it is wider than the title', () => {
        const tinyTitle: Entry = { ...point, title: 'X' }
        // '26. Dez. 1825'
        expect(estimateLabelWidthPx(tinyTitle)).toBe(13 * DATE_CHAR_WIDTH_PX)
    })

    it('counts the post suffix on the date line', () => {
        const hugeTitle: Entry = { ...withPost, title: 'x'.repeat(80) }
        // '7. Nov. 1917 · Beitrag ›'
        const dateLineWidth = 24 * DATE_CHAR_WIDTH_PX
        expect(estimateLabelWidthPx(hugeTitle)).toBe(
            Math.max(LABEL_MAX_WIDTH_PX, dateLineWidth)
        )
        const tinyTitle: Entry = { ...withPost, title: 'X' }
        expect(estimateLabelWidthPx(tinyTitle)).toBe(dateLineWidth)
    })
})
