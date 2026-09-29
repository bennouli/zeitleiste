import { AcceptInvitationForm } from '@/components/account/AcceptInvitationForm'
import { INVITATION_TEXT } from '@/components/account/invitationText'
import type { Metadata } from 'next'
import { acceptInvitationAction } from './actions'

type Props = {
    params: Promise<{ token: string }>
}

export const metadata: Metadata = {
    title: INVITATION_TEXT.pageTitle,
    robots: { index: false },
}

export default async function AcceptInvitationPage({ params }: Props) {
    const { token } = await params
    return (
        <main className="mx-auto max-w-reading px-4 py-8 sm:px-6">
            <h1 className="font-serif text-post-title">
                {INVITATION_TEXT.heading}
            </h1>
            <div className="mt-6 font-serif text-body">
                <AcceptInvitationForm
                    action={acceptInvitationAction.bind(null, token)}
                />
            </div>
        </main>
    )
}
