import { describe, expect, it } from 'vitest'
import { easeInOut, easeOutCubic } from '../easing'

describe.each([
    ['easeOutCubic', easeOutCubic],
    ['easeInOut', easeInOut],
])('%s', (_, ease) => {
    it('runs from 0 to 1', () => {
        expect(ease(0)).toBe(0)
        expect(ease(1)).toBe(1)
    })

    it('never decreases', () => {
        const samples = Array.from({ length: 101 }, (_, i) => ease(i / 100))
        const decreases = samples.filter((v, i) => i > 0 && v < samples[i - 1]!)
        expect(decreases).toEqual([])
    })
})

describe('easeOutCubic', () => {
    it('is past the midpoint at half time', () => {
        expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 9)
    })
})

describe('easeInOut', () => {
    it('is symmetric around the midpoint', () => {
        expect(easeInOut(0.5)).toBe(0.5)
        expect(easeInOut(0.25) + easeInOut(0.75)).toBeCloseTo(1, 9)
    })
})
