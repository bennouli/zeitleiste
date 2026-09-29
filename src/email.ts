import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import {
    Effect,
    Option,
    Schema,
    SchemaGetter,
    SchemaIssue,
    SchemaTransformation,
} from 'effect'
import nodemailer, { type SentMessageInfo, type Transport } from 'nodemailer'

export const emailAdapter = (env: unknown) => {
    const { sender, smtp } = decodeEmailEnv(env)
    const senderDefaults = {
        defaultFromName: sender.name,
        defaultFromAddress: sender.address,
    }
    if (smtp !== undefined) {
        return nodemailerAdapter({
            ...senderDefaults,
            transportOptions: {
                host: smtp.host,
                port: smtp.port,
                secure: false,
                requireTLS: true,
                auth: { user: smtp.user, pass: smtp.pass },
            },
        })
    }
    console.warn('SMTP not configured, emails are printed to the terminal')
    return nodemailerAdapter({
        ...senderDefaults,
        transport: nodemailer.createTransport(consoleTransport),
    })
}

const DEFAULT_SENDER = 'Liniya <noreply@bennoselig.dev>'
const MAILBOX = /^\s*(\S(?:.*\S)?)\s*<\s*([^\s<>@]+@[^\s<>@]+)\s*>\s*$/

const isFilled = (value: string | undefined): value is string =>
    value !== undefined && value.trim() !== ''

const Setting = <S extends Schema.Top & { readonly Encoded: string }>(
    target: S
) =>
    Schema.optional(Schema.String).pipe(
        Schema.decodeTo(Schema.optionalKey(target), {
            decode: SchemaGetter.transformOptional(Option.filter(isFilled)),
            encode: SchemaGetter.passthrough(),
        })
    )

const Mailbox = Schema.Struct({
    name: Schema.NonEmptyString,
    address: Schema.NonEmptyString,
})

const MailboxFromString = Schema.String.pipe(
    Schema.decodeTo(
        Mailbox,
        SchemaTransformation.transformEffect({
            decode: (value, options) => {
                const [, name, address] = MAILBOX.exec(value) ?? []
                return name === undefined || address === undefined
                    ? Effect.fail(
                          new SchemaIssue.InvalidValue(
                              {
                                  message:
                                      'Expected a sender like "Liniya <noreply@bennoselig.dev>"',
                              },
                              value,
                              options
                          )
                      )
                    : Effect.succeed({ name, address })
            },
            encode: ({ name, address }) =>
                Effect.succeed(`${name} <${address}>`),
        })
    )
)

const Port = Schema.FiniteFromString.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 65535 })
)

const EmailEnvFields = Schema.Struct({
    EMAIL_FROM: Schema.optional(Schema.String).pipe(
        Schema.decodeTo(MailboxFromString, {
            decode: SchemaGetter.transformOptional((value) =>
                value.pipe(
                    Option.filter(isFilled),
                    Option.orElseSome(() => DEFAULT_SENDER)
                )
            ),
            encode: SchemaGetter.passthrough(),
        })
    ),
    SMTP_HOST: Setting(Schema.String),
    SMTP_PORT: Setting(Port),
    SMTP_USER: Setting(Schema.String),
    SMTP_PASS: Setting(Schema.String),
})

const SmtpSettings = Schema.Struct({
    host: Schema.String,
    port: Schema.Number,
    user: Schema.String,
    pass: Schema.String,
})

const EmailSettings = Schema.Struct({
    sender: Mailbox,
    smtp: Schema.optionalKey(SmtpSettings),
})

type EmailSettings = typeof EmailSettings.Type

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] as const

type EmailEnvFields = typeof EmailEnvFields.Type
type CompleteSmtpFields = EmailEnvFields &
    Required<Pick<EmailEnvFields, (typeof SMTP_KEYS)[number]>>

const hasCompleteSmtp = (
    fields: EmailEnvFields
): fields is CompleteSmtpFields =>
    SMTP_KEYS.every((key) => fields[key] !== undefined)

const EmailEnv = EmailEnvFields.pipe(
    Schema.decodeTo(
        EmailSettings,
        SchemaTransformation.transformEffect({
            decode: (fields) => {
                if (hasCompleteSmtp(fields))
                    return Effect.succeed<EmailSettings>({
                        sender: fields.EMAIL_FROM,
                        smtp: {
                            host: fields.SMTP_HOST,
                            port: fields.SMTP_PORT,
                            user: fields.SMTP_USER,
                            pass: fields.SMTP_PASS,
                        },
                    })
                const missingKeys = SMTP_KEYS.filter(
                    (key) => fields[key] === undefined
                )
                return missingKeys.length === SMTP_KEYS.length
                    ? Effect.succeed<EmailSettings>({
                          sender: fields.EMAIL_FROM,
                      })
                    : Effect.fail(
                          new SchemaIssue.InvalidValue({
                              message: `SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS are set together or not at all; missing ${missingKeys.join(', ')}`,
                          })
                      )
            },
            encode: ({ sender, smtp }) =>
                Effect.succeed({
                    EMAIL_FROM: sender,
                    SMTP_HOST: smtp?.host,
                    SMTP_PORT: smtp?.port,
                    SMTP_USER: smtp?.user,
                    SMTP_PASS: smtp?.pass,
                }),
        })
    )
)

const decodeEmailEnv = Schema.decodeUnknownSync(EmailEnv)

const printableBody = (body: unknown) =>
    typeof body === 'string' || Buffer.isBuffer(body) ? String(body) : ''

const consoleTransport: Transport<SentMessageInfo> = {
    name: 'console',
    version: '1.0.0',
    send: (mail, callback) => {
        const envelope = mail.message.getEnvelope()
        const body =
            printableBody(mail.data.text) || printableBody(mail.data.html)
        console.info(
            `Email to ${envelope.to.join(', ')}\nSubject: ${mail.data.subject ?? ''}\n\n${body}`
        )
        callback(null, { envelope, messageId: mail.message.messageId() })
    },
}

export const PRIVATE_UNDER_TESTS = { EmailEnv }
