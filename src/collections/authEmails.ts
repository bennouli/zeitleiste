import { APP_NAME } from '@/lib/brand'
import { Schema } from 'effect'

export type AuthEmail = {
    readonly subject: string
    readonly html: string
}

export type TokenLink = {
    readonly serverURL: string
    readonly token: string
}

export const invitationEmail = ({ serverURL, token }: TokenLink): AuthEmail => {
    const link = `${serverURL}/einladung/${encodeURIComponent(token)}`
    return {
        subject: `Einladung zu ${APP_NAME}`,
        html: emailHtml(`
        <p>Hallo,</p>
        <p>du bist eingeladen, ${APP_NAME} mitzubearbeiten. Über diesen Link legst du dein Passwort fest:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Der Link ist 7 Tage gültig.</p>`),
    }
}

export const forgotPasswordEmail = (args: unknown): AuthEmail => {
    const {
        token,
        req: {
            payload: { config },
        },
    } = decodeForgotPasswordEmailArgs(args)
    const link = `${config.serverURL}${config.routes.admin}/reset/${encodeURIComponent(token)}`
    return {
        subject: `Neues Passwort für ${APP_NAME}`,
        html: emailHtml(`
        <p>Hallo,</p>
        <p>für dein Konto bei ${APP_NAME} wurde ein neues Passwort angefordert. Über diesen Link legst du es fest:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Der Link ist 7 Tage gültig und funktioniert einmal. Wenn du kein neues Passwort angefordert hast, ignoriere diese E-Mail.</p>`),
    }
}

const ForgotPasswordEmailArgs = Schema.Struct({
    token: Schema.NonEmptyString,
    req: Schema.Struct({
        payload: Schema.Struct({
            config: Schema.Struct({
                serverURL: Schema.String,
                routes: Schema.Struct({ admin: Schema.String }),
            }),
        }),
    }),
})

const decodeForgotPasswordEmailArgs = Schema.decodeUnknownSync(
    ForgotPasswordEmailArgs
)

const emailHtml = (body: string) =>
    `<!doctype html><html lang="de"><body>${body}</body></html>`
