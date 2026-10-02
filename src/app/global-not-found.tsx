import { DEFAULT_LOCALE } from '@/i18n/locales'
import NotFound from './(frontend)/[lang]/(site)/not-found'
import { Site, siteMetadata } from './(frontend)/Site'
import { Document } from './Document'

export const metadata = siteMetadata(DEFAULT_LOCALE)

export default function GlobalNotFound() {
    return (
        <Document locale={DEFAULT_LOCALE}>
            <Site lang={DEFAULT_LOCALE}>
                <NotFound />
            </Site>
        </Document>
    )
}
