import { DEFAULT_LOCALE } from '@/i18n/locales'
import NotFound from './(frontend)/[lang]/not-found'
import { Site, siteMetadata } from './(frontend)/Site'

export const metadata = siteMetadata(DEFAULT_LOCALE)

export default function GlobalNotFound() {
    return (
        <Site locale={DEFAULT_LOCALE}>
            <NotFound />
        </Site>
    )
}
