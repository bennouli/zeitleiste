'use client'

import { Button } from '@payloadcms/ui'
import { RESEND_TEXT, useResendInvitation } from './useResendInvitation'

export function ResendInvitationButton() {
    const { visible, pending, resend } = useResendInvitation()
    if (!visible) return null
    return (
        <Button
            buttonStyle="secondary"
            size="medium"
            margin={false}
            disabled={pending}
            onClick={resend}
        >
            {RESEND_TEXT.label}
        </Button>
    )
}
