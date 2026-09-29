import { expectNoAxeViolations } from '@/test/axe'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
    AcceptInvitationForm,
    type AcceptInvitationStatus,
} from '../AcceptInvitationForm'
import { INVITATION_TEXT } from '../invitationText'

const answering = (status: AcceptInvitationStatus) =>
    vi.fn().mockResolvedValue(status)

async function submit(password: string, passwordRepeat: string) {
    const user = userEvent.setup()
    await user.type(
        screen.getByLabelText(INVITATION_TEXT.password, { exact: true }),
        password
    )
    await user.type(
        screen.getByLabelText(INVITATION_TEXT.passwordRepeat),
        passwordRepeat
    )
    await user.click(
        screen.getByRole('button', { name: INVITATION_TEXT.submit })
    )
}

describe('AcceptInvitationForm', () => {
    it('hands both passwords to the action', async () => {
        const action = answering('accepted')
        render(<AcceptInvitationForm action={action} />)
        await submit('pass-1', 'pass-1')
        await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
        const [previous, formData] = action.mock.calls[0] ?? []
        expect(previous).toBe('idle')
        expect(Object.fromEntries(formData as FormData)).toEqual({
            password: 'pass-1',
            passwordRepeat: 'pass-1',
        })
    })

    it('links to the login once accepted', async () => {
        const action = answering('accepted')
        render(<AcceptInvitationForm action={action} />)
        await submit('pass-1', 'pass-1')
        expect(await screen.findByRole('status')).toHaveTextContent(
            INVITATION_TEXT.accepted
        )
        expect(
            screen.getByRole('link', { name: INVITATION_TEXT.login })
        ).toHaveAttribute('href', '/admin/login')
    })

    it('replaces the form with the explanation for an unusable link', async () => {
        const action = answering('unusable')
        render(<AcceptInvitationForm action={action} />)
        await submit('pass-1', 'pass-1')
        expect(await screen.findByRole('alert')).toHaveTextContent(
            INVITATION_TEXT.unusable
        )
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it.each([
        ['mismatch', INVITATION_TEXT.mismatch],
        ['missing', INVITATION_TEXT.missing],
        ['failed', INVITATION_TEXT.failed],
    ] as const)(
        'keeps the form and describes the fields with the %s error',
        async (status, message) => {
            const action = answering(status)
            render(<AcceptInvitationForm action={action} />)
            await submit('pass-1', 'pass-2')
            const alert = await screen.findByRole('alert')
            expect(alert).toHaveTextContent(message)
            expect(
                screen.getByLabelText(INVITATION_TEXT.passwordRepeat)
            ).toHaveAttribute('aria-describedby', alert.id)
        }
    )

    it('has no axe violations', async () => {
        const action = answering('idle')
        const { container } = render(<AcceptInvitationForm action={action} />)
        await expectNoAxeViolations(container)
    })
})
