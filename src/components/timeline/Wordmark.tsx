'use client'

import { useI18n } from '@/components/I18nContext'
import clsx from 'clsx'
import { useWordmarkTyping } from './useWordmarkTyping'

export function Wordmark() {
    const { t } = useI18n()
    const { typed, untyped, isTyping } = useWordmarkTyping()
    return (
        <p
            role="img"
            aria-label={t.site.name}
            className="grid min-w-wordmark font-sans text-label-lg font-medium tracking-wordmark whitespace-nowrap text-fg"
        >
            <span
                aria-hidden="true"
                className={clsx(
                    'col-start-1 row-start-1',
                    isTyping && 'motion-safe:invisible'
                )}
            >
                {t.site.name}
            </span>
            {isTyping && (
                <span
                    aria-hidden="true"
                    data-wordmark-typing
                    className="col-start-1 row-start-1 motion-reduce:hidden"
                >
                    {typed}
                    <span className="relative">
                        <span
                            data-wordmark-caret
                            className="absolute inset-y-0 left-0 w-px bg-fg"
                        />
                    </span>
                    {untyped}
                </span>
            )}
        </p>
    )
}
