import { switchLocalePath } from '@/i18n/paths'
import { preferredLocale } from '@/i18n/preferredLocale'
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
    const url = request.nextUrl.clone()
    url.pathname = switchLocalePath(
        url.pathname,
        preferredLocale(request.headers.get('accept-language'))
    )
    return NextResponse.redirect(url)
}

export const config = {
    matcher: ['/', '/post/:path*'],
}
