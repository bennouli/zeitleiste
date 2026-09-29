import { DEFAULT_LOCALE } from '@/i18n/locales'
import type { PayloadRequest } from 'payload'

type Validation<V, O> = (
    value: V,
    options: O
) => Promise<string | true> | string | true

/** Payload's own check for a localized field, required in German only. `required: true` would apply to every locale being saved. */
export function requiredInGerman<
    V,
    O extends { req: PayloadRequest; required?: boolean },
>(validate: Validation<V, O>): Validation<V, O> {
    return (value, options) =>
        validate(value, {
            ...options,
            required: options.req.locale === DEFAULT_LOCALE,
        })
}
