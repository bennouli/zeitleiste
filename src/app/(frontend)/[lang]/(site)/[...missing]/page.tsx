import { notFound } from 'next/navigation'

/** Any address under `[lang]` that no page claims: the not-found page inside the site. */
export default function MissingPage() {
    notFound()
}
