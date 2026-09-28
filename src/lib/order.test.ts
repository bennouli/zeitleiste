import { describe, expect, it } from 'vitest'
import { compareIds } from './order'

describe('compareIds', () => {
    it('orders by code unit, equal ids compare as 0', () => {
        expect(compareIds('a', 'b')).toBe(-1)
        expect(compareIds('b', 'a')).toBe(1)
        expect(compareIds('a', 'a')).toBe(0)
        expect(compareIds('B', 'a')).toBe(-1)
    })

    it('sorts ids', () => {
        const ids = ['zar', 'krieg-2', 'krieg-10', 'Anfang']
        expect([...ids].sort(compareIds)).toEqual([
            'Anfang',
            'krieg-10',
            'krieg-2',
            'zar',
        ])
    })
})
