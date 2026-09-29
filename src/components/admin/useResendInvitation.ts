'use client'

import type { User } from '@/payload-types'
import {
    toast,
    useAuth,
    useConfig,
    useDocumentInfo,
    useFormFields,
} from '@payloadcms/ui'
import { useState } from 'react'

export const RESEND_TEXT = {
    label: 'Einladung erneut senden',
    sent: 'Die Einladung wurde erneut verschickt.',
    failed: 'Die Einladung konnte nicht verschickt werden.',
}

export const useResendInvitation = () => {
    const { id } = useDocumentInfo()
    const { user } = useAuth<User>()
    const invitationAccepted = useFormFields(([fields]) =>
        Boolean(fields.invitationAcceptedAt?.value)
    )
    const {
        config: {
            routes: { api },
        },
    } = useConfig()
    const [pending, setPending] = useState(false)

    const resend = () => {
        setPending(true)
        void fetch(`${api}/users/${id}/invite`, {
            method: 'POST',
            credentials: 'include',
        })
            .then(
                (res) => res.ok,
                () => false
            )
            .then((sent) => {
                if (sent) toast.success(RESEND_TEXT.sent)
                else toast.error(RESEND_TEXT.failed)
                setPending(false)
            })
    }

    return {
        visible:
            user?.role === 'admin' && id !== undefined && !invitationAccepted,
        pending,
        resend,
    }
}
