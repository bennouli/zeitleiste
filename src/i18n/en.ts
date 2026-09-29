import type { Messages } from './messages'

const entries = (count: number) => (count === 1 ? 'entry' : 'entries')

export const en = {
    site: {
        name: 'Liniya',
        description: 'Interactive timeline: Russia and the West since 1700',
        heading: 'Liniya: Russia and the West',
        postTitle: (title) => `${title} – Liniya`,
    },
    notFound: {
        heading: 'Page not found',
        text: 'There is no post at this address.',
        back: 'Back to the timeline',
    },
    timeline: {
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
        pageTitle: 'Accept invitation – Liniya',
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
} satisfies Messages
