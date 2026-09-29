import localFont from 'next/font/local'

// Footgun: the order of `src` decides which file the fallback metrics are measured on (DESIGN.md § Fonts).
const ebGaramond = localFont({
    src: [
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-ext-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-ext-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
    ],
    display: 'swap',
    adjustFontFallback: 'Times New Roman',
    variable: '--font-eb-garamond',
})

const ebGaramondItalic = localFont({
    src: [
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-400-italic.woff2',
            weight: '400',
            style: 'italic',
        },
        {
            path: '../fonts/eb-garamond/eb-garamond-latin-ext-400-italic.woff2',
            weight: '400',
            style: 'italic',
        },
    ],
    display: 'swap',
    adjustFontFallback: 'Times New Roman',
    preload: false,
    variable: '--font-eb-garamond-italic',
})

const ibmPlexSans = localFont({
    src: [
        {
            path: '../fonts/ibm-plex-sans/ibm-plex-sans-latin-ext-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../fonts/ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../fonts/ibm-plex-sans/ibm-plex-sans-latin-ext-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
        {
            path: '../fonts/ibm-plex-sans/ibm-plex-sans-latin-500-normal.woff2',
            weight: '500',
            style: 'normal',
        },
    ],
    display: 'swap',
    adjustFontFallback: 'Arial',
    variable: '--font-ibm-plex-sans',
})

export const fontVariables = `${ebGaramond.variable} ${ebGaramondItalic.variable} ${ibmPlexSans.variable}`
