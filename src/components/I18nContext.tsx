'use client'

import { DEFAULT_LOCALE, type Locale } from '@/i18n/locales'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

export type I18n = {
    locale: Locale
}

const I18nContext = createContext<I18n>({ locale: DEFAULT_LOCALE })

export function I18nProvider({
    locale,
    children,
}: {
    locale: Locale
    children: ReactNode
}) {
    const i18n = useMemo(() => ({ locale }), [locale])
    return <I18nContext value={i18n}>{children}</I18nContext>
}

export function useI18n(): I18n {
    return useContext(I18nContext)
}
