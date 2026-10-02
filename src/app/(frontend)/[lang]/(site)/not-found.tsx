'use client'

import { useI18n } from '@/components/I18nContext'
import { startHref } from '@/i18n/paths'
import Link from 'next/link'

export default function NotFound() {
    const { locale, t } = useI18n()
    return (
        <section className="mx-auto max-w-reading px-4 py-8 text-fg sm:px-6">
            <h2 className="font-serif text-2xl">{t.notFound.heading}</h2>
            <p className="mt-2 text-fg-muted">{t.notFound.text}</p>
            <p className="mt-4">
                <Link
                    href={startHref(locale)}
                    className="underline focus-visible:outline-2 focus-visible:outline-focus"
                >
                    {t.notFound.back}
                </Link>
            </p>
        </section>
    )
}
