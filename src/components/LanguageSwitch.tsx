'use client'

import { useI18n } from '@/components/I18nContext'
import { NO_DRAG_ATTR } from '@/components/timeline/useGestures'
import { LANGUAGE_NAME, type Locale } from '@/i18n/locales'
import { switchLocalePath } from '@/i18n/paths'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const OTHER_LOCALE: Record<Locale, Locale> = { de: 'en', en: 'de' }

/** A link to the current page in the other language. */
export function LanguageSwitch() {
    const { locale } = useI18n()
    const pathname = usePathname()
    const target = OTHER_LOCALE[locale]
    return (
        <Link
            href={switchLocalePath(pathname, target)}
            hrefLang={target}
            lang={target}
            className="pointer-events-auto small-caps text-label-lg tracking-wordmark text-fg-muted underline-offset-4 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            {...{ [NO_DRAG_ATTR]: '' }}
        >
            {LANGUAGE_NAME[target]}
        </Link>
    )
}
