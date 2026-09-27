import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('is hidden while closed but keeps its id for aria-describedby', () => {
    const { container } = render(
      <Tooltip id="tip" open={false} placement="top">
        Inhalt
      </Tooltip>,
    )
    expect(screen.queryByRole('tooltip')).toBeNull()
    const el = container.querySelector('#tip')
    expect(el).not.toBeNull()
    expect(el).toHaveAttribute('hidden')
  })

  it('shows its content while open', () => {
    render(
      <Tooltip id="tip" open placement="bottom">
        Inhalt
      </Tooltip>,
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent('Inhalt')
  })

  it('positions by placement and alignment', () => {
    const { rerender } = render(
      <Tooltip id="tip" open placement="top">
        x
      </Tooltip>,
    )
    expect(screen.getByRole('tooltip')).toHaveClass('bottom-full', 'left-0')
    rerender(
      <Tooltip id="tip" open placement="bottom" align="end">
        x
      </Tooltip>,
    )
    expect(screen.getByRole('tooltip')).toHaveClass('top-full', 'right-0')
  })
})
