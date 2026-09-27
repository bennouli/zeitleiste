import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="mx-auto max-w-prose px-4 py-8 text-fg sm:px-6">
      <h2 className="font-serif text-2xl">Seite nicht gefunden</h2>
      <p className="mt-2 text-fg-muted">Unter dieser Adresse gibt es keinen Beitrag.</p>
      <p className="mt-4">
        <Link
          href="/"
          className="underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          Zur Zeitleiste
        </Link>
      </p>
    </section>
  )
}
