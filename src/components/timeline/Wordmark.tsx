'use client'

import { useI18n } from '@/components/I18nContext'
import clsx from 'clsx'
import { useWordmarkTyping } from './useWordmarkTyping'

const WITHOUT_SCRIPT_CSS =
    '[data-wordmark-name]{visibility:visible}[data-wordmark-typing]{display:none}'

export function Wordmark() {
    const { t } = useI18n()
    const { typed, untyped, isTyping } = useWordmarkTyping()
    return (
        <p
            aria-hidden="true"
            data-wordmark
            className="grid min-w-wordmark font-sans text-label-lg font-medium tracking-wordmark whitespace-nowrap text-fg"
        >
            <noscript>
                <style>{WITHOUT_SCRIPT_CSS}</style>
            </noscript>
            <span
                data-wordmark-name
                className={clsx(
                    'col-start-1 row-start-1',
                    isTyping && 'motion-safe:invisible'
                )}
            >
                {t.site.name}
            </span>
            {isTyping && (
                <span
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
