import { currentReader } from '@/app/(frontend)/reader'
import { LoginForm } from '@/components/account/LoginForm'
import { sitePagePath } from '@/i18n/loginPaths'
import { messages } from '@/i18n/messages'
import { startHref } from '@/i18n/paths'
import { routeLocale } from '@/i18n/routeLocale'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { logInAction } from './actions'

type Props = {
    params: Promise<{ lang: string }>
    searchParams: Promise<{ redirect?: string | string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { login } = messages[routeLocale((await params).lang)]
    return { title: login.pageTitle, robots: { index: false } }
}

export default async function LoginPage({ params, searchParams }: Props) {
    const locale = routeLocale((await params).lang)
    const target =
        sitePagePath((await searchParams).redirect) ?? startHref(locale)
    if ((await currentReader()) !== null) redirect(target)
    const loginText = messages[locale].login
    return (
        <main className="mx-auto max-w-reading px-4 py-8 sm:px-6">
            <h1 className="font-serif text-post-title">{loginText.heading}</h1>
            <div className="mt-6 font-serif text-body">
                <LoginForm action={logInAction.bind(null, locale, target)} />
            </div>
        </main>
    )
}
