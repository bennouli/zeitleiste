const GERMAN_LETTERS: Record<string, string> = {
    ä: 'ae',
    ö: 'oe',
    ü: 'ue',
    ß: 'ss',
}

/** URL slug of a German title: 'Großer Nordischer Krieg' → 'grosser-nordischer-krieg'. */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[äöüß]/g, (letter) => GERMAN_LETTERS[letter] ?? letter)
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}
