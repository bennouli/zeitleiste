import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from './page'

describe('start page', () => {
  it('renders no post (the timeline lives in the layout)', () => {
    const { container } = render(<HomePage />)
    expect(container).toBeEmptyDOMElement()
  })
})
