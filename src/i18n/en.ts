import { APP_NAME } from '@/lib/brand'
import type { Messages } from './messages'

const entries = (count: number) => (count === 1 ? 'entry' : 'entries')

export const en = {
    site: {
        name: APP_NAME,
        description: `${APP_NAME}: Russia and the West since 1700, an interactive timeline`,
        heading: `${APP_NAME}: Russia and the West`,
        postTitle: (title) => `${title} – ${APP_NAME}`,
    },
    notFound: {
        heading: 'Page not found',
        text: 'There is no post at this address.',
        back: 'Back to the timeline',
    },
    timeline: {
        regionLabel: 'Timeline',
        help: 'Zoom with plus and minus, move through time with the left and right arrow keys.',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        today: 'Today',
        stackUp: 'One entry up',
        stackDown: 'One entry down',
        groupHint: 'Group · Click to zoom in',
    },
    post: {
        label: 'Post',
        close: 'Close post',
        closeShort: 'Close',
    },
    since: 'since',
    entryType: {
        war: 'War',
        revolution: 'Revolution',
        power: 'Change of power',
        event: 'Event',
    },
    group: 'Group',
    groupName: (count, years) =>
        `Group of ${count} ${entries(count)}, ${years}`,
    groupMeta: (count, years) => `${count} ${entries(count)} · ${years}`,
    position: (ordinal, count) => `${ordinal} of ${count}`,
    invitation: {
        pageTitle: `Accept invitation – ${APP_NAME}`,
        heading: 'Accept invitation',
        intro: 'Choose a password. Afterwards you sign in with your email address and this password.',
        password: 'Password',
        passwordRepeat: 'Repeat password',
        submit: 'Set password',
        submitting: 'Saving …',
        mismatch: 'The two passwords do not match.',
        missing: 'Please enter a password.',
        unusable:
            'The invitation has expired or has already been used. Please ask for a new invitation.',
        failed: 'The password could not be saved. Please try again later.',
        accepted: 'Your password is saved. You can sign in now.',
        login: 'Go to sign-in',
    },
    login: {
        pageTitle: `Sign in – ${APP_NAME}`,
        heading: 'Sign in',
        intro: 'The timeline is only visible to signed-in users.',
        email: 'Email address',
        password: 'Password',
        submit: 'Sign in',
        submitting: 'Signing in …',
        invalid: 'The email address or password is wrong.',
        failed: 'Signing in is not possible right now. Please try again later.',
    },
} satisfies Messages
