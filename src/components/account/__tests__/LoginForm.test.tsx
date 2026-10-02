import { de } from '@/i18n/de'
import { expectNoAxeViolations } from '@/test/axe'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm, type LoginStatus } from '../LoginForm'

const LOGIN_TEXT = de.login
const CREDENTIALS = { email: 'reader@example.test', password: 'reader-pass-1' }

const answering = (status: LoginStatus) => vi.fn().mockResolvedValue(status)

async function submit({ email, password }: typeof CREDENTIALS) {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(LOGIN_TEXT.email), email)
    await user.type(screen.getByLabelText(LOGIN_TEXT.password), password)
    await user.click(screen.getByRole('button', { name: LOGIN_TEXT.submit }))
}

describe('LoginForm', () => {
    it('hands email and password to the action', async () => {
        const action = answering('idle')
        render(<LoginForm action={action} />)
        await submit(CREDENTIALS)
        await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
        const [, formData] = action.mock.calls[0] ?? []
        expect(Object.fromEntries(formData as FormData)).toEqual(CREDENTIALS)
    })

    it.each(['invalid', 'failed'] as const)(
        'announces the %s answer next to the fields',
        async (status) => {
            const action = answering(status)
            render(<LoginForm action={action} />)
            await submit(CREDENTIALS)
            const alert = await screen.findByRole('alert')
            expect(alert).toHaveTextContent(LOGIN_TEXT[status])
            expect(screen.getByLabelText(LOGIN_TEXT.password)).toHaveAttribute(
                'aria-describedby',
                alert.id
            )
        }
    )

    it('has no axe violations', async () => {
        const action = answering('invalid')
        const { container } = render(<LoginForm action={action} />)
        await expectNoAxeViolations(container)
    })
})
