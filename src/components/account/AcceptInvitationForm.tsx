'use client'

import { useI18n } from '@/components/I18nContext'
import { KeyRound } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useId } from 'react'
import { actionClass, inputClass } from './formStyles'

export type AcceptInvitationStatus =
    'idle' | 'missing' | 'mismatch' | 'unusable' | 'failed' | 'accepted'

type AcceptInvitationFormProps = {
    action: (
        previous: AcceptInvitationStatus,
        formData: FormData
    ) => Promise<AcceptInvitationStatus>
}

const FORM_ERRORS = ['missing', 'mismatch', 'failed'] as const
type FormError = (typeof FORM_ERRORS)[number]

function isFormError(status: AcceptInvitationStatus): status is FormError {
    return FORM_ERRORS.some((error) => error === status)
}

export function AcceptInvitationForm({ action }: AcceptInvitationFormProps) {
    const [status, formAction, pending] = useActionState(action, 'idle')
    const errorId = useId()
    const invitationText = useI18n().t.invitation

    if (status === 'accepted')
        return (
            <div role="status">
                <p>{invitationText.accepted}</p>
                <p className="mt-6">
                    <Link href="/admin/login" className={actionClass}>
                        {invitationText.login}
                    </Link>
                </p>
            </div>
        )

    if (status === 'unusable')
        return <p role="alert">{invitationText.unusable}</p>

    const formError = isFormError(status) ? invitationText[status] : undefined
    return (
        <form action={formAction} className="flex flex-col gap-4">
            <p>{invitationText.intro}</p>
            <label className="small-caps text-label tracking-label">
                {invitationText.password}
                <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    required
                    aria-describedby={formError ? errorId : undefined}
                    className={`${inputClass} font-sans normal-case`}
                />
            </label>
            <label className="small-caps text-label tracking-label">
                {invitationText.passwordRepeat}
                <input
                    type="password"
                    name="passwordRepeat"
                    autoComplete="new-password"
                    required
                    aria-describedby={formError ? errorId : undefined}
                    className={`${inputClass} font-sans normal-case`}
                />
            </label>
            {formError && (
                <p id={errorId} role="alert">
                    {formError}
                </p>
            )}
            <p>
                <button
                    type="submit"
                    disabled={pending}
                    className={actionClass}
                >
                    <KeyRound aria-hidden size={18} strokeWidth={1.5} />
                    {pending
                        ? invitationText.submitting
                        : invitationText.submit}
                </button>
            </p>
        </form>
    )
}
