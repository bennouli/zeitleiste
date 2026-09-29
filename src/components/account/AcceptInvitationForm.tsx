'use client'

import { useI18n } from '@/components/I18nContext'
import { KeyRound } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useId } from 'react'

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

const inputClass =
    'mt-1 block w-full rounded-sm border border-border bg-surface px-3 py-2 text-body text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

const actionClass =
    'inline-flex cursor-pointer items-center gap-2 rounded-sm border border-fg bg-accent px-4 py-2 text-accent-fg hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait'

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
