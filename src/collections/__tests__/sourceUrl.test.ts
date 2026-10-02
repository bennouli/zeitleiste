import { describe, expect, it } from 'vitest'
import { sourceUrlProblem } from '../sourceUrl'

describe('sourceUrlProblem', () => {
    it.each([
        'https://de.wikipedia.org/wiki/Krimkrieg',
        'http://example.org/quelle?seite=2#absatz',
        'HTTPS://EXAMPLE.ORG',
    ])('accepts %s', (url) => {
        expect(sourceUrlProblem(url)).toBeUndefined()
    })

    it.each([
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        ' javascript:alert(1)',
        'ftp://example.org/datei.pdf',
        'mailto:redaktion@example.org',
        'data:text/html,<p>x</p>',
        'example.org',
        'keine Adresse',
    ])('refuses %s', (url) => {
        expect(sourceUrlProblem(url)).toMatch(/http:\/\/ oder https:\/\//)
    })

    it('refuses a value that is not text', () => {
        const number = 42
        expect(sourceUrlProblem(number)).toMatch(/http/)
    })

    it.each([null, undefined, ''])('leaves %o to required', (empty) => {
        expect(sourceUrlProblem(empty)).toBeUndefined()
    })
})
