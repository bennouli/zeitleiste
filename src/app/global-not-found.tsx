import { DEFAULT_LOCALE } from '@/i18n/locales'
import NotFound from './(frontend)/[lang]/not-found'
import { Site } from './(frontend)/Site'

export { metadata } from './(frontend)/[lang]/layout'

export default function GlobalNotFound() {
    return (
        <Site locale={DEFAULT_LOCALE}>
            <NotFound />
        </Site>
    )
}
