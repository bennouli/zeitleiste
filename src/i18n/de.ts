import { APP_NAME } from '@/lib/brand'
import type { Messages } from './messages'

const entries = (count: number) => (count === 1 ? 'Eintrag' : 'Einträge')
const entriesDative = (count: number) => (count === 1 ? 'Eintrag' : 'Einträgen')

export const de = {
    site: {
        name: APP_NAME,
        description: `${APP_NAME}: Russland und der Westen seit 1700, eine interaktive Zeitleiste`,
        heading: `${APP_NAME}: Russland und der Westen`,
        postTitle: (title) => `${title} – ${APP_NAME}`,
    },
    notFound: {
        heading: 'Seite nicht gefunden',
        text: 'Unter dieser Adresse gibt es keinen Beitrag.',
        back: 'Zur Zeitleiste',
    },
    timeline: {
        regionLabel: 'Zeitleiste',
        help: 'Mit Plus und Minus zoomen, mit den Pfeiltasten links und rechts in der Zeit verschieben.',
        zoomIn: 'Hineinzoomen',
        zoomOut: 'Herauszoomen',
        today: 'Heute',
        stackUp: 'Einen Eintrag nach oben',
        stackDown: 'Einen Eintrag nach unten',
        groupHint: 'Gruppe · Klicken zum Hineinzoomen',
    },
    post: {
        label: 'Beitrag',
        close: 'Beitrag schließen',
        closeShort: 'Schließen',
    },
    since: 'seit',
    entryType: {
        war: 'Krieg',
        revolution: 'Revolution',
        power: 'Machtwechsel',
        event: 'Ereignis',
    },
    group: 'Gruppe',
    groupName: (count, years) =>
        `Gruppe mit ${count} ${entriesDative(count)}, ${years}`,
    groupMeta: (count, years) => `${count} ${entries(count)} · ${years}`,
    position: (ordinal, count) => `${ordinal} von ${count}`,
    invitation: {
        pageTitle: `Einladung annehmen – ${APP_NAME}`,
        heading: 'Einladung annehmen',
        intro: 'Lege ein Passwort fest. Danach meldest du dich mit deiner E-Mail-Adresse und diesem Passwort an.',
        password: 'Passwort',
        passwordRepeat: 'Passwort wiederholen',
        submit: 'Passwort festlegen',
        submitting: 'Wird gespeichert …',
        mismatch: 'Die beiden Passwörter stimmen nicht überein.',
        missing: 'Bitte gib ein Passwort ein.',
        unusable:
            'Die Einladung ist abgelaufen oder wurde schon verwendet. Bitte um eine neue Einladung.',
        failed: 'Das Passwort konnte nicht gespeichert werden. Bitte versuche es später noch einmal.',
        accepted:
            'Dein Passwort ist gespeichert. Du kannst dich jetzt anmelden.',
        login: 'Zur Anmeldung',
    },
    login: {
        pageTitle: `Anmelden – ${APP_NAME}`,
        heading: 'Anmelden',
        intro: 'Die Zeitleiste ist nur für angemeldete Benutzer sichtbar.',
        email: 'E-Mail-Adresse',
        password: 'Passwort',
        submit: 'Anmelden',
        submitting: 'Wird angemeldet …',
        invalid: 'E-Mail-Adresse oder Passwort ist falsch.',
        failed: 'Die Anmeldung ist gerade nicht möglich. Bitte versuche es später noch einmal.',
    },
    notes: {
        heading: 'Notizen',
        editorLabel: 'Neue Notiz',
        textLabel: 'Text',
        placeholder: 'Notiz schreiben …',
        save: 'Sichern',
        saving: 'Wird gesichert …',
        saveHint: 'Strg+Enter oder Cmd+Enter',
        cancel: 'Abbrechen',
        edit: 'Bearbeiten',
        editLabel: (title) => `Notiz bearbeiten: ${title}`,
        delete: 'Löschen',
        deleteLabel: (title) => `Notiz löschen: ${title}`,
        confirmDelete: 'Diese Notiz löschen?',
        showAll: 'Ganz anzeigen',
        showLess: 'Weniger anzeigen',
        untitled: 'Notiz ohne Titel',
        collapse: 'Notizen ausblenden',
        expand: 'Notizen einblenden',
        failed: {
            save: 'Die Notiz konnte nicht gesichert werden. Bitte versuche es noch einmal.',
            delete: 'Die Notiz konnte nicht gelöscht werden. Bitte versuche es noch einmal.',
            load: 'Deine Notizen konnten nicht geladen werden. Bitte lade die Seite neu.',
        },
    },
} satisfies Messages
