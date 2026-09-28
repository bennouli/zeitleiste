import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ZoomControls } from '../ZoomControls'

describe('ZoomControls', () => {
    it('shows "−" before "+"', () => {
        const onZoomIn = vi.fn()
        const onZoomOut = vi.fn()
        render(
            <ZoomControls
                canZoomIn
                canZoomOut
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
            />
        )
        const names = screen
            .getAllByRole('button')
            .map((b) => b.getAttribute('aria-label'))
        expect(names).toEqual(['Herauszoomen', 'Hineinzoomen'])
    })

    it('reports a limit through aria-disabled, stays focusable and ignores clicks there', async () => {
        const user = userEvent.setup()
        const onZoomIn = vi.fn()
        const onZoomOut = vi.fn()
        render(
            <ZoomControls
                canZoomIn={false}
                canZoomOut
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
            />
        )
        const zoomIn = screen.getByRole('button', { name: 'Hineinzoomen' })
        const zoomOut = screen.getByRole('button', { name: 'Herauszoomen' })

        expect(zoomIn).toHaveAttribute('aria-disabled', 'true')
        expect(zoomOut).toHaveAttribute('aria-disabled', 'false')

        await user.tab()
        await user.tab()
        expect(zoomIn).toHaveFocus()

        await user.click(zoomIn)
        expect(onZoomIn).not.toHaveBeenCalled()
        await user.click(zoomOut)
        expect(onZoomOut).toHaveBeenCalledOnce()
    })
})
