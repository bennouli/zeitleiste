import { I18nProvider } from '@/components/I18nContext'
import type { Locale } from '@/i18n/locales'
import type { ReactNode } from 'react'

/** A Testing Library `wrapper` that renders the component in `locale`. */
export function inLocale(locale: Locale) {
    return function LocaleWrapper({ children }: { children: ReactNode }) {
        return <I18nProvider locale={locale}>{children}</I18nProvider>
    }
}
