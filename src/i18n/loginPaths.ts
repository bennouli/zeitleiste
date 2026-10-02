import { Option, Schema } from 'effect'
import { isLocale, type Locale } from './locales'
import { startHref } from './paths'

/** The request header in which the proxy hands the requested path and query to the site. */
export const REQUESTED_PATH_HEADER = 'x-requested-path'

const LOGIN_SEGMENT = 'login'

/** The login page in this locale, leading on to `requestedPath` when that is a page of the site. */
export function loginHref(locale: Locale, requestedPath?: unknown): string {
    const loginPath = `${startHref(locale)}/${LOGIN_SEGMENT}`
    const target = sitePagePath(requestedPath)
    return target === undefined
        ? loginPath
        : `${loginPath}?${new URLSearchParams({ redirect: target })}`
}

/**
 * `value` as the normalised path of a site page (`/de/post/x?y`); undefined for
 * anything else: another host, a path outside a locale, the login page.
 */
export function sitePagePath(value: unknown): string | undefined {
    return Option.getOrUndefined(
        Option.flatMap(decodeString(value), pagePathOf)
    )
}

const SITE_ORIGIN = 'http://site.invalid'

const decodeString = Schema.decodeUnknownOption(Schema.String)

function pagePathOf(value: string): Option.Option<string> {
    if (!value.startsWith('/') || !URL.canParse(value, SITE_ORIGIN))
        return Option.none()
    const url = new URL(value, SITE_ORIGIN)
    const [first = '', second] = url.pathname.split('/').filter(Boolean)
    const isSitePage =
        url.origin === SITE_ORIGIN &&
        !url.pathname.startsWith('//') &&
        isLocale(first) &&
        second !== LOGIN_SEGMENT
    return isSitePage
        ? Option.some(`${url.pathname}${url.search}${url.hash}`)
        : Option.none()
}
