import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { requiredInGerman } from '../requiredInGerman'

const requestIn = (locale: string) => ({ locale }) as unknown as PayloadRequest

describe('requiredInGerman', () => {
    it('makes the wrapped check require a German text', () => {
        const wrapped = vi.fn(() => true as const)
        const req = requestIn('de')
        const options = { req, required: false }
        requiredInGerman(wrapped)('', options)
        expect(wrapped).toHaveBeenCalledWith('', { req, required: true })
    })

    it('lets an English text be empty and keeps the other options', () => {
        const wrapped = vi.fn(() => true as const)
        const req = requestIn('en')
        const options = { req, required: true, maxLength: 80 }
        requiredInGerman(wrapped)('', options)
        expect(wrapped).toHaveBeenCalledWith('', {
            req,
            required: false,
            maxLength: 80,
        })
    })

    it('returns what the wrapped check decides', () => {
        const message = 'Pflichtfeld'
        const wrapped = vi.fn(() => message)
        const options = { req: requestIn('de') }
        expect(requiredInGerman(wrapped)('', options)).toBe(message)
    })
})
