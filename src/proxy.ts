import { REQUESTED_PATH_HEADER } from '@/i18n/loginPaths'
import { switchLocalePath } from '@/i18n/paths'
import { preferredLocale } from '@/i18n/preferredLocale'
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
    return isUnprefixedSitePath(request.nextUrl.pathname)
        ? localeRedirect(request)
        : withRequestedPath(request)
}

export const config = {
    matcher: ['/((?!api|admin|_next|einladung|.*\\..*).*)'],
}

const isUnprefixedSitePath = (pathname: string) =>
    pathname === '/' || pathname === '/post' || pathname.startsWith('/post/')

function localeRedirect(request: NextRequest) {
    const url = request.nextUrl.clone()
    url.pathname = switchLocalePath(
        url.pathname,
        preferredLocale(request.headers.get('accept-language'))
    )
    return NextResponse.redirect(url)
}

function withRequestedPath(request: NextRequest) {
    const { pathname, search } = request.nextUrl
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(REQUESTED_PATH_HEADER, `${pathname}${search}`)
    return NextResponse.next({ request: { headers: requestHeaders } })
}
