'use client'

import { useI18n } from '@/components/I18nContext'
import { LogIn } from 'lucide-react'
import { useActionState, useId } from 'react'
import { actionClass, inputClass } from './formStyles'

export type LoginStatus = 'idle' | 'invalid' | 'failed'

type LoginFormProps = {
    action: (previous: LoginStatus, formData: FormData) => Promise<LoginStatus>
}

export function LoginForm({ action }: LoginFormProps) {
    const [status, formAction, pending] = useActionState(action, 'idle')
    const errorId = useId()
    const loginText = useI18n().t.login
    const formError = status === 'idle' ? undefined : loginText[status]
    const describedBy = formError ? errorId : undefined

    return (
        <form action={formAction} className="flex flex-col gap-4">
            <p>{loginText.intro}</p>
            <label className="small-caps text-label tracking-label">
                {loginText.email}
                <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    required
                    aria-describedby={describedBy}
                    className={`${inputClass} font-sans normal-case`}
                />
            </label>
            <label className="small-caps text-label tracking-label">
                {loginText.password}
                <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    aria-describedby={describedBy}
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
                    <LogIn aria-hidden size={18} strokeWidth={1.5} />
                    {pending ? loginText.submitting : loginText.submit}
                </button>
            </p>
        </form>
    )
}
