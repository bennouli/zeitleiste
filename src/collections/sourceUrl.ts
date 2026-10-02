const WEB_PROTOCOLS = ['http:', 'https:']

/** A source's link must be an http or https address; an empty value is left to `required`. */
export function sourceUrlProblem(value: unknown): string | undefined {
    if (value === null || value === undefined || value === '') return undefined
    return isWebUrl(value)
        ? undefined
        : 'Nur Links mit http:// oder https:// sind erlaubt.'
}

function isWebUrl(value: unknown): boolean {
    return (
        typeof value === 'string' &&
        URL.canParse(value) &&
        WEB_PROTOCOLS.includes(new URL(value).protocol)
    )
}
