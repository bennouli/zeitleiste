import type { Media } from '@/payload-types'

export type PostImageSource = {
    src: string
    width: number
    height: number
    urlForWidth: (width: number) => string
}

type ImageFile = { url: string; width: number; height: number }

type StoredImage = {
    url?: string | null
    width?: number | null
    height?: number | null
}

export function postImageSource(media: Media): PostImageSource | undefined {
    const original: StoredImage = media
    const copies: StoredImage[] = Object.values(media.sizes ?? {})
    const files = (copies.some(isImageFile) ? copies : [original])
        .filter(isImageFile)
        .toSorted((a, b) => a.width - b.width)
    const widestFile = files.at(-1)
    if (widestFile === undefined || !isImageFile(original)) return undefined
    return {
        src: original.url,
        width: widestFile.width,
        height: widestFile.height,
        urlForWidth: (width) =>
            (files.find((file) => file.width >= width) ?? widestFile).url,
    }
}

const isImageFile = (image: StoredImage): image is ImageFile =>
    Boolean(image.url) && Boolean(image.width) && Boolean(image.height)
