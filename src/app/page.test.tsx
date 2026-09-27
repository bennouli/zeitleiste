import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import HomePage from './page'

describe('start page', () => {
  it('renders the page heading', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('heading', { level: 1, name: /Zeitleiste/ }),
    ).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<HomePage />)
    // jsdom has no canvas, so axe cannot compute contrast here; contrast
    // needs a real-browser check.
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()
  })
})
