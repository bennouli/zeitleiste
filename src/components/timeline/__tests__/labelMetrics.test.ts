import type { Entry } from '@/lib/entry'
import { sampleEntry } from '@/test/entries'
import { describe, expect, it } from 'vitest'
import {
    estimateLabelWidthPx,
    LABEL_MAX_WIDTH_PX,
    PRIVATE_UNDER_TESTS,
} from '../labelMetrics'

const { TITLE_CHAR_WIDTH_PX, DATE_CHAR_WIDTH_PX, POST_CHEVRON_WIDTH_PX } =
    PRIVATE_UNDER_TESTS

const point = sampleEntry('dekabristenaufstand')
const withPost = sampleEntry('oktoberrevolution')
const spanWithPost = sampleEntry('kubakrise')
const spanAcrossMonths = sampleEntry('russlandfeldzug-1812')

describe('estimateLabelWidthPx', () => {
    it('grows with the title', () => {
        const shortTitle: Entry = { ...point, title: 'x'.repeat(12) }
        const longTitle: Entry = { ...point, title: 'x'.repeat(18) }
        expect(estimateLabelWidthPx(shortTitle, 'de')).toBe(
            12 * TITLE_CHAR_WIDTH_PX
        )
        expect(estimateLabelWidthPx(longTitle, 'de')).toBe(
            18 * TITLE_CHAR_WIDTH_PX
        )
    })

    it('caps the title where it truncates', () => {
        const hugeTitle: Entry = { ...point, title: 'x'.repeat(80) }
        expect(estimateLabelWidthPx(hugeTitle, 'de')).toBe(LABEL_MAX_WIDTH_PX)
    })

    it('takes the date line when it is wider than the title', () => {
        const tinyTitle: Entry = { ...point, title: 'X' }
        // '26. Dez. 1825'
        expect(estimateLabelWidthPx(tinyTitle, 'de')).toBe(
            13 * DATE_CHAR_WIDTH_PX
        )
    })

    it('counts the post suffix and its chevron on the date line', () => {
        const hugeTitle: Entry = { ...withPost, title: 'x'.repeat(80) }
        // '7. Nov. 1917 · Beitrag' and the chevron
        const dateLineWidth = 22 * DATE_CHAR_WIDTH_PX + POST_CHEVRON_WIDTH_PX
        expect(estimateLabelWidthPx(hugeTitle, 'de')).toBe(
            Math.max(LABEL_MAX_WIDTH_PX, dateLineWidth)
        )
        const tinyTitle: Entry = { ...withPost, title: 'X' }
        expect(estimateLabelWidthPx(tinyTitle, 'de')).toBe(dateLineWidth)
    })

    it("counts a span's date range, with the post suffix and its chevron", () => {
        const tinyTitle: Entry = { ...spanWithPost, title: 'X' }
        const dateLine = '16.–28. Okt. 1962 · Beitrag'
        expect(estimateLabelWidthPx(tinyTitle, 'de')).toBe(
            dateLine.length * DATE_CHAR_WIDTH_PX + POST_CHEVRON_WIDTH_PX
        )
    })

    it("lets a span's range line widen the label past the title cap", () => {
        const rangeLine = '24. Juni 1812 – Dez. 1812'
        const rangeWidth = rangeLine.length * DATE_CHAR_WIDTH_PX
        expect(rangeWidth).toBeGreaterThan(LABEL_MAX_WIDTH_PX)
        expect(estimateLabelWidthPx(spanAcrossMonths, 'de')).toBe(rangeWidth)
    })

    it('measures the date line in the language shown', () => {
        const tinyTitle: Entry = { ...withPost, title: 'X' }
        const englishDateLine = '7 Nov 1917 · Post'
        expect(estimateLabelWidthPx(tinyTitle, 'en')).toBe(
            englishDateLine.length * DATE_CHAR_WIDTH_PX + POST_CHEVRON_WIDTH_PX
        )
    })
})
