import { expect } from 'vitest'
import { axe } from 'vitest-axe'

export async function expectNoAxeViolations(container: Element) {
    const results = await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()
}
